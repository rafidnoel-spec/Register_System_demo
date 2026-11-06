<p align="center"><img src="src/register-admin/public/logo.jpg" width="140" alt="Kaldeisk-katolska missionen Södertälje"></p>

# Församlingsregister – Kaldeisk-katolska missionen (DEMO)

> **Live-demo:** https://rafidnoel-spec.github.io/Register_System_demo/
>
> Demon publiceras automatiskt på GitHub Pages när något pushas till `main`
> (`.github/workflows/deploy-demo.yml`). I demoläget (`VITE_DEMO=true`) ersätts C#-API:t av ett
> demo-API som körs i webbläsaren (`src/demo-mock/mockApi.ts`) med **påhittade** personer. Ingen data lämnar
> webbläsaren. Demokonton: `root@demo.se`, `lan@demo.se`, `stad@demo.se` och `kyrka@demo.se`, alla med lösenordet `demo`.
>
> Utan `VITE_DEMO` fungerar apparna precis som i huvudprojektet, mot det riktiga API:t.

Medlemsregister för församlingens kyrkor, uppdelat i **Län → Stad → Kyrka**, med
inloggning på fyra behörighetsnivåer, självregistrering utan inloggning, ett kioskläge för
surfplattan vid kyrkdörren, relationer och sakrament, utskrifter, e-postade listor och
inbyggt stöd för GDPR.

| Del | Teknik | Mapp | Port (utveckling) |
|---|---|---|---|
| API | C# / ASP.NET Core 10, EF Core, SQL Server | `src/RegisterSystem.Api` | https://localhost:7180 |
| Administration | React 19 + TypeScript (Vite) | `src/register-admin` | http://localhost:5173 |
| Registrering + kiosk | React 19 + TypeScript (Vite) | `src/register-public` | http://localhost:5174 |

## Funktioner

1. **Inloggning med behörigheter.** Root ser hela organisationen. Län ser alla städer och kyrkor i
   länet. Stad ser kyrkorna i staden. Kyrka ser bara sin egen kyrka. Användare kan bara skapa användare på sin egen nivå
   eller lägre. Kontot låses efter 5 felaktiga försök, och man loggas ut automatiskt efter 20 minuter utan aktivitet.
2. **Hierarki.** Ett län kan ha en eller flera städer, och en stad kan ha en eller flera kyrkor.
3. **Självregistrering utan inloggning** (`register-public`). Man fyller i för- och efternamn, adress,
   personnummer (krypterat), civilstånd och kyrka. Man måste lämna samtycke till informationen enligt art. 13. Formuläret finns på svenska, arabiska och engelska.
   Registreringen hamnar under **Nya registreringar** och väntar där tills en administratör godkänner den.
4. **Relationer och sakrament.** Relationer: make/maka, förälder/barn och gudförälder. Sakrament: dop, första kommunion, konfirmation,
   vigsel, prästvigning, de sjukas smörjelse och begravning. Varje sakrament registreras med datum, kyrka, präst, faddrar och kyrkobokreferens.
   När en vigsel registreras skapas make/maka-relationen automatiskt, och civilståndet sätts till gift.
5. **Listor med filter** på län, stad, kyrka, civilstånd, status, ålder, sakrament (har/saknar) och fritext.
   Listorna kan skrivas ut, laddas ner som CSV eller e-postas, och personnummer tas aldrig med.
6. **Familjerapport** för utskrift: personen, make/maka, barn och föräldrar, med alla sakrament.
7. **GDPR:** se [docs/GDPR.md](docs/GDPR.md).
8. **Kioskläge för iPad/surfplatta** (`/kiosk/<kod>`). Kyrkan är förvald, knapparna är stora och det finns en välkomstskärm.
   Formuläret rensas efter varje registrering och efter inaktivitet, och autofyll är avstängt.

## Kom igång i Visual Studio 2026

**Krav:** Visual Studio 2026 med arbetsbelastningarna *ASP.NET och webbutveckling* och *Node.js*,
.NET 10 SDK, Node.js 20 eller senare och SQL Server LocalDB (följer med Visual Studio).

1. Öppna `RegisterSystem.slnx`.
2. Installera npm-paketen en gång, antingen genom att högerklicka på `register-admin` och `register-public` och välja **npm → Install**,
   eller i terminalen:
   ```powershell
   cd src/register-admin;  npm install
   cd ../register-public;  npm install
   ```
3. Välj startprofilen **"Allt (API + Admin + Registrering)"** i verktygsfältet och tryck **F5**.
   Om profilen inte syns: högerklicka på lösningen, välj **Configure Startup Projects…**, sedan **Multiple startup projects**,
   och starta alla tre projekten.
4. Databasen `RegisterSystem_Dev` skapas automatiskt i LocalDB med exempeldata (fiktiva personer).
5. Öppna http://localhost:5173 och logga in med
   `root@example.org` / `Byt-Detta-Losenord-2026!` (från `appsettings.Development.json`).

Registreringsformuläret finns på http://localhost:5174. Kiosklänken för en kyrka hittar du i administrationen under
**Län, städer & kyrkor → Surfplatta**.

### Databasmigreringar

Vid första körningen skapas databasen med `EnsureCreated`. Inför driftsättning bör du gå över till migreringar:

```powershell
dotnet tool install --global dotnet-ef
cd src/RegisterSystem.Api
dotnet ef migrations add Initial
```

När det finns minst en migrering körs den automatiskt vid start. Om utvecklingsdatabasen redan har skapats
med `EnsureCreated` behöver du först ta bort den:

```powershell
dotnet ef database drop
```

## Driftsättning (produktion)

Nycklarna i `appsettings.Development.json` får **bara** användas för utveckling. I produktion ska varje hemlighet
sättas som miljövariabel eller hämtas från Azure Key Vault. Lägg dem aldrig i källkoden.

| Inställning | Beskrivning |
|---|---|
| `ConnectionStrings__Default` | Anslutning till SQL Server (aktivera TDE/kryptering i vila) |
| `Jwt__SigningKey` | Minst 32 slumpmässiga tecken |
| `Encryption__Keys__v1` | 32 slumpmässiga byte, Base64 (AES-256-nyckel för personnummer) |
| `Encryption__HmacKey` | 32 slumpmässiga byte, Base64 (för dubblettkontroll) |
| `Smtp__Host`, `Smtp__UserName`, `Smtp__Password`, `Smtp__FromAddress` | E-postserver |
| `Smtp__AllowedRecipientDomains__0` | Domäner som listor får skickas till, t.ex. församlingens egen |
| `Privacy__ContactEmail`, `Privacy__ControllerOrgNumber` | Uppgifter i integritetstexten |
| `Cors__Origins__0`, `Cors__Origins__1` | Adresserna till admin- och registreringsappen |
| `Seed__RootEmail`, `Seed__RootPassword` | Används bara första gången, för att skapa root-kontot |

Generera nycklar i PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

> ⚠️ **Säkerhetskopiera krypteringsnyckeln.** Om den försvinner går personnumren inte att läsa.
> Vid nyckelbyte lägger du till `v2` under `Encryption:Keys`, sätter `CurrentKeyId` till `v2` och behåller `v1`.
> Nya och ändrade poster krypteras då med den nya nyckeln.

Bygg frontend med `npm run build`. Publicera `dist/` bakom HTTPS och låt `/api` gå vidare till API:t
(samma domän, eller ange `Cors:Origins`). Sätt `VITE_PUBLIC_APP_URL` vid bygget av admin-appen så att kiosklänkarna blir rätt.

## Projektstruktur

```
RegisterSystem.slnx
src/
  RegisterSystem.Api/
    Controllers/   Auth, Users, Hierarchy (län/stad/kyrka/präst), Members, Relations,
                   Sacraments, Reports (lista/CSV/e-post/familj), Public, Audit
    Domain/        Entiteter och enum
    Data/          AppDbContext, DbSeeder
    Security/      Personnummer (validering), PersonnummerProtector (AES-GCM),
                   CurrentUser (behörighetsområde), JwtTokenService
    Services/      Audit, E-post, Filter, Integritetstext, Gallring
  register-admin/  Administrationsgränssnitt
  register-public/ Självregistrering + kioskläge
docs/GDPR.md
```
