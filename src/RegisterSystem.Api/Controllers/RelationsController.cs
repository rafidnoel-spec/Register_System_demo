using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;
using RegisterSystem.Api.Services;

namespace RegisterSystem.Api.Controllers;

/// <summary>Relationer mellan medlemmar: make/maka, förälder/barn, gudförälder.</summary>
[ApiController]
[Authorize]
[Route("api/relations")]
public class RelationsController(AppDbContext db, CurrentUser currentUser, AuditService audit) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(RelationCreate req)
    {
        if (req.MemberId == req.RelatedMemberId)
            return BadRequest(new ProblemDetails { Title = "En medlem kan inte ha en relation till sig själv." });
        if (!await currentUser.CanAccessMemberAsync(req.MemberId) || !await currentUser.CanAccessMemberAsync(req.RelatedMemberId))
            return Forbid();

        var error = await ValidateAsync(req);
        if (error is not null) return BadRequest(new ProblemDetails { Title = error });

        var relation = await AddRelationAsync(db, req.MemberId, req.RelatedMemberId, req.Type, req.FromDate, req.ToDate);
        if (relation is null) return Conflict(new ProblemDetails { Title = "Relationen finns redan." });

        await db.SaveChangesAsync();
        await audit.LogAsync("RelationCreated", nameof(MemberRelation), relation.Id, $"{req.MemberId} {req.Type} {req.RelatedMemberId}");
        return Ok(new { relation.Id });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var r = await db.Relations.FindAsync(id);
        if (r is null) return NotFound();
        if (!await currentUser.CanAccessMemberAsync(r.MemberId) && !await currentUser.CanAccessMemberAsync(r.RelatedMemberId))
            return Forbid();
        db.Relations.Remove(r);
        await db.SaveChangesAsync();
        await audit.LogAsync("RelationDeleted", nameof(MemberRelation), id);
        return NoContent();
    }

    private async Task<string?> ValidateAsync(RelationCreate req)
    {
        if (req.Type == RelationType.Parent)
        {
            // Förhindra cirkulära relationer (barnet är redan förälder till föräldern).
            if (await db.Relations.AnyAsync(r => r.Type == RelationType.Parent && r.MemberId == req.RelatedMemberId && r.RelatedMemberId == req.MemberId))
                return "Det omvända förhållandet finns redan.";
            var births = await db.Members.Where(m => m.Id == req.MemberId || m.Id == req.RelatedMemberId)
                .ToDictionaryAsync(m => m.Id, m => m.BirthDate);
            if (births[req.MemberId] >= births[req.RelatedMemberId])
                return "Föräldern måste vara född före barnet.";
            if (await db.Relations.CountAsync(r => r.Type == RelationType.Parent && r.RelatedMemberId == req.RelatedMemberId) >= 2)
                return "Barnet har redan två registrerade föräldrar.";
        }
        return null;
    }

    /// <summary>
    /// Lägger till en relation om den inte redan finns. Make/maka lagras en gång (lägst id först)
    /// så att relationen blir symmetrisk.
    /// </summary>
    internal static async Task<MemberRelation?> AddRelationAsync(AppDbContext db, int memberId, int relatedId, RelationType type, DateOnly? from, DateOnly? to)
    {
        if (type == RelationType.Spouse && memberId > relatedId) (memberId, relatedId) = (relatedId, memberId);

        var exists = type == RelationType.Spouse
            ? await db.Relations.AnyAsync(r => r.Type == type && ((r.MemberId == memberId && r.RelatedMemberId == relatedId) || (r.MemberId == relatedId && r.RelatedMemberId == memberId)))
            : await db.Relations.AnyAsync(r => r.Type == type && r.MemberId == memberId && r.RelatedMemberId == relatedId);
        if (exists) return null;

        var relation = new MemberRelation { MemberId = memberId, RelatedMemberId = relatedId, Type = type, FromDate = from, ToDate = to };
        db.Relations.Add(relation);
        return relation;
    }
}
