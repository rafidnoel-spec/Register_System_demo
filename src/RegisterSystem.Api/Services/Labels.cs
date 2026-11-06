using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Services;

/// <summary>Svenska etiketter för uppräkningar (används i e-post och CSV).</summary>
public static class Labels
{
    public static string Civil(CivilStatus s) => s switch
    {
        Domain.CivilStatus.Unmarried => "Ogift",
        Domain.CivilStatus.Married => "Gift",
        Domain.CivilStatus.Divorced => "Skild",
        Domain.CivilStatus.Widowed => "Änka/änkling",
        Domain.CivilStatus.Separated => "Separerad",
        _ => s.ToString()
    };

    public static string Status(MemberStatus s) => s switch
    {
        Domain.MemberStatus.Pending => "Väntar på godkännande",
        Domain.MemberStatus.Active => "Aktiv",
        Domain.MemberStatus.Inactive => "Inaktiv",
        Domain.MemberStatus.Deceased => "Avliden",
        _ => s.ToString()
    };

    public static string Sacrament(SacramentType s) => s switch
    {
        SacramentType.Baptism => "dop",
        SacramentType.FirstCommunion => "första kommunion",
        SacramentType.Confirmation => "konfirmation",
        SacramentType.Marriage => "vigsel",
        SacramentType.Ordination => "prästvigning",
        SacramentType.AnointingOfSick => "de sjukas smörjelse",
        SacramentType.Funeral => "begravning",
        _ => s.ToString()
    };
}
