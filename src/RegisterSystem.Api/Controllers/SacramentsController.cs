using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;
using RegisterSystem.Api.Services;

namespace RegisterSystem.Api.Controllers;

/// <summary>Dop, första kommunion, konfirmation, vigsel m.m. – med kyrka, datum och präst.</summary>
[ApiController]
[Authorize]
[Route("api/sacraments")]
public class SacramentsController(AppDbContext db, CurrentUser currentUser, AuditService audit) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult> Create(SacramentUpsert req)
    {
        var error = await ValidateAsync(req);
        if (error is not null) return error;

        var s = new SacramentEvent { MemberId = req.MemberId };
        Apply(s, req);
        db.Sacraments.Add(s);
        await SyncMarriageAsync(req);
        await db.SaveChangesAsync();
        await audit.LogAsync("SacramentCreated", nameof(SacramentEvent), s.Id, $"{req.Type} för medlem {req.MemberId}");
        return Ok(new { s.Id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, SacramentUpsert req)
    {
        var s = await db.Sacraments.FindAsync(id);
        if (s is null) return NotFound();
        if (s.MemberId != req.MemberId) return BadRequest(new ProblemDetails { Title = "Medlem kan inte ändras." });
        var error = await ValidateAsync(req);
        if (error is not null) return error;

        Apply(s, req);
        await SyncMarriageAsync(req);
        await db.SaveChangesAsync();
        await audit.LogAsync("SacramentUpdated", nameof(SacramentEvent), id);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var s = await db.Sacraments.FindAsync(id);
        if (s is null) return NotFound();
        if (!await currentUser.CanAccessMemberAsync(s.MemberId)) return Forbid();
        db.Sacraments.Remove(s);
        await db.SaveChangesAsync();
        await audit.LogAsync("SacramentDeleted", nameof(SacramentEvent), id);
        return NoContent();
    }

    private async Task<ActionResult?> ValidateAsync(SacramentUpsert req)
    {
        if (!await currentUser.CanAccessMemberAsync(req.MemberId)) return Forbid();
        if (req.ChurchId is { } c && !await db.Churches.AnyAsync(x => x.Id == c))
            return BadRequest(new ProblemDetails { Title = "Okänd kyrka." });
        if (req.PriestId is { } p && !await db.Priests.AnyAsync(x => x.Id == p))
            return BadRequest(new ProblemDetails { Title = "Okänd präst." });
        if (req.SpouseMemberId is { } sp)
        {
            if (req.Type != SacramentType.Marriage) return BadRequest(new ProblemDetails { Title = "Make/maka anges bara vid vigsel." });
            if (sp == req.MemberId || !await currentUser.CanAccessMemberAsync(sp)) return BadRequest(new ProblemDetails { Title = "Ogiltig make/maka." });
        }
        if (req.Date > DateOnly.FromDateTime(DateTime.Today.AddYears(1)))
            return BadRequest(new ProblemDetails { Title = "Datumet ligger för långt fram i tiden." });
        return null;
    }

    /// <summary>Vid vigsel: skapa make/maka-relation och sätt civilstånd till gift för båda.</summary>
    private async Task SyncMarriageAsync(SacramentUpsert req)
    {
        if (req.Type != SacramentType.Marriage || req.SpouseMemberId is not { } spouseId) return;
        await RelationsController.AddRelationAsync(db, req.MemberId, spouseId, RelationType.Spouse, req.Date, null);
        foreach (var m in await db.Members.Where(m => m.Id == req.MemberId || m.Id == spouseId).ToListAsync())
        {
            m.CivilStatus = CivilStatus.Married;
            m.UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    private static void Apply(SacramentEvent s, SacramentUpsert req)
    {
        s.Type = req.Type;
        s.Date = req.Date;
        s.ChurchId = req.ChurchId;
        s.ChurchNameOther = req.ChurchId is null ? req.ChurchNameOther?.Trim() : null;
        s.PriestId = req.PriestId;
        s.PriestNameOther = req.PriestId is null ? req.PriestNameOther?.Trim() : null;
        s.SpouseMemberId = req.SpouseMemberId;
        s.Godparents = req.Godparents?.Trim();
        s.RegisterReference = req.RegisterReference?.Trim();
        s.Notes = req.Notes?.Trim();
    }

    internal static async Task<List<SacramentDto>> LoadForMembersAsync(AppDbContext db, IReadOnlyCollection<int> memberIds) =>
        await db.Sacraments.Where(s => memberIds.Contains(s.MemberId))
            .OrderBy(s => s.Date)
            .Select(s => new SacramentDto(s.Id, s.MemberId, s.Type, s.Date, s.ChurchId,
                s.Church != null ? s.Church.Name : s.ChurchNameOther,
                s.PriestId, s.Priest != null ? s.Priest.Name : s.PriestNameOther,
                s.SpouseMemberId, s.SpouseMember != null ? s.SpouseMember.FirstName + " " + s.SpouseMember.LastName : null,
                s.Godparents, s.RegisterReference, s.Notes))
            .ToListAsync();
}
