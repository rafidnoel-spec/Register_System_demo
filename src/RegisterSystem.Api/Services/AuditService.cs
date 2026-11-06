using System.Security.Claims;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Services;

/// <summary>
/// Loggar åtkomst till och ändringar av personuppgifter (GDPR art. 5.2 ansvarsskyldighet, art. 32 säkerhet).
/// Skriv aldrig personnummer eller annan känslig klartext i Details.
/// </summary>
public class AuditService(AppDbContext db, IHttpContextAccessor http)
{
    public async Task LogAsync(string action, string entityType, object? entityId = null, string? details = null)
    {
        var ctx = http.HttpContext;
        var user = ctx?.User;
        int? userId = int.TryParse(user?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            UserEmail = user?.FindFirstValue(ClaimTypes.Email),
            Action = action,
            EntityType = entityType,
            EntityId = entityId?.ToString(),
            Details = details is { Length: > 1000 } ? details[..1000] : details,
            IpAddress = ctx?.Connection.RemoteIpAddress?.ToString()
        });
        await db.SaveChangesAsync();
    }
}
