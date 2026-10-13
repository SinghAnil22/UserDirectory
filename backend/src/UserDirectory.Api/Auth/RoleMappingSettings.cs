using Microsoft.Extensions.Options;

namespace UserDirectory.Api.Auth;

/// <summary>Email → role mapping bound from the "RoleMappings" section of roles.json.</summary>
public class RoleMappingSettings
{
    public const string SectionName = "RoleMappings";

    /// <summary>Role for signed-in users not listed in <see cref="Users"/>; null denies them access.</summary>
    public string? DefaultRole { get; set; } = Roles.Guest;

    public List<UserRoleMapping> Users { get; set; } = [];

    /// <summary>The role mapped to <paramref name="email"/>, or <see cref="DefaultRole"/> if it isn't listed.</summary>
    public string? RoleFor(string? email) =>
        Users.FirstOrDefault(u => string.Equals(u.Email?.Trim(), email?.Trim(), StringComparison.OrdinalIgnoreCase))?.Role
        ?? DefaultRole;
}

public class UserRoleMapping
{
    public string? Email { get; set; }
    public string? Role { get; set; }
}

/// <summary>Rejects unknown roles, blank emails and duplicate emails so a typo can't silently grant or drop access.</summary>
public class RoleMappingSettingsValidator : IValidateOptions<RoleMappingSettings>
{
    private static readonly string[] KnownRoles = [Roles.Admin, Roles.Guest];

    public ValidateOptionsResult Validate(string? name, RoleMappingSettings settings)
    {
        var errors = new List<string>();

        if (settings.DefaultRole is not null && !KnownRoles.Contains(settings.DefaultRole))
            errors.Add($"RoleMappings:DefaultRole '{settings.DefaultRole}' must be one of {string.Join(", ", KnownRoles)} or null.");

        for (var i = 0; i < settings.Users.Count; i++)
        {
            var mapping = settings.Users[i];
            if (string.IsNullOrWhiteSpace(mapping.Email))
                errors.Add($"RoleMappings:Users:{i}:Email is required.");
            if (mapping.Role is null || !KnownRoles.Contains(mapping.Role))
                errors.Add($"RoleMappings:Users:{i}:Role '{mapping.Role}' must be one of {string.Join(", ", KnownRoles)}.");
        }

        var duplicates = settings.Users
            .Where(u => !string.IsNullOrWhiteSpace(u.Email))
            .GroupBy(u => u.Email!.Trim(), StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);
        errors.AddRange(duplicates.Select(email => $"RoleMappings:Users lists '{email}' more than once."));

        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}
