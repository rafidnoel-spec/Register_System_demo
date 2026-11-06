using System.Net;
using System.Security.Claims;
using System.Text;
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
[Route("api/reports")]
public class ReportsController(AppDbContext db, CurrentUser currentUser, MemberQueryService query,
    EmailService email, SmtpOptions smtpOptions, AuditService audit) : ControllerBase
{
    private const int MaxRows = 5000;
    private const int MaxRecipients = 10;

    /// <summary>Kolumner som får ingå i listor. Personnummer ingår medvetet aldrig i utskick.</summary>
    public static readonly Dictionary<string, (string Header, Func<MemberListItem, string> Value)> Columns = new()
    {
        ["name"] = ("Namn", m => $"{m.LastName}, {m.FirstName}"),
        ["birthDate"] = ("Födelsedatum", m => m.BirthDate.ToString("yyyy-MM-dd")),
        ["age"] = ("Ålder", m => m.Age.ToString()),
        ["address"] = ("Adress", m => $"{m.Street}, {m.PostalCode} {m.PostalTown}"),
        ["civilStatus"] = ("Civilstånd", m => Labels.Civil(m.CivilStatus)),
        ["church"] = ("Kyrka", m => m.ChurchName),
        ["city"] = ("Stad", m => m.CityName),
        ["status"] = ("Status", m => Labels.Status(m.Status))
    };

    private static readonly string[] DefaultColumns = ["name", "birthDate", "address", "civilStatus", "church"];

    [HttpGet("members.csv")]
    public async Task<IActionResult> Csv([FromQuery] MemberFilter filter, [FromQuery] string? columns)
    {
        var cols = ParseColumns(columns?.Split(',').ToList());
        var rows = await LoadRowsAsync(filter);
        await audit.LogAsync("MemberListExported", nameof(Member), null, $"CSV, {rows.Count} rader, filter: {Describe(filter)}");
        return File(BuildCsv(rows, cols), "text/csv; charset=utf-8", $"medlemmar-{DateTime.Today:yyyyMMdd}.csv");
    }

    [HttpPost("members/email")]
    public async Task<IActionResult> EmailList(EmailListRequest req)
    {
        var recipients = req.Recipients.Select(r => r.Trim().ToLowerInvariant()).Where(r => r.Length > 0).Distinct().ToList();
        if (recipients.Count is 0 or > MaxRecipients)
            return BadRequest(new ProblemDetails { Title = $"Ange 1–{MaxRecipients} mottagare." });

        var userEmails = await db.Users.Where(u => u.IsActive && recipients.Contains(u.Email)).Select(u => u.Email).ToListAsync();
        var notAllowed = recipients.Where(r => !userEmails.Contains(r) &&
            !smtpOptions.AllowedRecipientDomains.Any(d => r.EndsWith("@" + d.ToLowerInvariant(), StringComparison.Ordinal))).ToList();
        if (notAllowed.Count > 0)
            return BadRequest(new ProblemDetails
            {
                Title = "Av dataskyddsskäl får listor bara skickas till användare i systemet eller godkända domäner.",
                Detail = "Ej tillåtna: " + string.Join(", ", notAllowed)
            });

        var cols = ParseColumns(req.Columns);
        var rows = await LoadRowsAsync(req.Filter);
        var sender = User.FindFirstValue(ClaimTypes.Name) ?? "";

        var html = new StringBuilder();
        html.Append("<div style=\"font-family:Segoe UI,Arial,sans-serif\">");
        if (!string.IsNullOrWhiteSpace(req.Message))
            html.Append("<p>").Append(WebUtility.HtmlEncode(req.Message).Replace("\n", "<br>")).Append("</p>");
        html.Append($"<p>{rows.Count} medlemmar. Filter: {WebUtility.HtmlEncode(Describe(req.Filter))}</p>");
        html.Append("<table cellpadding=\"4\" cellspacing=\"0\" border=\"1\" style=\"border-collapse:collapse;font-size:13px\"><tr>");
        foreach (var c in cols) html.Append("<th style=\"background:#1f3a5f;color:#fff\">").Append(Columns[c].Header).Append("</th>");
        html.Append("</tr>");
        foreach (var r in rows)
        {
            html.Append("<tr>");
            foreach (var c in cols) html.Append("<td>").Append(WebUtility.HtmlEncode(Columns[c].Value(r))).Append("</td>");
            html.Append("</tr>");
        }
        html.Append("</table>");
        html.Append($"<p style=\"color:#666;font-size:12px\">Skickat av {WebUtility.HtmlEncode(sender)} från församlingsregistret. ")
            .Append("Innehåller personuppgifter – får inte vidarebefordras. Radera mejlet när det inte längre behövs.</p></div>");

        await email.SendAsync(recipients, req.Subject, html.ToString(),
            [new EmailAttachment($"medlemmar-{DateTime.Today:yyyyMMdd}.csv", BuildCsv(rows, cols), "text/csv")]);

        await audit.LogAsync("MemberListEmailed", nameof(Member), null,
            $"{rows.Count} rader till {string.Join(", ", recipients)}, filter: {Describe(req.Filter)}");
        return Ok(new { sent = rows.Count });
    }

    /// <summary>Familjerapport: person, make/maka, barn och föräldrar med sakrament.</summary>
    [HttpGet("family/{memberId:int}")]
    public async Task<ActionResult<FamilyReport>> Family(int memberId)
    {
        var scope = await currentUser.MembersInScopeAsync();
        var head = await scope.Include(m => m.Church).FirstOrDefaultAsync(m => m.Id == memberId);
        if (head is null) return NotFound();

        var spouseIds = await db.Relations.Where(r => r.Type == RelationType.Spouse && (r.MemberId == memberId || r.RelatedMemberId == memberId))
            .Select(r => r.MemberId == memberId ? r.RelatedMemberId : r.MemberId).ToListAsync();
        var parentSide = spouseIds.Append(memberId).ToList();
        var childIds = await db.Relations.Where(r => r.Type == RelationType.Parent && parentSide.Contains(r.MemberId))
            .Select(r => r.RelatedMemberId).Distinct().ToListAsync();
        var parentIds = await db.Relations.Where(r => r.Type == RelationType.Parent && r.RelatedMemberId == memberId)
            .Select(r => r.MemberId).ToListAsync();

        var allIds = parentSide.Concat(childIds).Concat(parentIds).Distinct().ToList();
        var people = await scope.Where(m => allIds.Contains(m.Id))
            .Select(m => new { m.Id, Name = m.FirstName + " " + m.LastName, m.BirthDate, m.CivilStatus, Church = m.Church!.Name })
            .ToDictionaryAsync(m => m.Id);
        var sacraments = (await SacramentsController.LoadForMembersAsync(db, allIds)).GroupBy(s => s.MemberId).ToDictionary(g => g.Key, g => g.ToList());

        FamilyMember Make(int id, string role)
        {
            var p = people[id];
            return new FamilyMember(id, p.Name, role, p.BirthDate, p.CivilStatus, p.Church, sacraments.GetValueOrDefault(id) ?? []);
        }

        var report = new FamilyReport(
            Make(memberId, "Huvudperson"),
            spouseIds.Where(people.ContainsKey).Select(id => Make(id, "Make/maka")).ToList(),
            childIds.Where(people.ContainsKey).Select(id => Make(id, "Barn")).OrderBy(c => c.BirthDate).ToList(),
            parentIds.Where(people.ContainsKey).Select(id => Make(id, "Förälder")).ToList(),
            $"{head.Street}, {head.PostalCode} {head.PostalTown}",
            DateTimeOffset.UtcNow,
            User.FindFirstValue(ClaimTypes.Name) ?? "");

        await audit.LogAsync("FamilyReport", nameof(Member), memberId, $"{allIds.Count} personer");
        return report;
    }

    private async Task<List<MemberListItem>> LoadRowsAsync(MemberFilter filter)
    {
        var q = await query.QueryAsync(filter);
        var rows = await MemberQueryService.Project(q).Take(MaxRows).ToListAsync();
        return rows.Select(MemberQueryService.Finish).ToList();
    }

    private static List<string> ParseColumns(List<string>? requested)
    {
        var cols = (requested ?? []).Select(c => c.Trim()).Where(Columns.ContainsKey).Distinct().ToList();
        return cols.Count > 0 ? cols : [.. DefaultColumns];
    }

    private static byte[] BuildCsv(List<MemberListItem> rows, List<string> cols)
    {
        static string Esc(string v)
        {
            // Skydd mot CSV/formel-injektion i Excel.
            if (v.Length > 0 && "=+-@\t\r".Contains(v[0])) v = "'" + v;
            return v.Contains(';') || v.Contains('"') || v.Contains('\n') ? $"\"{v.Replace("\"", "\"\"")}\"" : v;
        }

        var sb = new StringBuilder();
        sb.AppendLine(string.Join(';', cols.Select(c => Esc(Columns[c].Header))));
        foreach (var r in rows) sb.AppendLine(string.Join(';', cols.Select(c => Esc(Columns[c].Value(r)))));
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(sb.ToString())];
    }

    private static string Describe(MemberFilter f)
    {
        var parts = new List<string>();
        if (f.CountyId is not null) parts.Add($"län {f.CountyId}");
        if (f.CityId is not null) parts.Add($"stad {f.CityId}");
        if (f.ChurchId is not null) parts.Add($"kyrka {f.ChurchId}");
        if (f.CivilStatus is { } cs) parts.Add(Labels.Civil(cs));
        if (f.Status is { } st) parts.Add(Labels.Status(st));
        if (f.HasSacrament is { } h) parts.Add("har " + Labels.Sacrament(h));
        if (f.MissingSacrament is { } m) parts.Add("saknar " + Labels.Sacrament(m));
        if (f.MinAge is not null || f.MaxAge is not null) parts.Add($"ålder {f.MinAge ?? 0}–{f.MaxAge?.ToString() ?? ""}");
        if (!string.IsNullOrWhiteSpace(f.Search)) parts.Add($"sök \"{f.Search}\"");
        return parts.Count == 0 ? "alla" : string.Join(", ", parts);
    }
}
