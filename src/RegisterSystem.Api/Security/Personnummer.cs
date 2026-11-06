using System.Globalization;
using System.Text.RegularExpressions;

namespace RegisterSystem.Api.Security;

/// <summary>Validering och normalisering av svenska personnummer (och samordningsnummer).</summary>
public static partial class Personnummer
{
    [GeneratedRegex(@"^(\d{2})?(\d{2})(\d{2})(\d{2})([-+]?)(\d{4})$")]
    private static partial Regex Pattern();

    /// <summary>
    /// Normaliserar till 12 siffror (ÅÅÅÅMMDDNNNN). Returnerar false om formatet,
    /// datumet eller kontrollsiffran är fel.
    /// </summary>
    public static bool TryNormalize(string? input, out string normalized, out DateOnly birthDate)
    {
        normalized = "";
        birthDate = default;
        if (string.IsNullOrWhiteSpace(input)) return false;

        var m = Pattern().Match(input.Trim().Replace(" ", ""));
        if (!m.Success) return false;

        var yy = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
        var month = int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture);
        var day = int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture);
        var last4 = m.Groups[6].Value;

        int century;
        if (m.Groups[1].Success && m.Groups[1].Value.Length == 2)
        {
            century = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        }
        else
        {
            // 10-siffrigt: "+" betyder 100 år eller äldre.
            var now = DateTime.Today;
            var year = now.Year / 100 * 100 + yy;
            if (year > now.Year) year -= 100;
            if (m.Groups[5].Value == "+") year -= 100;
            century = year / 100;
        }

        var fullYear = century * 100 + yy;
        var realDay = day > 60 ? day - 60 : day; // samordningsnummer
        try
        {
            birthDate = new DateOnly(fullYear, month, realDay);
        }
        catch (ArgumentOutOfRangeException)
        {
            return false;
        }
        if (birthDate > DateOnly.FromDateTime(DateTime.Today)) return false;

        var ten = $"{yy:00}{month:00}{day:00}{last4}";
        if (!LuhnValid(ten)) return false;

        normalized = $"{fullYear:0000}{month:00}{day:00}{last4}";
        return true;
    }

    private static bool LuhnValid(string tenDigits)
    {
        var sum = 0;
        for (var i = 0; i < 10; i++)
        {
            var d = tenDigits[i] - '0';
            if (i % 2 == 0)
            {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
        }
        return sum % 10 == 0;
    }

    /// <summary>ÅÅÅÅMMDD-NNNN</summary>
    public static string Format(string normalized) =>
        normalized.Length == 12 ? $"{normalized[..8]}-{normalized[8..]}" : normalized;

    /// <summary>ÅÅÅÅMMDD-**** – visas i listor så att hela numret inte exponeras.</summary>
    public static string Mask(DateOnly birthDate) => $"{birthDate:yyyyMMdd}-****";
}
