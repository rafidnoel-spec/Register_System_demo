using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Security;

/// <summary>
/// Den inloggade användaren och dess behörighetsområde (scope).
/// Root ser allt, Län ser alla städer/kyrkor i länet, Stad ser kyrkorna i staden, Kyrka ser sin kyrka.
/// </summary>
public class CurrentUser(IHttpContextAccessor http, AppDbContext db)
{
    private AppUser? _user;
    private bool _loaded;

    public async Task<AppUser> GetAsync()
    {
        if (!_loaded)
        {
            _loaded = true;
            var idClaim = http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idClaim, out var id))
                _user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id && u.IsActive);
        }
        return _user ?? throw new UnauthorizedAccessException("Användaren är inte inloggad eller är inaktiverad.");
    }

    /// <summary>Kyrkor som användaren har åtkomst till.</summary>
    public async Task<IQueryable<Church>> ChurchesInScopeAsync()
    {
        var u = await GetAsync();
        var q = db.Churches.AsQueryable();
        return u.Role switch
        {
            UserRole.Root => q,
            UserRole.County => q.Where(c => c.City!.CountyId == u.CountyId),
            UserRole.City => q.Where(c => c.CityId == u.CityId),
            UserRole.Church => q.Where(c => c.Id == u.ChurchId),
            _ => q.Where(_ => false)
        };
    }

    public async Task<IQueryable<City>> CitiesInScopeAsync()
    {
        var u = await GetAsync();
        var q = db.Cities.AsQueryable();
        return u.Role switch
        {
            UserRole.Root => q,
            UserRole.County => q.Where(c => c.CountyId == u.CountyId),
            UserRole.City => q.Where(c => c.Id == u.CityId),
            UserRole.Church => q.Where(c => c.Churches.Any(ch => ch.Id == u.ChurchId)),
            _ => q.Where(_ => false)
        };
    }

    public async Task<IQueryable<County>> CountiesInScopeAsync()
    {
        var u = await GetAsync();
        var q = db.Counties.AsQueryable();
        return u.Role switch
        {
            UserRole.Root => q,
            UserRole.County => q.Where(c => c.Id == u.CountyId),
            UserRole.City => q.Where(c => c.Cities.Any(ci => ci.Id == u.CityId)),
            UserRole.Church => q.Where(c => c.Cities.Any(ci => ci.Churches.Any(ch => ch.Id == u.ChurchId))),
            _ => q.Where(_ => false)
        };
    }

    public async Task<IQueryable<Member>> MembersInScopeAsync()
    {
        var u = await GetAsync();
        var q = db.Members.AsQueryable();
        return u.Role switch
        {
            UserRole.Root => q,
            UserRole.County => q.Where(m => m.Church!.City!.CountyId == u.CountyId),
            UserRole.City => q.Where(m => m.Church!.CityId == u.CityId),
            UserRole.Church => q.Where(m => m.ChurchId == u.ChurchId),
            _ => q.Where(_ => false)
        };
    }

    public async Task<bool> CanAccessChurchAsync(int churchId) =>
        await (await ChurchesInScopeAsync()).AnyAsync(c => c.Id == churchId);

    public async Task<bool> CanAccessCityAsync(int cityId) =>
        await (await CitiesInScopeAsync()).AnyAsync(c => c.Id == cityId);

    public async Task<bool> CanAccessMemberAsync(int memberId) =>
        await (await MembersInScopeAsync()).AnyAsync(m => m.Id == memberId);

    /// <summary>Får användaren hantera (skapa/ändra) en organisationsenhet på angiven nivå?</summary>
    public async Task<bool> CanManageLevelAsync(UserRole level) => (await GetAsync()).Role < level || (await GetAsync()).Role == UserRole.Root;
}
