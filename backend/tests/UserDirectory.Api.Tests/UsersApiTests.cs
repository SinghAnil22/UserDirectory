using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using UserDirectory.Api.Auth;
using UserDirectory.Api.Contracts;

namespace UserDirectory.Api.Tests;

/// <summary>End-to-end HTTP tests covering routing, model validation, status codes and auth.</summary>
public class UsersApiTests : IClassFixture<ApiTestFactory>
{
    private readonly ApiTestFactory _factory;

    public UsersApiTests(ApiTestFactory factory) => _factory = factory;

    [Theory]
    [InlineData("GET", "/api/users")]
    [InlineData("GET", "/api/users/1")]
    [InlineData("POST", "/api/users")]
    [InlineData("PUT", "/api/users/1")]
    [InlineData("DELETE", "/api/users/1")]
    public async Task Endpoints_require_a_bearer_token(string method, string url)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), url);
        if (method is "POST" or "PUT") request.Content = JsonContent.Create(TestData.ValidRequest());

        var response = await _factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/me")]
    public async Task Me_requires_a_bearer_token(string method, string url)
    {
        var response = await _factory.CreateClient().SendAsync(new HttpRequestMessage(new HttpMethod(method), url));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Full_crud_lifecycle_as_admin()
    {
        var client = _factory.CreateAdminClient();

        var create = await client.PostAsJsonAsync("/api/users", TestData.ValidRequest("Lifecycle User"));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = (await create.Content.ReadFromJsonAsync<UserResponse>())!;
        Assert.EndsWith($"/api/users/{created.Id}", create.Headers.Location!.ToString());

        var list = await client.GetFromJsonAsync<List<UserResponse>>("/api/users");
        Assert.Contains(list!, u => u.Id == created.Id);

        var update = await client.PutAsJsonAsync($"/api/users/{created.Id}", TestData.ValidRequest("Renamed User"));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal("Renamed User", (await client.GetFromJsonAsync<UserResponse>($"/api/users/{created.Id}"))!.Name);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/users/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/users/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Guest_can_create_read_and_update_but_not_delete()
    {
        var client = _factory.CreateAuthenticatedClient(ApiTestFactory.GuestEmail);

        var create = await client.PostAsJsonAsync("/api/users", TestData.ValidRequest("Guest Created"));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = (await create.Content.ReadFromJsonAsync<UserResponse>())!;

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/users/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/users/{created.Id}", TestData.ValidRequest("Guest Renamed"))).StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/users/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/users/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Guest_gets_403_rather_than_404_when_deleting_a_missing_user()
    {
        var response = await _factory.CreateAuthenticatedClient().DeleteAsync("/api/users/99999");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData(ApiTestFactory.AdminEmail, Roles.Admin)]
    [InlineData("ADMIN@Example.com", Roles.Admin)]
    [InlineData(ApiTestFactory.GuestEmail, Roles.Guest)]
    [InlineData(ApiTestFactory.UnmappedEmail, Roles.Guest)]
    public async Task Me_returns_the_role_assigned_from_configuration(string email, string expectedRole)
    {
        var me = await _factory.CreateAuthenticatedClient(email).GetFromJsonAsync<CurrentUserResponse>("/api/me");

        Assert.Equal(email, me!.Email);
        Assert.Equal([expectedRole], me.Roles);
    }

    [Fact]
    public async Task Post_with_invalid_payload_returns_400_with_field_errors()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/users", new { name = "A", age = 150, city = "", state = "KA", pincode = "12" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Contains("Name", problem!.Errors.Keys);
        Assert.Contains("Age", problem.Errors.Keys);
        Assert.Contains("City", problem.Errors.Keys);
        Assert.Contains("Pincode", problem.Errors.Keys);
        Assert.DoesNotContain("State", problem.Errors.Keys);
    }

    [Fact]
    public async Task Put_with_invalid_payload_returns_400()
    {
        var response = await _factory.CreateAuthenticatedClient().PutAsJsonAsync("/api/users/1", new { name = "Valid Name" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Missing_user_returns_404_for_get_put_and_delete()
    {
        var client = _factory.CreateAdminClient();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/users/99999")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync("/api/users/99999", TestData.ValidRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync("/api/users/99999")).StatusCode);
    }

    [Fact]
    public async Task Swagger_document_is_available_anonymously()
    {
        var response = await _factory.CreateClient().GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("/api/users/{id}", await response.Content.ReadAsStringAsync());
    }
}
