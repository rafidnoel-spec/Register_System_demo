using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;

namespace RegisterSystem.Api.Services;

/// <summary>Filtrering av medlemmar inom användarens behörighetsområde. Används av listor, utskrift och e-post.</summary>
public class MemberQueryService(CurrentUser currentUser)
{
    public async Task<IQueryable<Member>> QueryAsync(MemberFilter f)
    {
        var q = await currentUser.MembersInScopeAsync();

        if (f.CountyId is { } county) q = q.Where(m => m.Church!.City!.CountyId == county);
        if (f.CityId is { } city) q = q.Where(m => m.Church!.CityId == city);
        if (f.ChurchId is { } church) q = q.Where(m => m.ChurchId == church);
        if (f.CivilStatus is { } cs) q = q.Where(m => m.CivilStatus == cs);
        if (f.Status is { } st) q = q.Where(m => m.Status == st);
        else q = q.Where(m => m.Status != MemberStatus.Pending); // väntande visas separat
        if (f.HasSacrament is { } has) q = q.Where(m => m.Sacraments.Any(s => s.Type == has));
        if (f.MissingSacrament is { } missing) q = q.Where(m => !m.Sacraments.Any(s => s.Type == missing));

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (f.MinAge is { } min) { var limit = today.AddYears(-min); q = q.Where(m => m.BirthDate <= limit); }
        if (f.MaxAge is { } max) { var limit = today.AddYears(-(max + 1)); q = q.Where(m => m.BirthDate > limit); }

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = f.Search.Trim();
            q = q.Where(m => (m.FirstName + " " + m.LastName).Contains(s) || m.PostalTown.Contains(s) || m.Street.Contains(s));
        }

        return f.SortBy switch
        {
            "birth" => q.OrderBy(m => m.BirthDate),
            "church" => q.OrderBy(m => m.Church!.Name).ThenBy(m => m.LastName).ThenBy(m => m.FirstName),
            "created" => q.OrderByDescending(m => m.CreatedAt),
            _ => q.OrderBy(m => m.LastName).ThenBy(m => m.FirstName)
        };
    }

    public static IQueryable<MemberListItem> Project(IQueryable<Member> q)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        return q.Select(m => new MemberListItem(
            m.Id, m.FirstName, m.LastName, "", m.BirthDate,
            today.Year - m.BirthDate.Year,
            m.Street, m.PostalCode, m.PostalTown, m.CivilStatus, m.Status,
            m.ChurchId, m.Church!.Name, m.Church.City!.Name, m.Source, m.PossibleDuplicateOfId, m.CreatedAt));
    }

    /// <summary>Fyller i maskerat personnummer och exakt ålder efter att data hämtats.</summary>
    public static MemberListItem Finish(MemberListItem m) =>
        m with { PersonnummerMasked = Personnummer.Mask(m.BirthDate), Age = AgeOn(m.BirthDate, DateOnly.FromDateTime(DateTime.Today)) };

    public static int AgeOn(DateOnly birth, DateOnly day)
    {
        var age = day.Year - birth.Year;
        if (day < birth.AddYears(age)) age--;
        return age;
    }
}
