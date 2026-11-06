using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Security;

namespace RegisterSystem.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration config, bool isDevelopment)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("Seed");

        if (db.Database.GetMigrations().Any())
            await db.Database.MigrateAsync();
        else
            await db.Database.EnsureCreatedAsync(); // innan första migreringen skapats

        if (!await db.Users.AnyAsync())
        {
            var email = config["Seed:RootEmail"];
            var password = config["Seed:RootPassword"];
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                logger.LogWarning("Ingen användare finns. Sätt Seed:RootEmail och Seed:RootPassword för att skapa root-kontot.");
            }
            else
            {
                var hasher = services.GetRequiredService<IPasswordHasher<AppUser>>();
                var root = new AppUser { Email = email.Trim().ToLowerInvariant(), DisplayName = "Systemadministratör", Role = UserRole.Root };
                root.PasswordHash = hasher.HashPassword(root, password);
                db.Users.Add(root);
                await db.SaveChangesAsync();
                logger.LogInformation("Root-konto skapat för {Email}. Byt lösenord efter första inloggningen.", root.Email);
            }
        }

        if (isDevelopment && config.GetValue<bool>("Seed:DemoData") && !await db.Counties.AnyAsync())
            await SeedDemoAsync(db, services.GetRequiredService<PersonnummerProtector>());
    }

    /// <summary>Fiktiva exempeldata för utveckling. Personnumren är påhittade men har giltig kontrollsiffra.</summary>
    private static async Task SeedDemoAsync(AppDbContext db, PersonnummerProtector protector)
    {
        var county = new County { Name = "Stockholms län" };
        var city = new City { Name = "Södertälje", County = county };
        var church = new Church { Name = "Exempelkyrkan Södertälje", Address = "Kyrkvägen 1, 151 00 Södertälje", City = city, KioskCode = Code() };
        var church2 = new Church { Name = "Exempelkyrkan Järna", City = city, KioskCode = Code() };
        var priest = new Priest { Name = "Fader Exempel", Church = church };
        db.AddRange(county, city, church, church2, priest);
        await db.SaveChangesAsync();

        Member M(string first, string last, string yyyymmdd, string serial, CivilStatus cs)
        {
            var pnr = yyyymmdd + serial + Check(yyyymmdd[2..] + serial);
            Personnummer.TryNormalize(pnr, out var norm, out var birth);
            return new Member
            {
                FirstName = first, LastName = last, Street = "Exempelgatan 5", PostalCode = "15130", PostalTown = "Södertälje",
                PersonnummerEncrypted = protector.Encrypt(norm), PersonnummerHash = protector.Hash(norm), BirthDate = birth,
                CivilStatus = cs, Status = MemberStatus.Active, Source = RegistrationSource.Admin, ChurchId = church.Id
            };
        }

        var father = M("Yousef", "Exempelsson", "19780312", "123", CivilStatus.Married);
        var mother = M("Maryam", "Exempelsson", "19810605", "246", CivilStatus.Married);
        var son = M("Daniel", "Exempelsson", "20080915", "135", CivilStatus.Unmarried);
        var daughter = M("Sara", "Exempelsson", "20120120", "248", CivilStatus.Unmarried);
        db.Members.AddRange(father, mother, son, daughter);
        await db.SaveChangesAsync();

        db.Relations.AddRange(
            new MemberRelation { MemberId = father.Id, RelatedMemberId = mother.Id, Type = RelationType.Spouse, FromDate = new DateOnly(2006, 6, 10) },
            new MemberRelation { MemberId = father.Id, RelatedMemberId = son.Id, Type = RelationType.Parent },
            new MemberRelation { MemberId = mother.Id, RelatedMemberId = son.Id, Type = RelationType.Parent },
            new MemberRelation { MemberId = father.Id, RelatedMemberId = daughter.Id, Type = RelationType.Parent },
            new MemberRelation { MemberId = mother.Id, RelatedMemberId = daughter.Id, Type = RelationType.Parent });

        db.Sacraments.AddRange(
            new SacramentEvent { MemberId = father.Id, Type = SacramentType.Marriage, Date = new DateOnly(2006, 6, 10), ChurchId = church.Id, PriestId = priest.Id, SpouseMemberId = mother.Id },
            new SacramentEvent { MemberId = son.Id, Type = SacramentType.Baptism, Date = new DateOnly(2008, 11, 2), ChurchId = church.Id, PriestId = priest.Id, Godparents = "Exempel Gudfar" },
            new SacramentEvent { MemberId = son.Id, Type = SacramentType.FirstCommunion, Date = new DateOnly(2017, 5, 14), ChurchId = church.Id, PriestId = priest.Id },
            new SacramentEvent { MemberId = daughter.Id, Type = SacramentType.Baptism, Date = new DateOnly(2012, 3, 18), ChurchId = church.Id, PriestId = priest.Id });
        await db.SaveChangesAsync();
    }

    private static string Code() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

    /// <summary>Luhn-kontrollsiffra för de nio första siffrorna (ÅÅMMDDNNN).</summary>
    private static string Check(string nine)
    {
        var sum = 0;
        for (var i = 0; i < 9; i++)
        {
            var d = (nine[i] - '0') * (i % 2 == 0 ? 2 : 1);
            sum += d > 9 ? d - 9 : d;
        }
        return ((10 - sum % 10) % 10).ToString();
    }
}
