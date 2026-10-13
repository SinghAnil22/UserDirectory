using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UserDirectory.Api.Auth;

namespace UserDirectory.Api.Tests;

/// <summary>
/// Hosts the real API in-memory against a throwaway SQLite file, replacing OIDC JWT validation
/// with a fake scheme so tests don't need a running identity provider.
/// </summary>
public sealed class ApiTestFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin@example.com";
    public const string GuestEmail = "guest@example.com";
    /// <summary>Signed in but not listed in the role mapping, so gets the default role.</summary>
    public const string UnmappedEmail = "someone@example.com";

    /// <summary>Default role for unmapped users; null denies them.</summary>
    public string? DefaultRole { get; init; } = Roles.Guest;

    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"userdir-tests-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_dbPath};Pooling=False");
        builder.UseSetting("Seed:Enabled", "false");

        builder.ConfigureTestServices(services =>
        {
            // Replace the mapping from roles.json so tests don't depend on the file's contents.
            services.PostConfigure<RoleMappingSettings>(options =>
            {
                options.DefaultRole = DefaultRole;
                options.Users =
                [
                    new() { Email = AdminEmail, Role = Roles.Admin },
                    new() { Email = GuestEmail, Role = Roles.Guest },
                ];
            });
            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });
        });
    }

    /// <summary>A client signed in as <paramref name="email"/>; defaults to a Guest.</summary>
    public HttpClient CreateAuthenticatedClient(string email = GuestEmail)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Test", email);
        return client;
    }

    public HttpClient CreateAdminClient() => CreateAuthenticatedClient(AdminEmail);

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (File.Exists(_dbPath)) File.Delete(_dbPath);
    }
}

/// <summary>Authenticates any request carrying "Authorization: Test &lt;email&gt;" as that verified email; everything else is anonymous.</summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith($"{SchemeName} ", StringComparison.Ordinal))
            return Task.FromResult(AuthenticateResult.NoResult());

        var email = header[(SchemeName.Length + 1)..];
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, email), new Claim("email", email), new Claim("email_verified", "true")], SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}
