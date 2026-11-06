using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
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
[Route("api/users")]
public class UsersController(AppDbContext db, CurrentUser currentUser, IPasswordHasher<AppUser> hasher, AuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> List()
    {
        var me = await currentUser.GetAsync();
        if (me.Role == UserRole.Church) return Forbid();

        var users = await (await UsersInScopeAsync(me)).OrderBy(u => u.Role).ThenBy(u => u.DisplayName).ToListAsync();
        var result = new List<UserDto>();
        foreach (var u in users) result.Add(await ToDtoAsync(db, u));
        return result;
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(UserCreate req)
    {
        var me = await currentUser.GetAsync();
        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new ProblemDetails { Title = "E-postadressen används redan." });

        var user = new AppUser { Email = email, DisplayName = req.DisplayName.Trim() };
        var error = await ApplyRoleAsync(me, user, req.Role, req.CountyId, req.CityId, req.ChurchId);
        if (error is not null) return error;

        user.PasswordHash = hasher.HashPassword(user, req.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        await audit.LogAsync("UserCreated", nameof(AppUser), user.Id, $"Roll {user.Role}");
        return await ToDtoAsync(db, user);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserDto>> Update(int id, UserUpdate req)
    {
        var me = await currentUser.GetAsync();
        var user = await (await UsersInScopeAsync(me)).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();
        if (user.Id == me.Id && (req.Role != me.Role || !req.IsActive))
            return BadRequest(new ProblemDetails { Title = "Du kan inte ändra din egen roll eller inaktivera dig själv." });
        if (user.Role < me.Role || (user.Role == UserRole.Root && me.Role != UserRole.Root))
            return Forbid();

        user.DisplayName = req.DisplayName.Trim();
        user.IsActive = req.IsActive;
        var error = await ApplyRoleAsync(me, user, req.Role, req.CountyId, req.CityId, req.ChurchId);
        if (error is not null) return error;

        if (!string.IsNullOrEmpty(req.NewPassword))
        {
            user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
            user.FailedLoginCount = 0;
            user.LockoutEnd = null;
        }
        await db.SaveChangesAsync();
        await audit.LogAsync("UserUpdated", nameof(AppUser), user.Id, $"Roll {user.Role}, aktiv {user.IsActive}");
        return await ToDtoAsync(db, user);
    }

    private async Task<ActionResult?> ApplyRoleAsync(AppUser me, AppUser user, UserRole role, int? countyId, int? cityId, int? churchId)
    {
        // Man kan bara skapa användare på sin egen nivå eller lägre, och bara Root kan skapa Root.
        if (role < me.Role || (role == UserRole.Root && me.Role != UserRole.Root))
            return Forbid();

        user.Role = role;
        user.CountyId = user.CityId = user.ChurchId = null;
        switch (role)
        {
            case UserRole.Root:
                break;
            case UserRole.County:
                if (countyId is null || !await (await currentUser.CountiesInScopeAsync()).AnyAsync(c => c.Id == countyId))
                    return BadRequest(new ProblemDetails { Title = "Välj ett län inom din behörighet." });
                if (me.Role == UserRole.County && countyId != me.CountyId) return Forbid();
                user.CountyId = countyId;
                break;
            case UserRole.City:
                if (cityId is null || !await currentUser.CanAccessCityAsync(cityId.Value))
                    return BadRequest(new ProblemDetails { Title = "Välj en stad inom din behörighet." });
                user.CityId = cityId;
                break;
            case UserRole.Church:
                if (churchId is null || !await currentUser.CanAccessChurchAsync(churchId.Value))
                    return BadRequest(new ProblemDetails { Title = "Välj en kyrka inom din behörighet." });
                user.ChurchId = churchId;
                break;
        }
        return null;
    }

    private async Task<IQueryable<AppUser>> UsersInScopeAsync(AppUser me)
    {
        var q = db.Users.AsQueryable();
        if (me.Role == UserRole.Root) return q;

        var churchIds = (await currentUser.ChurchesInScopeAsync()).Select(c => c.Id);
        return me.Role switch
        {
            UserRole.County => q.Where(u => u.CountyId == me.CountyId
                || (u.CityId != null && db.Cities.Any(c => c.Id == u.CityId && c.CountyId == me.CountyId))
                || (u.ChurchId != null && churchIds.Contains(u.ChurchId.Value))),
            UserRole.City => q.Where(u => u.CityId == me.CityId
                || (u.ChurchId != null && churchIds.Contains(u.ChurchId.Value))),
            _ => q.Where(u => u.Id == me.Id)
        };
    }

    internal static async Task<UserDto> ToDtoAsync(AppDbContext db, AppUser u)
    {
        string? scope = u.Role switch
        {
            UserRole.Root => "Hela organisationen",
            UserRole.County => await db.Counties.Where(c => c.Id == u.CountyId).Select(c => c.Name).FirstOrDefaultAsync(),
            UserRole.City => await db.Cities.Where(c => c.Id == u.CityId).Select(c => c.Name).FirstOrDefaultAsync(),
            UserRole.Church => await db.Churches.Where(c => c.Id == u.ChurchId).Select(c => c.Name).FirstOrDefaultAsync(),
            _ => null
        };
        return new UserDto(u.Id, u.Email, u.DisplayName, u.Role, u.CountyId, u.CityId, u.ChurchId, scope, u.IsActive, u.LastLoginAt);
    }
}
