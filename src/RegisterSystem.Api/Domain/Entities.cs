namespace RegisterSystem.Api.Domain;

/// <summary>Behörighetsnivå. Lägre värde = högre behörighet.</summary>
public enum UserRole
{
    Root = 0,
    County = 1,  // Län
    City = 2,    // Stad
    Church = 3   // Kyrka
}

public enum CivilStatus
{
    Unmarried = 0,  // Ogift
    Married = 1,    // Gift
    Divorced = 2,   // Skild
    Widowed = 3,    // Änka/Änkling
    Separated = 4   // Separerad
}

public enum MemberStatus
{
    Pending = 0,   // Väntar på godkännande (självregistrerad)
    Active = 1,
    Inactive = 2,
    Deceased = 3
}

public enum RegistrationSource
{
    Admin = 0,
    PublicWeb = 1,
    Kiosk = 2
}

public enum RelationType
{
    Spouse = 0,    // Make/maka
    Parent = 1,    // Member är förälder till RelatedMember
    Godparent = 2  // Member är gudförälder till RelatedMember
}

public enum SacramentType
{
    Baptism = 0,         // Dop
    FirstCommunion = 1,  // Första kommunion
    Confirmation = 2,    // Konfirmation / Myron
    Marriage = 3,        // Vigsel
    Ordination = 4,      // Prästvigning
    AnointingOfSick = 5, // De sjukas smörjelse
    Funeral = 6          // Begravning
}

public class County
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<City> Cities { get; set; } = [];
}

public class City
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int CountyId { get; set; }
    public County? County { get; set; }
    public List<Church> Churches { get; set; } = [];
}

public class Church
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Address { get; set; }
    public int CityId { get; set; }
    public City? City { get; set; }
    /// <summary>Om kyrkan visas i den publika registreringen.</summary>
    public bool AcceptsPublicRegistration { get; set; } = true;
    /// <summary>Hemlig kod som ingår i kiosk-länken för surfplattan vid dörren.</summary>
    public string KioskCode { get; set; } = "";
}

public class Priest
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int? ChurchId { get; set; }
    public Church? Church { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AppUser
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public int? CountyId { get; set; }
    public County? County { get; set; }
    public int? CityId { get; set; }
    public City? City { get; set; }
    public int? ChurchId { get; set; }
    public Church? Church { get; set; }
    public bool IsActive { get; set; } = true;
    public int FailedLoginCount { get; set; }
    public DateTimeOffset? LockoutEnd { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }
}

public class Member
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Street { get; set; } = "";
    public string PostalCode { get; set; } = "";
    public string PostalTown { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }

    /// <summary>Personnummer krypterat med AES-256-GCM. Klartext lagras aldrig.</summary>
    public string PersonnummerEncrypted { get; set; } = "";
    /// <summary>HMAC-SHA256 av normaliserat personnummer – för dubblettkontroll utan dekryptering.</summary>
    public string PersonnummerHash { get; set; } = "";
    /// <summary>Härleds från personnumret, används för åldersfilter.</summary>
    public DateOnly BirthDate { get; set; }

    public CivilStatus CivilStatus { get; set; }
    public MemberStatus Status { get; set; } = MemberStatus.Pending;
    public RegistrationSource Source { get; set; }

    public int ChurchId { get; set; }
    public Church? Church { get; set; }

    public string? Notes { get; set; }
    /// <summary>Satt om en självregistrering matchar ett befintligt personnummer.</summary>
    public int? PossibleDuplicateOfId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<SacramentEvent> Sacraments { get; set; } = [];
    public List<ConsentRecord> Consents { get; set; } = [];
}

public class MemberRelation
{
    public int Id { get; set; }
    public int MemberId { get; set; }
    public Member? Member { get; set; }
    public int RelatedMemberId { get; set; }
    public Member? RelatedMember { get; set; }
    public RelationType Type { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}

public class SacramentEvent
{
    public int Id { get; set; }
    public int MemberId { get; set; }
    public Member? Member { get; set; }
    public SacramentType Type { get; set; }
    public DateOnly Date { get; set; }

    /// <summary>Kyrka i systemet – eller fritext om den skedde någon annanstans.</summary>
    public int? ChurchId { get; set; }
    public Church? Church { get; set; }
    public string? ChurchNameOther { get; set; }

    public int? PriestId { get; set; }
    public Priest? Priest { get; set; }
    public string? PriestNameOther { get; set; }

    /// <summary>Vid vigsel: make/maka.</summary>
    public int? SpouseMemberId { get; set; }
    public Member? SpouseMember { get; set; }

    public string? Godparents { get; set; }
    public string? RegisterReference { get; set; } // t.ex. bok/sida i kyrkoboken
    public string? Notes { get; set; }
}

public class ConsentRecord
{
    public int Id { get; set; }
    public int MemberId { get; set; }
    public Member? Member { get; set; }
    public string PolicyVersion { get; set; } = "";
    public string Purpose { get; set; } = "";
    public DateTimeOffset GivenAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? WithdrawnAt { get; set; }
    public RegistrationSource Source { get; set; }
}

public class AuditLog
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    /// <summary>Beskrivning – får INTE innehålla personnummer eller annan känslig klartext.</summary>
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}
