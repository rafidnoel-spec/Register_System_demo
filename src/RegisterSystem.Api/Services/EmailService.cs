using System.Net;
using System.Net.Mail;

namespace RegisterSystem.Api.Services;

public class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string? UserName { get; set; }
    public string? Password { get; set; }
    public string FromAddress { get; set; } = "";
    public string FromName { get; set; } = "Församlingsregistret";
    /// <summary>
    /// Domäner som listor med personuppgifter får skickas till. Tom lista = bara till e-postadresser
    /// som tillhör aktiva användare i systemet. Förhindrar att personuppgifter skickas till okända mottagare.
    /// </summary>
    public List<string> AllowedRecipientDomains { get; set; } = [];
    /// <summary>Om satt skrivs mejl till denna mapp i stället för att skickas (för utveckling).</summary>
    public string? PickupDirectory { get; set; }
}

public record EmailAttachment(string FileName, byte[] Content, string ContentType);

public class EmailService(SmtpOptions options, ILogger<EmailService> logger)
{
    public async Task SendAsync(IEnumerable<string> to, string subject, string htmlBody, IEnumerable<EmailAttachment>? attachments = null)
    {
        using var msg = new MailMessage
        {
            From = new MailAddress(options.FromAddress, options.FromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        foreach (var r in to) msg.To.Add(r);
        foreach (var a in attachments ?? [])
            msg.Attachments.Add(new Attachment(new MemoryStream(a.Content), a.FileName, a.ContentType));

        using var client = new SmtpClient();
        if (!string.IsNullOrEmpty(options.PickupDirectory))
        {
            Directory.CreateDirectory(options.PickupDirectory);
            client.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
            client.PickupDirectoryLocation = Path.GetFullPath(options.PickupDirectory);
        }
        else
        {
            client.Host = options.Host;
            client.Port = options.Port;
            client.EnableSsl = options.EnableSsl;
            if (!string.IsNullOrEmpty(options.UserName))
                client.Credentials = new NetworkCredential(options.UserName, options.Password);
        }

        await client.SendMailAsync(msg);
        logger.LogInformation("E-post skickad till {Count} mottagare", msg.To.Count);
    }
}
