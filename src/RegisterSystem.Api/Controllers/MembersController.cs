using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;
using RegisterSystem.Api.Services;

namespace RegisterSystem.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/members")]
public class MembersController(AppDbContext db, CurrentUser currentUser, MemberQueryService query,
    PersonnummerProtector protector, AuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<PagedResult<MemberListItem>> List([FromQuery] MemberFilter filter)
    {
        filter.PageSize = Math.Clamp(filter.PageSize, 1, 500);
        filter.Page = Math.Max(1, filter.Page);
        var q = await query.QueryAsync(filter);
        var total = await q.CountAsync();
        var items = await MemberQueryService.Project(q)
            .Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize).ToListAsync();
        return new PagedResult<MemberListItem>(items.Select(MemberQueryService.Finish).ToList(), total, filter.Page, filter.PageSize);
    }

    /// <summary>Självregistreringar som väntar på godkännande.</summary>
    [HttpGet("pending")]
    public async Task<List<MemberListItem>> Pending()
    {
        var q = (await currentUser.MembersInScopeAsync()).Where(m => m.Status == MemberStatus.Pending).OrderBy(m => m.CreatedAt);
        var items = await MemberQueryService.Project(q).ToListAsync();
        return items.Select(MemberQueryService.Finish).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MemberDetail>> Get(int id)
    {
        var m = await (await currentUser.MembersInScopeAsync())
            .Include(x => x.Church)
            .Include(x => x.Consents)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return NotFound();

        var relations = await LoadRelationsAsync(id);
        var sacraments = await SacramentsController.LoadForMembersAsync(db, [id]);

        await audit.LogAsync("MemberViewed", nameof(Member), id);
        return new MemberDetail(m.Id, m.FirstName, m.LastName, Personnummer.Mask(m.BirthDate), m.BirthDate,
            m.Street, m.PostalCode, m.PostalTown, m.Email, m.Phone, m.CivilStatus, m.Status, m.ChurchId, m.Church!.Name,
            m.Notes, m.Source, m.PossibleDuplicateOfId, m.CreatedAt, m.UpdatedAt,
            relations, sacraments,
            m.Consents.OrderByDescending(c => c.GivenAt)
                .Select(c => new ConsentDto(c.Id, c.PolicyVersion, c.Purpose, c.GivenAt, c.WithdrawnAt, c.Source)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult> Create(MemberUpsert req)
    {
        if (!await currentUser.CanAccessChurchAsync(req.ChurchId)) return Forbid();
        if (!Personnummer.TryNormalize(req.Personnummer, out var pnr, out var birth))
            return ValidationProblem(Field("personnummer", "Ogiltigt personnummer."));

        var hash = protector.Hash(pnr);
        var existing = await db.Members.Where(m => m.PersonnummerHash == hash && m.Status != MemberStatus.Pending)
            .Select(m => new { m.Id }).FirstOrDefaultAsync();
        if (existing is not null)
            return Conflict(new ProblemDetails
            {
                Title = "Det finns redan en medlem med detta personnummer.",
                Extensions = { ["memberId"] = await currentUser.CanAccessMemberAsync(existing.Id) ? existing.Id : null }
            });

        var m = new Member
        {
            PersonnummerEncrypted = protector.Encrypt(pnr),
            PersonnummerHash = hash,
            BirthDate = birth,
            Source = RegistrationSource.Admin
        };
        Apply(m, req);
        db.Members.Add(m);
        await db.SaveChangesAsync();
        await audit.LogAsync("MemberCreated", nameof(Member), m.Id);
        return Ok(new { m.Id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, MemberUpsert req)
    {
        var m = await (await currentUser.MembersInScopeAsync()).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return NotFound();
        if (req.ChurchId != m.ChurchId && !await currentUser.CanAccessChurchAsync(req.ChurchId)) return Forbid();

        var changes = new List<string>();
        if (!string.IsNullOrWhiteSpace(req.Personnummer))
        {
            if (!Personnummer.TryNormalize(req.Personnummer, out var pnr, out var birth))
                return ValidationProblem(Field("personnummer", "Ogiltigt personnummer."));
            var hash = protector.Hash(pnr);
            if (hash != m.PersonnummerHash)
            {
                if (await db.Members.AnyAsync(x => x.Id != id && x.PersonnummerHash == hash && x.Status != MemberStatus.Pending))
                    return Conflict(new ProblemDetails { Title = "Det finns redan en medlem med detta personnummer." });
                m.PersonnummerEncrypted = protector.Encrypt(pnr);
                m.PersonnummerHash = hash;
                m.BirthDate = birth;
                changes.Add("personnummer");
            }
        }

        if (m.Status == MemberStatus.Pending && req.Status != MemberStatus.Pending) changes.Add("godkänd");
        if (m.ChurchId != req.ChurchId) changes.Add("kyrka");
        Apply(m, req);
        m.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("MemberUpdated", nameof(Member), id, changes.Count > 0 ? string.Join(", ", changes) : null);
        return NoContent();
    }

    /// <summary>Godkänn en självregistrering.</summary>
    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var m = await (await currentUser.MembersInScopeAsync()).FirstOrDefaultAsync(x => x.Id == id && x.Status == MemberStatus.Pending);
        if (m is null) return NotFound();
        if (await db.Members.AnyAsync(x => x.Id != id && x.PersonnummerHash == m.PersonnummerHash && x.Status != MemberStatus.Pending))
            return Conflict(new ProblemDetails { Title = "Personnumret finns redan som medlem. Uppdatera den befintliga medlemmen och avvisa registreringen." });

        m.Status = MemberStatus.Active;
        m.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("RegistrationApproved", nameof(Member), id);
        return NoContent();
    }

    /// <summary>
    /// Visa fullständigt personnummer. Kräver angiven anledning och loggas (GDPR art. 5.1 f, 32).
    /// </summary>
    [HttpPost("{id:int}/personnummer")]
    public async Task<ActionResult<RevealPersonnummerResponse>> RevealPersonnummer(int id, RevealPersonnummerRequest req)
    {
        var m = await (await currentUser.MembersInScopeAsync()).Select(x => new { x.Id, x.PersonnummerEncrypted })
            .FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return NotFound();

        await audit.LogAsync("PersonnummerRevealed", nameof(Member), id, $"Anledning: {req.Reason}");
        return new RevealPersonnummerResponse(Personnummer.Format(protector.Decrypt(m.PersonnummerEncrypted)));
    }

    /// <summary>Registerutdrag – den registrerades rätt till tillgång och dataportabilitet (art. 15, 20).</summary>
    [HttpGet("{id:int}/export")]
    public async Task<IActionResult> Export(int id)
    {
        var m = await (await currentUser.MembersInScopeAsync())
            .Include(x => x.Church).ThenInclude(c => c!.City).ThenInclude(c => c!.County)
            .Include(x => x.Consents)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return NotFound();

        var relations = await LoadRelationsAsync(id);
        var sacraments = await SacramentsController.LoadForMembersAsync(db, [id]);
        var export = new
        {
            exportedAt = DateTimeOffset.UtcNow,
            description = "Registerutdrag enligt dataskyddsförordningen (GDPR) artikel 15 och 20.",
            personalData = new
            {
                m.FirstName,
                m.LastName,
                personnummer = Personnummer.Format(protector.Decrypt(m.PersonnummerEncrypted)),
                m.BirthDate,
                address = new { m.Street, m.PostalCode, m.PostalTown },
                m.Email,
                m.Phone,
                civilStatus = m.CivilStatus.ToString(),
                status = m.Status.ToString(),
                church = m.Church!.Name,
                city = m.Church.City!.Name,
                county = m.Church.City.County!.Name,
                m.Notes,
                registeredVia = m.Source.ToString(),
                m.CreatedAt,
                m.UpdatedAt
            },
            relations,
            sacraments,
            consents = m.Consents.Select(c => new { c.PolicyVersion, c.Purpose, c.GivenAt, c.WithdrawnAt, source = c.Source.ToString() })
        };

        await audit.LogAsync("MemberExported", nameof(Member), id, "Registerutdrag (art. 15)");
        var json = JsonSerializer.SerializeToUtf8Bytes(export, new JsonSerializerOptions { WriteIndented = true });
        return File(json, "application/json", $"registerutdrag-{id}-{DateTime.Today:yyyyMMdd}.json");
    }

    /// <summary>
    /// Radera medlem permanent – rätten att bli raderad (art. 17). Även relationer, sakramentsposter
    /// och samtycken tas bort. Granskningsloggen behåller endast medlemmens id.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] string? reason)
    {
        var m = await (await currentUser.MembersInScopeAsync()).FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return NotFound();

        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Relations.Where(r => r.MemberId == id || r.RelatedMemberId == id).ExecuteDeleteAsync();
        await db.Sacraments.Where(s => s.SpouseMemberId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.SpouseMemberId, (int?)null));
        await db.Sacraments.Where(s => s.MemberId == id).ExecuteDeleteAsync();
        await db.Consents.Where(c => c.MemberId == id).ExecuteDeleteAsync();
        await db.Members.Where(x => x.PossibleDuplicateOfId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.PossibleDuplicateOfId, (int?)null));
        db.Members.Remove(m);
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        var action = m.Status == MemberStatus.Pending ? "RegistrationRejected" : "MemberErased";
        await audit.LogAsync(action, nameof(Member), id, string.IsNullOrWhiteSpace(reason) ? null : $"Anledning: {reason}");
        return NoContent();
    }

    /// <summary>Sök medlemmar för att koppla relationer (namn + födelsedatum, inga personnummer).</summary>
    [HttpGet("lookup")]
    public async Task<List<MemberLookupDto>> Lookup([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2) return [];
        var s = q.Trim();
        return await (await currentUser.MembersInScopeAsync())
            .Where(m => m.Status != MemberStatus.Pending && (m.FirstName + " " + m.LastName).Contains(s))
            .OrderBy(m => m.LastName).ThenBy(m => m.FirstName).Take(20)
            .Select(m => new MemberLookupDto(m.Id, m.FirstName + " " + m.LastName, m.BirthDate, m.Church!.Name))
            .ToListAsync();
    }

    private async Task<List<RelationDto>> LoadRelationsAsync(int id)
    {
        var rels = await db.Relations
            .Where(r => r.MemberId == id || r.RelatedMemberId == id)
            .Select(r => new
            {
                r.Id, r.Type, r.MemberId, r.RelatedMemberId, r.FromDate, r.ToDate,
                MemberName = r.Member!.FirstName + " " + r.Member.LastName,
                RelatedName = r.RelatedMember!.FirstName + " " + r.RelatedMember.LastName
            }).ToListAsync();

        return rels.Select(r => r.MemberId == id
                ? new RelationDto(r.Id, r.Type, "outgoing", r.RelatedMemberId, r.RelatedName, r.FromDate, r.ToDate)
                : new RelationDto(r.Id, r.Type, "incoming", r.MemberId, r.MemberName, r.FromDate, r.ToDate))
            .ToList();
    }

    private static void Apply(Member m, MemberUpsert req)
    {
        m.FirstName = req.FirstName.Trim();
        m.LastName = req.LastName.Trim();
        m.Street = req.Street?.Trim() ?? "";
        m.PostalCode = req.PostalCode?.Replace(" ", "") ?? "";
        m.PostalTown = req.PostalTown?.Trim() ?? "";
        m.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        m.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        m.CivilStatus = req.CivilStatus;
        m.Status = req.Status;
        m.ChurchId = req.ChurchId;
        m.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
    }

    private static ValidationProblemDetails Field(string name, string message) =>
        new(new Dictionary<string, string[]> { [name] = [message] }) { Title = message };
}
