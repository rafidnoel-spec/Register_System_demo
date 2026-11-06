using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;

namespace RegisterSystem.Api.Controllers;

/// <summary>Granskningslogg – endast Root (t.ex. dataskyddsansvarig).</summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Root))]
[Route("api/audit")]
public class AuditController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<PagedResult<AuditLogDto>> List([FromQuery] string? action, [FromQuery] string? user,
        [FromQuery] string? entityId, [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        pageSize = Math.Clamp(pageSize, 1, 500);
        page = Math.Max(1, page);
        var q = db.AuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(a => a.Action == action);
        if (!string.IsNullOrWhiteSpace(user)) q = q.Where(a => a.UserEmail != null && a.UserEmail.Contains(user));
        if (!string.IsNullOrWhiteSpace(entityId)) q = q.Where(a => a.EntityId == entityId);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(a => a.At).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new AuditLogDto(a.Id, a.At, a.UserEmail, a.Action, a.EntityType, a.EntityId, a.Details, a.IpAddress))
            .ToListAsync();
        return new PagedResult<AuditLogDto>(items, total, page, pageSize);
    }
}
