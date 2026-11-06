using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Services;

/// <summary>
/// Lagringsminimering (GDPR art. 5.1 e): raderar automatiskt gamla ej godkända registreringar
/// och granskningsloggar äldre än konfigurerad tid. Körs en gång per dygn.
/// </summary>
public class RetentionService(IServiceScopeFactory scopes, PrivacyOptions options, ILogger<RetentionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Gallring misslyckades");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pendingCutoff = DateTimeOffset.UtcNow.AddDays(-options.PendingRetentionDays);
        var oldPending = db.Members.Where(m => m.Status == MemberStatus.Pending && m.CreatedAt < pendingCutoff);
        var ids = await oldPending.Select(m => m.Id).ToListAsync(ct);
        if (ids.Count > 0)
        {
            await db.Relations.Where(r => ids.Contains(r.MemberId) || ids.Contains(r.RelatedMemberId)).ExecuteDeleteAsync(ct);
            await db.Sacraments.Where(s => s.SpouseMemberId != null && ids.Contains(s.SpouseMemberId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.SpouseMemberId, (int?)null), ct);
            await db.Sacraments.Where(s => ids.Contains(s.MemberId)).ExecuteDeleteAsync(ct);
            await db.Consents.Where(c => ids.Contains(c.MemberId)).ExecuteDeleteAsync(ct);
            await db.Members.Where(m => m.PossibleDuplicateOfId != null && ids.Contains(m.PossibleDuplicateOfId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.PossibleDuplicateOfId, (int?)null), ct);
            await oldPending.ExecuteDeleteAsync(ct);
            db.AuditLogs.Add(new AuditLog { Action = "RetentionPendingDeleted", EntityType = nameof(Member), Details = $"{ids.Count} registreringar" });
        }

        var auditCutoff = DateTimeOffset.UtcNow.AddDays(-options.AuditRetentionDays);
        var removedLogs = await db.AuditLogs.Where(a => a.At < auditCutoff).ExecuteDeleteAsync(ct);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Gallring klar: {Pending} väntande registreringar, {Logs} loggposter", ids.Count, removedLogs);
    }
}
