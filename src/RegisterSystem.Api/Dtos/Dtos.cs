using System.ComponentModel.DataAnnotations;
using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Dtos;

// ---------- Auth ----------
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public record LoginResponse(string Token, DateTime ExpiresUtc, UserDto User);
public record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(12)] string NewPassword);

// ---------- Hierarki ----------
public record CountyDto(int Id, string Name, int CityCount);
public record CountyUpsert([Required, MaxLength(100)] string Name);

public record CityDto(int Id, string Name, int CountyId, string CountyName, int ChurchCount);
public record CityUpsert([Required, MaxLength(100)] string Name, int CountyId);

public record ChurchDto(int Id, string Name, string? Address, int CityId, string CityName, int CountyId, string CountyName,
    bool AcceptsPublicRegistration, string KioskCode, int MemberCount);
public record ChurchUpsert([Required, MaxLength(150)] string Name, [MaxLength(200)] string? Address, int CityId, bool AcceptsPublicRegistration = true);

public record PriestDto(int Id, string Name, int? ChurchId, string? ChurchName, bool IsActive);
public record PriestUpsert([Required, MaxLength(150)] string Name, int? ChurchId, bool IsActive = true);

// ---------- Användare ----------
public record UserDto(int Id, string Email, string DisplayName, UserRole Role, int? CountyId, int? CityId, int? ChurchId,
    string? ScopeName, bool IsActive, DateTimeOffset? LastLoginAt);
public record UserCreate([Required, EmailAddress] string Email, [Required, MaxLength(150)] string DisplayName,
    [Required, MinLength(12)] string Password, UserRole Role, int? CountyId, int? CityId, int? ChurchId);
public record UserUpdate([Required, MaxLength(150)] string DisplayName, UserRole Role, int? CountyId, int? CityId, int? ChurchId,
    bool IsActive, [MinLength(12)] string? NewPassword);

// ---------- Medlemmar ----------
public record MemberListItem(int Id, string FirstName, string LastName, string PersonnummerMasked, DateOnly BirthDate, int Age,
    string Street, string PostalCode, string PostalTown, CivilStatus CivilStatus, MemberStatus Status,
    int ChurchId, string ChurchName, string CityName, RegistrationSource Source, int? PossibleDuplicateOfId, DateTimeOffset CreatedAt);

public record MemberDetail(int Id, string FirstName, string LastName, string PersonnummerMasked, DateOnly BirthDate,
    string Street, string PostalCode, string PostalTown, string? Email, string? Phone, CivilStatus CivilStatus,
    MemberStatus Status, int ChurchId, string ChurchName, string? Notes, RegistrationSource Source, int? PossibleDuplicateOfId,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    List<RelationDto> Relations, List<SacramentDto> Sacraments, List<ConsentDto> Consents);

public record MemberUpsert(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [MaxLength(200)] string Street,
    [MaxLength(10)] string PostalCode,
    [MaxLength(100)] string PostalTown,
    [EmailAddress, MaxLength(256)] string? Email,
    [MaxLength(30)] string? Phone,
    // Krävs vid skapande. Vid uppdatering: null = oförändrat.
    string? Personnummer,
    CivilStatus CivilStatus,
    MemberStatus Status,
    int ChurchId,
    [MaxLength(2000)] string? Notes);

public class MemberFilter
{
    public int? CountyId { get; set; }
    public int? CityId { get; set; }
    public int? ChurchId { get; set; }
    public CivilStatus? CivilStatus { get; set; }
    public MemberStatus? Status { get; set; }
    public SacramentType? HasSacrament { get; set; }
    public SacramentType? MissingSacrament { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public string? Search { get; set; }
    public string? SortBy { get; set; } // name | birth | church | created
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);

public record MemberLookupDto(int Id, string Name, DateOnly BirthDate, string Church);

public record RevealPersonnummerRequest([Required, MinLength(5), MaxLength(300)] string Reason);
public record RevealPersonnummerResponse(string Personnummer);

// ---------- Relationer ----------
public record RelationDto(int Id, RelationType Type, string Direction, int OtherMemberId, string OtherMemberName, DateOnly? FromDate, DateOnly? ToDate);
public record RelationCreate(int MemberId, int RelatedMemberId, RelationType Type, DateOnly? FromDate, DateOnly? ToDate);

// ---------- Sakrament ----------
public record SacramentDto(int Id, int MemberId, SacramentType Type, DateOnly Date, int? ChurchId, string? ChurchName,
    int? PriestId, string? PriestName, int? SpouseMemberId, string? SpouseName, string? Godparents, string? RegisterReference, string? Notes);
public record SacramentUpsert(int MemberId, SacramentType Type, DateOnly Date, int? ChurchId, [MaxLength(150)] string? ChurchNameOther,
    int? PriestId, [MaxLength(150)] string? PriestNameOther, int? SpouseMemberId, [MaxLength(300)] string? Godparents,
    [MaxLength(100)] string? RegisterReference, [MaxLength(2000)] string? Notes);

public record ConsentDto(int Id, string PolicyVersion, string Purpose, DateTimeOffset GivenAt, DateTimeOffset? WithdrawnAt, RegistrationSource Source);

// ---------- Publik registrering ----------
public record PublicChurchDto(int Id, string Name, string CityName, string CountyName);
public record KioskChurchDto(int Id, string Name, string CityName);

public record PublicRegistrationRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required, MaxLength(200)] string Street,
    [Required, MaxLength(10)] string PostalCode,
    [Required, MaxLength(100)] string PostalTown,
    [EmailAddress, MaxLength(256)] string? Email,
    [MaxLength(30)] string? Phone,
    [Required] string Personnummer,
    CivilStatus CivilStatus,
    int ChurchId,
    bool ConsentGiven,
    [Required] string PolicyVersion,
    // Honeypot – ska alltid vara tom. Fylls i av bottar.
    string? Website,
    // Endast kiosk: kyrkans kioskkod.
    string? KioskCode);

public record PrivacyPolicyDto(string Version, string Controller, string ContactEmail, string Html);

// ---------- Rapporter ----------
public record EmailListRequest(MemberFilter Filter, [Required, MinLength(1)] List<string> Recipients,
    [Required, MaxLength(200)] string Subject, [MaxLength(2000)] string? Message, List<string>? Columns);

public record FamilyMember(int Id, string Name, string Role, DateOnly BirthDate, CivilStatus CivilStatus, string ChurchName, List<SacramentDto> Sacraments);
public record FamilyReport(FamilyMember Head, List<FamilyMember> Spouses, List<FamilyMember> Children, List<FamilyMember> Parents,
    string Address, DateTimeOffset GeneratedAt, string GeneratedBy);

public record AuditLogDto(long Id, DateTimeOffset At, string? UserEmail, string Action, string EntityType, string? EntityId, string? Details, string? IpAddress);
