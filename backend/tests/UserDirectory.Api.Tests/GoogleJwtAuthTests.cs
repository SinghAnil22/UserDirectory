using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using UserDirectory.Api.Auth;

namespace UserDirectory.Api.Tests;

/// <summary>
/// Runs the real JWT bearer pipeline from Program.cs. Instead of downloading Google's signing keys,
/// the OIDC configuration is pinned to a local RSA key, so tokens shaped like Google ID tokens can be minted.
/// </summary>
public sealed class GoogleJwtFactory : WebApplicationFactory<Program>
{
    public const string ClientId = "test-client.apps.googleusercontent.com";
    public static readonly RsaSecurityKey SigningKey = new(RSA.Create(2048)) { KeyId = "test-key" };

    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"userdir-jwt-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_dbPath};Pooling=False");
        builder.UseSetting("Seed:Enabled", "false");
        builder.UseSetting("Auth:Audience", ClientId);

        builder.ConfigureTestServices(services =>
        {
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                var configuration = new OpenIdConnectConfiguration { Issuer = "https://accounts.google.com" };
                configuration.SigningKeys.Add(SigningKey);
                options.Configuration = configuration;
                options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(configuration);
            });
            services.PostConfigure<RoleMappingSettings>(options =>
            {
                options.DefaultRole = Roles.Guest;
                options.Users = [new() { Email = "admin@gmail.com", Role = Roles.Admin }];
            });
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (File.Exists(_dbPath)) File.Delete(_dbPath);
    }
}

public class GoogleJwtAuthTests(GoogleJwtFactory factory) : IClassFixture<GoogleJwtFactory>
{
    private static string CreateToken(
        string issuer = "https://accounts.google.com",
        string audience = GoogleJwtFactory.ClientId,
        DateTime? expires = null,
        SecurityKey? key = null,
        string email = "demo@gmail.com",
        bool emailVerified = true)
    {
        var now = DateTime.UtcNow;
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            IssuedAt = now.AddMinutes(-10),
            NotBefore = now.AddMinutes(-10),
            Expires = expires ?? now.AddHours(1),
            Subject = new ClaimsIdentity([new Claim("sub", "1234567890"), new Claim("email", email)]),
            Claims = new Dictionary<string, object> { ["email_verified"] = emailVerified },
            SigningCredentials = new SigningCredentials(key ?? GoogleJwtFactory.SigningKey, SecurityAlgorithms.RsaSha256),
        });
    }

    private HttpClient ClientWith(string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<HttpStatusCode> GetUsersWith(string token) =>
        (await ClientWith(token).GetAsync("/api/users")).StatusCode;

    [Theory]
    [InlineData("admin@gmail.com", true, HttpStatusCode.NotFound)]
    [InlineData("admin@gmail.com", false, HttpStatusCode.Forbidden)]
    [InlineData("demo@gmail.com", true, HttpStatusCode.Forbidden)]
    public async Task Only_a_verified_admin_email_may_delete(string email, bool emailVerified, HttpStatusCode expected)
    {
        var client = ClientWith(CreateToken(email: email, emailVerified: emailVerified));

        // 404 means the request got past authorization to a user that doesn't exist.
        Assert.Equal(expected, (await client.DeleteAsync("/api/users/99999")).StatusCode);
    }

    [Theory]
    [InlineData("https://accounts.google.com")]
    [InlineData("accounts.google.com")]
    public async Task Accepts_valid_google_id_token(string issuer)
    {
        Assert.Equal(HttpStatusCode.OK, await GetUsersWith(CreateToken(issuer: issuer)));
    }

    [Fact]
    public async Task Rejects_token_issued_for_another_client()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, await GetUsersWith(CreateToken(audience: "someone-else.apps.googleusercontent.com")));
    }

    [Fact]
    public async Task Rejects_token_from_another_issuer()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, await GetUsersWith(CreateToken(issuer: "https://evil.example.com")));
    }

    [Fact]
    public async Task Rejects_expired_token()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, await GetUsersWith(CreateToken(expires: DateTime.UtcNow.AddMinutes(-6))));
    }

    [Fact]
    public async Task Rejects_token_signed_with_unknown_key()
    {
        var forged = new RsaSecurityKey(RSA.Create(2048)) { KeyId = "test-key" };
        Assert.Equal(HttpStatusCode.Unauthorized, await GetUsersWith(CreateToken(key: forged)));
    }
}
