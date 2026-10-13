using Microsoft.AspNetCore.Mvc;
using UserDirectory.Api.Contracts;
using UserDirectory.Api.Controllers;
using UserDirectory.Api.Services;

namespace UserDirectory.Api.Tests;

public class UsersControllerTests : IDisposable
{
    private readonly SqliteTestDb _db = new();
    private readonly UsersController _controller;

    public UsersControllerTests()
    {
        _controller = new UsersController(new UserService(_db.CreateContext(), TimeProvider.System));
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetAll_returns_200_with_users()
    {
        await _controller.Create(TestData.ValidRequest(), CancellationToken.None);

        var result = await _controller.GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single(Assert.IsAssignableFrom<IReadOnlyList<UserResponse>>(ok.Value));
    }

    [Fact]
    public async Task Create_returns_201_with_location_of_new_user()
    {
        var result = await _controller.Create(TestData.ValidRequest(), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var user = Assert.IsType<UserResponse>(created.Value);
        Assert.Equal(nameof(UsersController.GetById), created.ActionName);
        Assert.Equal(user.Id, created.RouteValues!["id"]);
    }

    [Fact]
    public async Task GetById_returns_404_when_missing()
    {
        var result = await _controller.GetById(42, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_returns_200_when_found_and_404_when_missing()
    {
        var created = (UserResponse)((CreatedAtActionResult)(await _controller.Create(TestData.ValidRequest(), CancellationToken.None)).Result!).Value!;

        Assert.IsType<OkObjectResult>((await _controller.Update(created.Id, TestData.ValidRequest("New Name"), CancellationToken.None)).Result);
        Assert.IsType<NotFoundResult>((await _controller.Update(999, TestData.ValidRequest(), CancellationToken.None)).Result);
    }

    [Fact]
    public async Task Delete_returns_204_when_found_and_404_when_missing()
    {
        var created = (UserResponse)((CreatedAtActionResult)(await _controller.Create(TestData.ValidRequest(), CancellationToken.None)).Result!).Value!;

        Assert.IsType<NoContentResult>(await _controller.Delete(created.Id, CancellationToken.None));
        Assert.IsType<NotFoundResult>(await _controller.Delete(created.Id, CancellationToken.None));
    }
}
