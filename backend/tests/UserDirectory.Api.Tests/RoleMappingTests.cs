using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using UserDirectory.Api.Auth;

namespace UserDirectory.Api.Tests;

public class RoleMappingTests
{
    private static RoleMappingSettings Settings(string? defaultRole = Roles.Guest) => new()
    {
        DefaultRole = defaultRole,
        Users =
        [
            new() { Email = "boss@gmail.com", Role = Roles.Admin },
            new() { Email = "visitor@gmail.com", Role = Roles.Guest },
        ],
    };

    private static ClaimsPrincipal SignedIn(string email, bool verified = true) =>
        new(new ClaimsIdentity([new Claim("email", email), new Claim("email_verified", verified ? "true" : "false")], "Test"));

    private static async Task<string[]> RolesAfterTransform(RoleMappingSettings settings, ClaimsPrincipal principal)
    {
        var transformed = await new RoleClaimsTransformation(new StaticOptionsMonitor<RoleMappingSettings>(settings))
            .TransformAsync(principal);
        return transformed.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray();
    }

    [Theory]
    [InlineData("boss@gmail.com", Roles.Admin)]
    [InlineData("  BOSS@Gmail.com ", Roles.Admin)]
    [InlineData("visitor@gmail.com", Roles.Guest)]
    [InlineData("stranger@gmail.com", Roles.Guest)]
    [InlineData(null, Roles.Guest)]
    public void RoleFor_uses_the_mapping_then_the_default(string? email, string expected)
    {
        Assert.Equal(expected, Settings().RoleFor(email));
    }

    [Fact]
    public async Task Mapped_verified_email_gets_its_role_once_even_if_transformed_twice()
    {
        var settings = Settings();
        var principal = SignedIn("boss@gmail.com");

        await RolesAfterTransform(settings, principal);

        Assert.Equal([Roles.Admin], await RolesAfterTransform(settings, principal));
    }

    [Fact]
    public async Task Unverified_email_gets_the_default_role_even_if_mapped_to_admin()
    {
        Assert.Equal([Roles.Guest], await RolesAfterTransform(Settings(), SignedIn("boss@gmail.com", verified: false)));
    }

    [Fact]
    public async Task Unmapped_user_gets_no_role_when_the_default_is_null()
    {
        Assert.Empty(await RolesAfterTransform(Settings(defaultRole: null), SignedIn("stranger@gmail.com")));
        Assert.Equal([Roles.Guest], await RolesAfterTransform(Settings(defaultRole: null), SignedIn("visitor@gmail.com")));
    }

    [Fact]
    public async Task Anonymous_user_gets_no_role()
    {
        Assert.Empty(await RolesAfterTransform(Settings(), new ClaimsPrincipal(new ClaimsIdentity())));
    }

    [Fact]
    public void Validator_accepts_a_valid_mapping()
    {
        Assert.True(new RoleMappingSettingsValidator().Validate(null, Settings()).Succeeded);
        Assert.True(new RoleMappingSettingsValidator().Validate(null, Settings(defaultRole: null)).Succeeded);
    }

    [Fact]
    public void Validator_rejects_unknown_roles_blank_and_duplicate_emails()
    {
        var settings = new RoleMappingSettings
        {
            DefaultRole = "Viewer",
            Users =
            [
                new() { Email = "a@gmail.com", Role = "Superuser" },
                new() { Email = " ", Role = Roles.Guest },
                new() { Email = "b@gmail.com", Role = Roles.Admin },
                new() { Email = "B@gmail.com", Role = Roles.Guest },
            ],
        };

        var result = new RoleMappingSettingsValidator().Validate(null, settings);

        Assert.True(result.Failed);
        var failures = result.Failures!.ToList();
        Assert.Contains(failures, f => f.Contains("DefaultRole 'Viewer'"));
        Assert.Contains(failures, f => f.Contains("Users:0:Role 'Superuser'"));
        Assert.Contains(failures, f => f.Contains("Users:1:Email is required"));
        Assert.Contains(failures, f => f.Contains("'b@gmail.com' more than once"));
    }

    [Fact]
    public void The_shipped_roles_json_loads_and_is_valid()
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/UserDirectory.Api/roles.json"));
        var settings = new ConfigurationBuilder().AddJsonFile(path).Build()
            .GetSection(RoleMappingSettings.SectionName).Get<RoleMappingSettings>();

        Assert.NotNull(settings);
        Assert.NotEmpty(settings.Users);
        Assert.True(new RoleMappingSettingsValidator().Validate(null, settings).Succeeded);
    }

    private sealed class StaticOptionsMonitor<T>(T value) : IOptionsMonitor<T>
    {
        public T CurrentValue => value;
        public T Get(string? name) => value;
        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }
}
