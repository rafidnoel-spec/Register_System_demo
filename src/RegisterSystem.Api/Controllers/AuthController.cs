using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;
using RegisterSystem.Api.Services;

namespace RegisterSystem.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, IPasswordHasher<AppUser> hasher, JwtTokenService tokens,
    AuditService audit, CurrentUser currentUser) : ControllerBase
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Samma svar oavsett om kontot finns – avslöjar inte vilka e-postadresser som finns.
        var invalid = Unauthorized(new ProblemDetails { Title = "Fel e-post eller lösenord." });

        if (user is null || !user.IsActive)
        {
            hasher.HashPassword(new AppUser(), req.Password); // jämn svarstid
            return invalid;
        }

        if (user.LockoutEnd is { } end && end > DateTimeOffset.UtcNow)
            return StatusCode(StatusCodes.Status423Locked, new ProblemDetails { Title = "Kontot är tillfälligt låst. Försök igen senare." });

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedAttempts)
            {
                user.LockoutEnd = DateTimeOffset.UtcNow.Add(LockoutDuration);
                user.FailedLoginCount = 0;
            }
            await db.SaveChangesAsync();
            await audit.LogAsync("LoginFailed", nameof(AppUser), user.Id);
            return invalid;
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, req.Password);

        user.FailedLoginCount = 0;
        user.LockoutEnd = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var (token, expires) = tokens.Create(user);
        await audit.LogAsync("Login", nameof(AppUser), user.Id);
        var dto = await UsersController.ToDtoAsync(db, user);
        return new LoginResponse(token, expires, dto);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var u = await currentUser.GetAsync();
        return await UsersController.ToDtoAsync(db, u);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var me = await currentUser.GetAsync();
        var user = await db.Users.FirstAsync(u => u.Id == me.Id);
        if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest(new ProblemDetails { Title = "Nuvarande lösenord är fel." });

        user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
        await db.SaveChangesAsync();
        await audit.LogAsync("PasswordChanged", nameof(AppUser), user.Id);
        return NoContent();
    }
}
