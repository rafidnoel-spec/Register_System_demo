using System.Security.Cryptography;
using System.Text;

namespace RegisterSystem.Api.Security;

public class EncryptionOptions
{
    /// <summary>Aktuell nyckelversion som används vid kryptering, t.ex. "v1".</summary>
    public string CurrentKeyId { get; set; } = "v1";
    /// <summary>Nyckelversion -> Base64-kodad 256-bitars AES-nyckel. Gamla versioner behålls för dekryptering.</summary>
    public Dictionary<string, string> Keys { get; set; } = [];
    /// <summary>Base64-kodad nyckel (minst 256 bitar) för HMAC (dubblettindex).</summary>
    public string HmacKey { get; set; } = "";
}

/// <summary>
/// Krypterar personnummer med AES-256-GCM (autentiserad kryptering).
/// Format: "{keyId}:{base64(nonce[12] | tag[16] | ciphertext)}".
/// Nycklarna får aldrig ligga i källkoden – använd user-secrets, miljövariabler eller Azure Key Vault.
/// </summary>
public class PersonnummerProtector
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly string _currentKeyId;
    private readonly Dictionary<string, byte[]> _keys;
    private readonly byte[] _hmacKey;

    public PersonnummerProtector(EncryptionOptions options)
    {
        _currentKeyId = options.CurrentKeyId;
        _keys = options.Keys.ToDictionary(k => k.Key, k => Convert.FromBase64String(k.Value));
        _hmacKey = string.IsNullOrEmpty(options.HmacKey) ? [] : Convert.FromBase64String(options.HmacKey);

        if (!_keys.TryGetValue(_currentKeyId, out var current) || current.Length != 32)
            throw new InvalidOperationException(
                $"Krypteringsnyckel '{_currentKeyId}' saknas eller är inte 256 bitar. Konfigurera Encryption:Keys:{_currentKeyId}.");
        if (_hmacKey.Length < 32)
            throw new InvalidOperationException("Encryption:HmacKey saknas eller är kortare än 256 bitar.");
    }

    public string Encrypt(string plaintext)
    {
        var key = _keys[_currentKeyId];
        var data = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[data.Length];
        var tag = new byte[TagSize];

        using (var aes = new AesGcm(key, TagSize))
            aes.Encrypt(nonce, data, cipher, tag, Encoding.UTF8.GetBytes(_currentKeyId));

        var blob = new byte[NonceSize + TagSize + cipher.Length];
        nonce.CopyTo(blob, 0);
        tag.CopyTo(blob, NonceSize);
        cipher.CopyTo(blob, NonceSize + TagSize);
        return $"{_currentKeyId}:{Convert.ToBase64String(blob)}";
    }

    public string Decrypt(string protectedValue)
    {
        var sep = protectedValue.IndexOf(':');
        if (sep <= 0) throw new CryptographicException("Ogiltigt krypterat värde.");
        var keyId = protectedValue[..sep];
        if (!_keys.TryGetValue(keyId, out var key))
            throw new CryptographicException($"Okänd nyckelversion '{keyId}'.");

        var blob = Convert.FromBase64String(protectedValue[(sep + 1)..]);
        var nonce = blob.AsSpan(0, NonceSize);
        var tag = blob.AsSpan(NonceSize, TagSize);
        var cipher = blob.AsSpan(NonceSize + TagSize);
        var plain = new byte[cipher.Length];

        using (var aes = new AesGcm(key, TagSize))
            aes.Decrypt(nonce, cipher, tag, plain, Encoding.UTF8.GetBytes(keyId));

        return Encoding.UTF8.GetString(plain);
    }

    /// <summary>Behövs omkryptering (nyckelrotation)?</summary>
    public bool NeedsReEncryption(string protectedValue) => !protectedValue.StartsWith(_currentKeyId + ":", StringComparison.Ordinal);

    /// <summary>Deterministisk HMAC – används för att hitta dubbletter utan att lagra klartext.</summary>
    public string Hash(string normalizedPersonnummer)
    {
        var mac = HMACSHA256.HashData(_hmacKey, Encoding.UTF8.GetBytes(normalizedPersonnummer));
        return Convert.ToHexString(mac);
    }
}
