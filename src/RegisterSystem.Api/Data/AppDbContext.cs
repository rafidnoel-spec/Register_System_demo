using Microsoft.EntityFrameworkCore;
using RegisterSystem.Api.Domain;

namespace RegisterSystem.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<County> Counties => Set<County>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<Church> Churches => Set<Church>();
    public DbSet<Priest> Priests => Set<Priest>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<MemberRelation> Relations => Set<MemberRelation>();
    public DbSet<SacramentEvent> Sacraments => Set<SacramentEvent>();
    public DbSet<ConsentRecord> Consents => Set<ConsentRecord>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<County>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<City>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.HasIndex(x => new { x.CountyId, x.Name }).IsUnique();
            e.HasOne(x => x.County).WithMany(x => x.Cities).HasForeignKey(x => x.CountyId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Church>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Address).HasMaxLength(200);
            e.Property(x => x.KioskCode).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.KioskCode).IsUnique();
            e.HasOne(x => x.City).WithMany(x => x.Churches).HasForeignKey(x => x.CityId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Priest>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.HasOne(x => x.Church).WithMany().HasForeignKey(x => x.ChurchId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<AppUser>(e =>
        {
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.DisplayName).HasMaxLength(150);
            e.HasOne(x => x.County).WithMany().HasForeignKey(x => x.CountyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.City).WithMany().HasForeignKey(x => x.CityId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Church).WithMany().HasForeignKey(x => x.ChurchId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Member>(e =>
        {
            e.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            e.Property(x => x.Street).HasMaxLength(200);
            e.Property(x => x.PostalCode).HasMaxLength(10);
            e.Property(x => x.PostalTown).HasMaxLength(100);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.PersonnummerEncrypted).HasMaxLength(512).IsRequired();
            e.Property(x => x.PersonnummerHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.PersonnummerHash);
            e.HasIndex(x => new { x.ChurchId, x.Status });
            e.HasIndex(x => new { x.LastName, x.FirstName });
            e.HasOne(x => x.Church).WithMany().HasForeignKey(x => x.ChurchId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<MemberRelation>(e =>
        {
            e.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RelatedMember).WithMany().HasForeignKey(x => x.RelatedMemberId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.MemberId, x.RelatedMemberId, x.Type }).IsUnique();
        });

        b.Entity<SacramentEvent>(e =>
        {
            e.Property(x => x.ChurchNameOther).HasMaxLength(150);
            e.Property(x => x.PriestNameOther).HasMaxLength(150);
            e.Property(x => x.Godparents).HasMaxLength(300);
            e.Property(x => x.RegisterReference).HasMaxLength(100);
            e.HasOne(x => x.Member).WithMany(x => x.Sacraments).HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.SpouseMember).WithMany().HasForeignKey(x => x.SpouseMemberId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Church).WithMany().HasForeignKey(x => x.ChurchId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Priest).WithMany().HasForeignKey(x => x.PriestId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.MemberId, x.Type });
        });

        b.Entity<ConsentRecord>(e =>
        {
            e.Property(x => x.PolicyVersion).HasMaxLength(20);
            e.Property(x => x.Purpose).HasMaxLength(300);
            e.HasOne(x => x.Member).WithMany(x => x.Consents).HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AuditLog>(e =>
        {
            e.Property(x => x.Action).HasMaxLength(60);
            e.Property(x => x.EntityType).HasMaxLength(60);
            e.Property(x => x.EntityId).HasMaxLength(60);
            e.Property(x => x.UserEmail).HasMaxLength(256);
            e.Property(x => x.Details).HasMaxLength(1000);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            e.HasIndex(x => x.At);
        });
    }
}
