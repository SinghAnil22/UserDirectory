using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using UserDirectory.Api.Models;

namespace UserDirectory.Api.Data;

public static class DbInitializer
{
    /// <summary>Creates the database file (and its folder) if missing, then optionally seeds sample data.</summary>
    public static void Initialize(AppDbContext db, bool seed)
    {
        EnsureDataDirectory(db.Database.GetConnectionString());
        db.Database.EnsureCreated();

        if (!seed || db.Users.Any()) return;

        var now = DateTime.UtcNow;
        db.Users.AddRange(
            new User { Name = "Asha Verma", Age = 29, City = "Pune", State = "Maharashtra", Pincode = "411001", CreatedAtUtc = now, UpdatedAtUtc = now },
            new User { Name = "Rahul Mehta", Age = 41, City = "Jaipur", State = "Rajasthan", Pincode = "302001", CreatedAtUtc = now, UpdatedAtUtc = now });
        db.SaveChanges();
    }

    private static void EnsureDataDirectory(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var dataSource = new SqliteConnectionStringBuilder(connectionString).DataSource;
        if (string.IsNullOrWhiteSpace(dataSource) || dataSource == ":memory:") return;

        var directory = Path.GetDirectoryName(Path.GetFullPath(dataSource));
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
    }
}
