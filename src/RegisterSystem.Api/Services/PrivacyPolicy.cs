using System.Net;
using RegisterSystem.Api.Dtos;

namespace RegisterSystem.Api.Services;

public class PrivacyOptions
{
    /// <summary>Höj versionen när texten ändras – samtycken sparas med versionen.</summary>
    public string Version { get; set; } = "1.0";
    public string ControllerName { get; set; } = "Kaldeisk-katolska missionen i Sverige";
    public string ControllerOrgNumber { get; set; } = "";
    public string ContactEmail { get; set; } = "";
    public string? DataProtectionOfficerEmail { get; set; }
    /// <summary>Hur länge väntande (ej godkända) registreringar sparas innan de raderas automatiskt.</summary>
    public int PendingRetentionDays { get; set; } = 90;
    /// <summary>Hur länge granskningsloggen sparas.</summary>
    public int AuditRetentionDays { get; set; } = 730;
}

/// <summary>
/// Informationstext enligt GDPR art. 13 som visas vid registrering. Texten är ett utkast och
/// ska granskas av den personuppgiftsansvarige innan systemet tas i drift.
/// </summary>
public class PrivacyPolicy(PrivacyOptions o)
{
    public PrivacyPolicyDto Get()
    {
        string E(string? s) => WebUtility.HtmlEncode(s ?? "");
        var dpo = string.IsNullOrWhiteSpace(o.DataProtectionOfficerEmail)
            ? ""
            : $"<p>Dataskyddsombud: <a href=\"mailto:{E(o.DataProtectionOfficerEmail)}\">{E(o.DataProtectionOfficerEmail)}</a></p>";

        var html = $"""
            <h2>Så behandlar vi dina personuppgifter</h2>
            <p><strong>Personuppgiftsansvarig:</strong> {E(o.ControllerName)}{(string.IsNullOrWhiteSpace(o.ControllerOrgNumber) ? "" : $", org.nr {E(o.ControllerOrgNumber)}")}.
            Kontakt: <a href="mailto:{E(o.ContactEmail)}">{E(o.ContactEmail)}</a>.</p>
            {dpo}
            <h3>Varför vi behandlar uppgifterna</h3>
            <p>Vi för ett medlemsregister för att kunna administrera medlemskap i församlingen, föra kyrkobok över
            sakrament (t.ex. dop, konfirmation och vigsel), kontakta medlemmar och planera församlingens verksamhet.</p>
            <h3>Vilka uppgifter</h3>
            <p>Namn, adress, personnummer, civilstånd, vilken kyrka du tillhör samt – om du anger dem – e-post och telefon.
            Uppgift om medlemskap i ett trossamfund räknas som en känslig personuppgift (art. 9).</p>
            <h3>Rättslig grund</h3>
            <p>Behandlingen sker med stöd av ditt uttryckliga samtycke (art. 6.1 a och 9.2 a) samt art. 9.2 d, som tillåter
            trossamfund att behandla uppgifter om sina medlemmar. Personnumret används för att säkert kunna identifiera dig
            och undvika förväxlingar (3 kap. 10 § dataskyddslagen).</p>
            <h3>Vem får tillgång</h3>
            <p>Endast behöriga administratörer för din kyrka, stad eller län. Uppgifterna säljs aldrig och lämnas inte ut
            till tredje part utöver vad lag kräver. Personnumret lagras krypterat och all åtkomst loggas.</p>
            <h3>Hur länge</h3>
            <p>Så länge du är medlem. En registrering som inte godkänns raderas efter {o.PendingRetentionDays} dagar.
            Uppgifter om sakrament kan bevaras längre som kyrkobok om det krävs, vilket du informeras om om du begär radering.</p>
            <h3>Dina rättigheter</h3>
            <p>Du har rätt att få ett registerutdrag, få felaktiga uppgifter rättade, få uppgifterna raderade, begränsa
            behandlingen, få ut dina uppgifter (dataportabilitet) och när som helst återkalla ditt samtycke.
            Kontakta oss på adressen ovan. Du har också rätt att klaga hos Integritetsskyddsmyndigheten (IMY), www.imy.se.</p>
            """;

        return new PrivacyPolicyDto(o.Version, o.ControllerName, o.ContactEmail, html);
    }
}
