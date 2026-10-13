using UserDirectory.Api.Services;

namespace UserDirectory.Api.Tests;

public class UserServiceTests : IDisposable
{
    private readonly SqliteTestDb _db = new();

    private UserService CreateService() => new(_db.CreateContext(), TimeProvider.System);

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetAll_returns_empty_list_when_no_users()
    {
        Assert.Empty(await CreateService().GetAllAsync());
    }

    [Fact]
    public async Task Create_persists_user_and_trims_values()
    {
        var request = TestData.ValidRequest("  Jane Doe  ");
        request.City = " Mumbai ";

        var created = await CreateService().CreateAsync(request);

        Assert.True(created.Id > 0);
        Assert.Equal("Jane Doe", created.Name);
        Assert.Equal("Mumbai", created.City);

        var fetched = await CreateService().GetByIdAsync(created.Id);
        Assert.Equal(created, fetched);
    }

    [Fact]
    public async Task GetAll_returns_users_sorted_by_name()
    {
        var service = CreateService();
        await service.CreateAsync(TestData.ValidRequest("Zara"));
        await service.CreateAsync(TestData.ValidRequest("Amit"));

        var users = await CreateService().GetAllAsync();

        Assert.Equal(["Amit", "Zara"], users.Select(u => u.Name));
    }

    [Fact]
    public async Task GetById_returns_null_for_unknown_id()
    {
        Assert.Null(await CreateService().GetByIdAsync(999));
    }

    [Fact]
    public async Task Update_changes_existing_user()
    {
        var created = await CreateService().CreateAsync(TestData.ValidRequest());
        var update = TestData.ValidRequest("Jane Smith");
        update.Age = 31;

        var updated = await CreateService().UpdateAsync(created.Id, update);

        Assert.NotNull(updated);
        Assert.Equal("Jane Smith", updated.Name);
        Assert.Equal(31, (await CreateService().GetByIdAsync(created.Id))!.Age);
    }

    [Fact]
    public async Task Update_returns_null_for_unknown_id()
    {
        Assert.Null(await CreateService().UpdateAsync(999, TestData.ValidRequest()));
    }

    [Fact]
    public async Task Delete_removes_user()
    {
        var created = await CreateService().CreateAsync(TestData.ValidRequest());

        Assert.True(await CreateService().DeleteAsync(created.Id));
        Assert.Null(await CreateService().GetByIdAsync(created.Id));
    }

    [Fact]
    public async Task Delete_returns_false_for_unknown_id()
    {
        Assert.False(await CreateService().DeleteAsync(999));
    }
}
