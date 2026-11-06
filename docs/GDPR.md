# GDPR och dataskydd

Det här dokumentet beskriver hur systemet stöder dataskyddsförordningen (GDPR) och vad
**församlingen själv** måste göra. Programvaran kan göra det tekniskt möjligt att följa GDPR, men
ansvaret ligger hos den personuppgiftsansvarige. Den behöver bland annat organisatoriska rutiner, avtal och dokumentation.
Låt gärna ett dataskyddsombud eller en jurist granska detta innan systemet tas i drift.

> **Särskilt känsliga uppgifter.** Medlemskap i ett trossamfund avslöjar religiös övertygelse och
> räknas därför som en *känslig personuppgift* (art. 9). Behandlingen stöds av art. 9.2 a (uttryckligt samtycke)
> och art. 9.2 d (trossamfunds behandling av uppgifter om sina medlemmar). Personnummer får bara behandlas
> när det är klart motiverat (3 kap. 10 § dataskyddslagen). Här motiveras det med säker identifiering och att förväxlingar ska undvikas.

## Inbyggt i systemet

| Krav | Artikel | Hur systemet uppfyller det |
|---|---|---|
| Laglighet och samtycke | 6, 7, 9 | Självregistrering kräver att man aktivt kryssar i samtycke. Samtycket sparas med textversion, tidpunkt och kanal (webb eller kiosk). |
| Information till den registrerade | 13 | Informationstexten (`PrivacyPolicy.cs`) visas i formuläret. Höj `Privacy:Version` när texten ändras. |
| Uppgiftsminimering | 5.1 c | Bara nödvändiga fält är obligatoriska. E-post och telefon är frivilliga. Personnummer tas aldrig med i listor, utskrifter eller e-post, och visas maskerat (`ÅÅÅÅMMDD-****`). |
| Kryptering av personnummer | 32 | AES-256-GCM med nyckelversion, så att nycklar kan bytas. Klartext lagras aldrig. Dubbletter hittas med HMAC-SHA256 utan att något dekrypteras. |
| Behörighetsstyrning | 25, 32 | Root, Län, Stad och Kyrka. Varje API-anrop filtreras på användarens område (`CurrentUser`). |
| Spårbarhet / loggning | 5.2, 30, 32 | Granskningsloggen registrerar inloggning, visning, ändring, export, utskick, visning av personnummer (med angiven anledning) och radering. |
| Rätt till tillgång och dataportabilitet | 15, 20 | Knappen **Registerutdrag (GDPR)** ger en JSON-fil med alla uppgifter om personen. |
| Rätt till rättelse | 16 | Uppgifterna kan ändras av behörig administratör. |
| Rätt till radering | 17 | Knappen **Radera** tar bort personen, relationer, sakrament och samtycken permanent. Loggen sparar bara id. |
| Lagringsminimering | 5.1 e | Ej godkända registreringar raderas automatiskt efter `Privacy:PendingRetentionDays` (90 dagar). Loggen gallras efter `Privacy:AuditRetentionDays` (730 dagar). |
| Skydd mot obehöriga | 32 | Lösenord hashas med PBKDF2 (ASP.NET Identity). Konton låses efter 5 felförsök. Automatisk utloggning efter 20 minuter. Inloggning och registrering har anropsbegränsning. HTTPS/HSTS, säkerhetshuvuden och `Cache-Control: no-store`. |
| Ingen läcka vid registrering | 32 | Svaret är alltid detsamma, oavsett om personnumret redan finns. Ingen kan alltså ta reda på vem som är medlem. |
| Begränsade utskick | 32 | Listor får bara e-postas till användare i systemet eller till godkända domäner (`Smtp:AllowedRecipientDomains`), högst 10 mottagare. Varje utskick loggas. |
| Kioskens integritet | 25 | Ingen autofyll. Formuläret rensas efter registrering och efter 90 + 20 sekunders inaktivitet. Ingen data sparas i webbläsaren. |
| Skydd mot Excel-injektion | 32 | CSV-export neutraliserar celler som börjar med `=`, `+`, `-` eller `@`. |

## Församlingen måste själv

- [ ] Utse personuppgiftsansvarig (juridisk person) och vid behov **dataskyddsombud** (krävs ofta vid
      storskalig behandling av känsliga uppgifter, art. 37). Fyll i `Privacy:*` i konfigurationen.
- [ ] Granska och anpassa **informationstexten** i `Services/PrivacyPolicy.cs`.
- [ ] Upprätta ett **register över behandlingar** (art. 30).
- [ ] Gör en **konsekvensbedömning (DPIA)** (art. 35). Den krävs normalt vid behandling av känsliga uppgifter i större omfattning.
- [ ] Teckna **personuppgiftsbiträdesavtal** (art. 28) med drift- och e-postleverantörer. Välj gärna drift inom EU/EES.
- [ ] Ta fram en **rutin för begäran** om registerutdrag, rättelse och radering. Svar ska ges inom en månad (art. 12).
- [ ] Bestäm **gallringsregler**, till exempel hur länge sakramentsuppgifter ska bevaras som kyrkobok enligt kyrkans egna regler, och
      vad som gäller när en medlem lämnar (sätt *Inaktiv* eller radera).
- [ ] Ta fram en **rutin för personuppgiftsincidenter**: anmälan till IMY inom 72 timmar (art. 33).
- [ ] Ge bara behörighet till personer som behöver den, och gå igenom användarlistan regelbundet.
- [ ] Ta fram en **rutin för surfplattan:** Guidad åtkomst eller MDM, skärmlås, och en ny kioskkod om plattan försvinner.
- [ ] Driftmiljö: HTTPS, kryptering i vila för databasen (TDE), säkerhetskopiering (även **krypteringsnyckeln**,
      förvarad separat), uppdateringar och övervakning.
- [ ] Utbilda administratörerna: inga känsliga uppgifter i fältet *Anteckningar*, och utskrivna listor ska förstöras.

## Möjliga förbättringar

- Tvåfaktorsinloggning (TOTP) för administratörer.
- Möjlighet för medlemmen att själv återkalla samtycke eller begära utdrag via e-postlänk.
- Familjeregistrering i ett steg (lägga till make/maka och barn direkt i formuläret).
- Azure Key Vault-integration för krypteringsnycklar.
