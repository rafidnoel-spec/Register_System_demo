using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;
using RegisterSystem.Api.Services;

namespace RegisterSystem.Api.Controllers;

/// <summary>
/// Publik självregistrering utan inloggning (webb och kiosk/surfplatta vid kyrkdörren).
/// Svaret är alltid detsamma oavsett om personen redan finns – avslöjar inte vem som är medlem.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public")]
[EnableRateLimiting("public")]
public class PublicController(AppDbContext db, PersonnummerProtector protector, PrivacyPolicy privacy,
    AuditService audit, ILogger<PublicController> logger) : ControllerBase
{
    private const string SuccessMessage = "Tack! Din registrering har tagits emot och kommer att granskas av församlingen.";

    [HttpGet("churches")]
    public async Task<List<PublicChurchDto>> Churches() =>
        await db.Churches.Where(c => c.AcceptsPublicRegistration)
            .OrderBy(c => c.City!.County!.Name).ThenBy(c => c.City!.Name).ThenBy(c => c.Name)
            .Select(c => new PublicChurchDto(c.Id, c.Name, c.City!.Name, c.City.County!.Name))
            .ToListAsync();

    [HttpGet("kiosk/{code}")]
    public async Task<ActionResult<KioskChurchDto>> Kiosk(string code)
    {
        var c = await db.Churches.Where(x => x.KioskCode == code)
            .Select(x => new KioskChurchDto(x.Id, x.Name, x.City!.Name)).FirstOrDefaultAsync();
        if (c is null) return NotFound();
        return c;
    }

    [HttpGet("privacy")]
    public PrivacyPolicyDto Privacy() => privacy.Get();

    [HttpPost("registrations")]
    public async Task<IActionResult> Register(PublicRegistrationRequest req)
    {
        // Honeypot: riktiga användare ser aldrig fältet.
        if (!string.IsNullOrEmpty(req.Website))
        {
            logger.LogWarning("Registrering stoppad av honeypot");
            return Ok(new { message = SuccessMessage });
        }

        var policy = privacy.Get();
        if (!req.ConsentGiven || req.PolicyVersion != policy.Version)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["consentGiven"] = ["Du behöver godkänna informationen om personuppgiftsbehandling."]
            }));

        if (!Personnummer.TryNormalize(req.Personnummer, out var pnr, out var birth))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["personnummer"] = ["Personnumret är inte giltigt. Skriv det som ÅÅÅÅMMDD-XXXX."]
            }));

        Church? church;
        RegistrationSource source;
        if (!string.IsNullOrEmpty(req.KioskCode))
        {
            church = await db.Churches.FirstOrDefaultAsync(c => c.KioskCode == req.KioskCode);
            source = RegistrationSource.Kiosk;
        }
        else
        {
            church = await db.Churches.FirstOrDefaultAsync(c => c.Id == req.ChurchId && c.AcceptsPublicRegistration);
            source = RegistrationSource.PublicWeb;
        }
        if (church is null)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["churchId"] = ["Välj en kyrka."]
            }));

        var hash = protector.Hash(pnr);
        var existingMemberId = await db.Members
            .Where(m => m.PersonnummerHash == hash && m.Status != MemberStatus.Pending)
            .Select(m => (int?)m.Id).FirstOrDefaultAsync();

        // Finns redan en väntande registrering med samma personnummer ersätts den i stället för att dubbleras.
        var member = await db.Members.FirstOrDefaultAsync(m => m.PersonnummerHash == hash && m.Status == MemberStatus.Pending)
                     ?? db.Members.Add(new Member()).Entity;

        member.FirstName = req.FirstName.Trim();
        member.LastName = req.LastName.Trim();
        member.Street = req.Street.Trim();
        member.PostalCode = req.PostalCode.Replace(" ", "");
        member.PostalTown = req.PostalTown.Trim();
        member.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        member.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        member.PersonnummerEncrypted = protector.Encrypt(pnr);
        member.PersonnummerHash = hash;
        member.BirthDate = birth;
        member.CivilStatus = req.CivilStatus;
        member.Status = MemberStatus.Pending;
        member.Source = source;
        member.ChurchId = church.Id;
        member.PossibleDuplicateOfId = existingMemberId;
        member.UpdatedAt = DateTimeOffset.UtcNow;
        member.Consents.Add(new ConsentRecord
        {
            PolicyVersion = policy.Version,
            Purpose = "Medlemsregister och kyrkobok (art. 6.1 a, 9.2 a, 9.2 d)",
            Source = source
        });

        await db.SaveChangesAsync();
        await audit.LogAsync("PublicRegistration", nameof(Member), member.Id, $"Källa {source}, kyrka {church.Id}");
        return Ok(new { message = SuccessMessage });
    }
}
