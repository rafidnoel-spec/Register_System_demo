using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Security;

public class JwtOptions
{
    public string Issuer { get; set; } = "RegisterSystem";
    public string Audience { get; set; } = "RegisterSystem.Admin";
    /// <summary>Minst 256 bitar. Läggs i user-secrets / Key Vault, aldrig i källkoden.</summary>
    public string SigningKey { get; set; } = "";
    public int LifetimeMinutes { get; set; } = 60;
}

public class JwtTokenService(JwtOptions options)
{
    public (string Token, DateTime ExpiresUtc) Create(AppUser user)
    {
        var expires = DateTime.UtcNow.AddMinutes(options.LifetimeMinutes);
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            Expires = expires,
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.DisplayName),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            ]),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)),
                SecurityAlgorithms.HmacSha256)
        };
        return (new JsonWebTokenHandler().CreateToken(descriptor), expires);
    }
}
