using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using UserDirectory.Api.Contracts;
using UserDirectory.Api.Data;

namespace UserDirectory.Api.Tests;

internal static class TestData
{
    public static UserRequest ValidRequest(string name = "Jane Doe") => new()
    {
        Name = name,
        Age = 30,
        City = "Mumbai",
        State = "Maharashtra",
        Pincode = "400001",
    };
}

/// <summary>An AppDbContext backed by a private in-memory SQLite database (real SQL semantics, no files).</summary>
internal sealed class SqliteTestDb : IDisposable
{
    private readonly SqliteConnection _connection;

    public SqliteTestDb()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        using var db = CreateContext();
        db.Database.EnsureCreated();
    }

    public AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);

    public void Dispose() => _connection.Dispose();
}
