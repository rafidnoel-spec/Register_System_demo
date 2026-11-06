using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Data;
using RegisterSystem.Api.Domain;
using RegisterSystem.Api.Dtos;
using RegisterSystem.Api.Security;
using RegisterSystem.Api.Services;

namespace RegisterSystem.Api.Controllers;

/// <summary>Län → Stad → Kyrka, samt präster.</summary>
[ApiController]
[Authorize]
[Route("api")]
public class HierarchyController(AppDbContext db, CurrentUser currentUser, AuditService audit) : ControllerBase
{
    // ---------------- Län ----------------
    [HttpGet("counties")]
    public async Task<List<CountyDto>> Counties() =>
        await (await currentUser.CountiesInScopeAsync()).OrderBy(c => c.Name)
            .Select(c => new CountyDto(c.Id, c.Name, c.Cities.Count)).ToListAsync();

    [HttpPost("counties")]
    [Authorize(Roles = nameof(UserRole.Root))]
    public async Task<ActionResult<CountyDto>> CreateCounty(CountyUpsert req)
    {
        var c = new County { Name = req.Name.Trim() };
        db.Counties.Add(c);
        await db.SaveChangesAsync();
        await audit.LogAsync("CountyCreated", nameof(County), c.Id, c.Name);
        return new CountyDto(c.Id, c.Name, 0);
    }

    [HttpPut("counties/{id:int}")]
    [Authorize(Roles = nameof(UserRole.Root))]
    public async Task<IActionResult> UpdateCounty(int id, CountyUpsert req)
    {
        var c = await db.Counties.FindAsync(id);
        if (c is null) return NotFound();
        c.Name = req.Name.Trim();
        await db.SaveChangesAsync();
        await audit.LogAsync("CountyUpdated", nameof(County), c.Id, c.Name);
        return NoContent();
    }

    [HttpDelete("counties/{id:int}")]
    [Authorize(Roles = nameof(UserRole.Root))]
    public async Task<IActionResult> DeleteCounty(int id)
    {
        var c = await db.Counties.FindAsync(id);
        if (c is null) return NotFound();
        if (await db.Cities.AnyAsync(x => x.CountyId == id) || await db.Users.AnyAsync(u => u.CountyId == id))
            return Conflict(new ProblemDetails { Title = "Länet har städer eller användare och kan inte tas bort." });
        db.Counties.Remove(c);
        await db.SaveChangesAsync();
        await audit.LogAsync("CountyDeleted", nameof(County), id);
        return NoContent();
    }

    // ---------------- Städer ----------------
    [HttpGet("cities")]
    public async Task<List<CityDto>> Cities([FromQuery] int? countyId)
    {
        var q = await currentUser.CitiesInScopeAsync();
        if (countyId is not null) q = q.Where(c => c.CountyId == countyId);
        return await q.OrderBy(c => c.County!.Name).ThenBy(c => c.Name)
            .Select(c => new CityDto(c.Id, c.Name, c.CountyId, c.County!.Name, c.Churches.Count)).ToListAsync();
    }

    [HttpPost("cities")]
    public async Task<ActionResult<CityDto>> CreateCity(CityUpsert req)
    {
        if (!await CanManageCountyAsync(req.CountyId)) return Forbid();
        var c = new City { Name = req.Name.Trim(), CountyId = req.CountyId };
        db.Cities.Add(c);
        await db.SaveChangesAsync();
        await audit.LogAsync("CityCreated", nameof(City), c.Id, c.Name);
        var countyName = await db.Counties.Where(x => x.Id == c.CountyId).Select(x => x.Name).FirstAsync();
        return new CityDto(c.Id, c.Name, c.CountyId, countyName, 0);
    }

    [HttpPut("cities/{id:int}")]
    public async Task<IActionResult> UpdateCity(int id, CityUpsert req)
    {
        var c = await db.Cities.FindAsync(id);
        if (c is null) return NotFound();
        if (!await CanManageCountyAsync(c.CountyId) || !await CanManageCountyAsync(req.CountyId)) return Forbid();
        c.Name = req.Name.Trim();
        c.CountyId = req.CountyId;
        await db.SaveChangesAsync();
        await audit.LogAsync("CityUpdated", nameof(City), c.Id, c.Name);
        return NoContent();
    }

    [HttpDelete("cities/{id:int}")]
    public async Task<IActionResult> DeleteCity(int id)
    {
        var c = await db.Cities.FindAsync(id);
        if (c is null) return NotFound();
        if (!await CanManageCountyAsync(c.CountyId)) return Forbid();
        if (await db.Churches.AnyAsync(x => x.CityId == id) || await db.Users.AnyAsync(u => u.CityId == id))
            return Conflict(new ProblemDetails { Title = "Staden har kyrkor eller användare och kan inte tas bort." });
        db.Cities.Remove(c);
        await db.SaveChangesAsync();
        await audit.LogAsync("CityDeleted", nameof(City), id);
        return NoContent();
    }

    // ---------------- Kyrkor ----------------
    [HttpGet("churches")]
    public async Task<List<ChurchDto>> Churches([FromQuery] int? cityId, [FromQuery] int? countyId)
    {
        var q = await currentUser.ChurchesInScopeAsync();
        if (cityId is not null) q = q.Where(c => c.CityId == cityId);
        if (countyId is not null) q = q.Where(c => c.City!.CountyId == countyId);
        return await q.OrderBy(c => c.City!.Name).ThenBy(c => c.Name)
            .Select(c => new ChurchDto(c.Id, c.Name, c.Address, c.CityId, c.City!.Name, c.City.CountyId, c.City.County!.Name,
                c.AcceptsPublicRegistration, c.KioskCode,
                db.Members.Count(m => m.ChurchId == c.Id && m.Status != MemberStatus.Pending)))
            .ToListAsync();
    }

    [HttpPost("churches")]
    public async Task<ActionResult> CreateChurch(ChurchUpsert req)
    {
        if (!await CanManageCityAsync(req.CityId)) return Forbid();
        var c = new Church
        {
            Name = req.Name.Trim(),
            Address = req.Address?.Trim(),
            CityId = req.CityId,
            AcceptsPublicRegistration = req.AcceptsPublicRegistration,
            KioskCode = NewKioskCode()
        };
        db.Churches.Add(c);
        await db.SaveChangesAsync();
        await audit.LogAsync("ChurchCreated", nameof(Church), c.Id, c.Name);
        return Ok(new { c.Id });
    }

    [HttpPut("churches/{id:int}")]
    public async Task<IActionResult> UpdateChurch(int id, ChurchUpsert req)
    {
        var c = await db.Churches.FindAsync(id);
        if (c is null) return NotFound();
        var me = await currentUser.GetAsync();
        // Kyrkoanvändare får ändra namn/adress på sin egen kyrka men inte flytta den.
        if (me.Role == UserRole.Church)
        {
            if (me.ChurchId != id || req.CityId != c.CityId) return Forbid();
        }
        else if (!await CanManageCityAsync(c.CityId) || !await CanManageCityAsync(req.CityId)) return Forbid();

        c.Name = req.Name.Trim();
        c.Address = req.Address?.Trim();
        c.CityId = req.CityId;
        c.AcceptsPublicRegistration = req.AcceptsPublicRegistration;
        await db.SaveChangesAsync();
        await audit.LogAsync("ChurchUpdated", nameof(Church), c.Id, c.Name);
        return NoContent();
    }

    /// <summary>Byt kioskkod, t.ex. om en surfplatta har tappats bort. Den gamla länken slutar fungera.</summary>
    [HttpPost("churches/{id:int}/kiosk-code")]
    public async Task<ActionResult> RegenerateKioskCode(int id)
    {
        if (!await currentUser.CanAccessChurchAsync(id)) return Forbid();
        var c = await db.Churches.FindAsync(id);
        if (c is null) return NotFound();
        c.KioskCode = NewKioskCode();
        await db.SaveChangesAsync();
        await audit.LogAsync("KioskCodeRegenerated", nameof(Church), id);
        return Ok(new { c.KioskCode });
    }

    [HttpDelete("churches/{id:int}")]
    public async Task<IActionResult> DeleteChurch(int id)
    {
        var c = await db.Churches.FindAsync(id);
        if (c is null) return NotFound();
        if (!await CanManageCityAsync(c.CityId)) return Forbid();
        if (await db.Members.AnyAsync(m => m.ChurchId == id) || await db.Users.AnyAsync(u => u.ChurchId == id))
            return Conflict(new ProblemDetails { Title = "Kyrkan har medlemmar eller användare och kan inte tas bort." });
        db.Churches.Remove(c);
        await db.SaveChangesAsync();
        await audit.LogAsync("ChurchDeleted", nameof(Church), id);
        return NoContent();
    }

    // ---------------- Präster ----------------
    [HttpGet("priests")]
    public async Task<List<PriestDto>> Priests([FromQuery] int? churchId)
    {
        var churchIds = (await currentUser.ChurchesInScopeAsync()).Select(c => c.Id);
        var q = db.Priests.Where(p => p.ChurchId == null || churchIds.Contains(p.ChurchId.Value));
        if (churchId is not null) q = q.Where(p => p.ChurchId == churchId || p.ChurchId == null);
        return await q.OrderBy(p => p.Name)
            .Select(p => new PriestDto(p.Id, p.Name, p.ChurchId, p.Church != null ? p.Church.Name : null, p.IsActive))
            .ToListAsync();
    }

    [HttpPost("priests")]
    public async Task<ActionResult<PriestDto>> CreatePriest(PriestUpsert req)
    {
        if (!await CanSetPriestChurchAsync(req.ChurchId)) return Forbid();
        var p = new Priest { Name = req.Name.Trim(), ChurchId = req.ChurchId, IsActive = req.IsActive };
        db.Priests.Add(p);
        await db.SaveChangesAsync();
        await audit.LogAsync("PriestCreated", nameof(Priest), p.Id, p.Name);
        return new PriestDto(p.Id, p.Name, p.ChurchId, null, p.IsActive);
    }

    [HttpPut("priests/{id:int}")]
    public async Task<IActionResult> UpdatePriest(int id, PriestUpsert req)
    {
        var p = await db.Priests.FindAsync(id);
        if (p is null) return NotFound();
        if (!await CanSetPriestChurchAsync(p.ChurchId) || !await CanSetPriestChurchAsync(req.ChurchId)) return Forbid();
        p.Name = req.Name.Trim();
        p.ChurchId = req.ChurchId;
        p.IsActive = req.IsActive;
        await db.SaveChangesAsync();
        await audit.LogAsync("PriestUpdated", nameof(Priest), p.Id, p.Name);
        return NoContent();
    }

    // ---------------- Hjälpmetoder ----------------
    private async Task<bool> CanManageCountyAsync(int countyId)
    {
        var me = await currentUser.GetAsync();
        return me.Role == UserRole.Root || (me.Role == UserRole.County && me.CountyId == countyId);
    }

    private async Task<bool> CanManageCityAsync(int cityId)
    {
        var me = await currentUser.GetAsync();
        if (me.Role == UserRole.Root) return true;
        if (me.Role == UserRole.County) return await db.Cities.AnyAsync(c => c.Id == cityId && c.CountyId == me.CountyId);
        if (me.Role == UserRole.City) return me.CityId == cityId;
        return false;
    }

    /// <summary>Präster utan kyrka (gemensamma) får bara hanteras av Root/Län.</summary>
    private async Task<bool> CanSetPriestChurchAsync(int? churchId)
    {
        var me = await currentUser.GetAsync();
        if (churchId is null) return me.Role is UserRole.Root or UserRole.County;
        return await currentUser.CanAccessChurchAsync(churchId.Value);
    }

    private static string NewKioskCode() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
}
