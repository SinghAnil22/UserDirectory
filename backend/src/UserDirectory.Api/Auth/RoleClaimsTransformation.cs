using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace UserDirectory.Api.Auth;

/// <summary>
/// Google ID tokens carry no roles, so they are assigned here from the email → role mapping in roles.json.
/// Unverified emails are never looked up and get <see cref="RoleMappingSettings.DefaultRole"/>.
/// </summary>
public class RoleClaimsTransformation(IOptionsMonitor<RoleMappingSettings> settings) : IClaimsTransformation
{
    private const string AuthenticationType = "AppRoles";

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        // May run more than once per request; only add the roles once.
        if (principal.Identity?.IsAuthenticated != true ||
            principal.Identities.Any(i => i.AuthenticationType == AuthenticationType))
            return Task.FromResult(principal);

        var mappings = settings.CurrentValue;
        var verified = string.Equals(principal.FindFirstValue("email_verified"), "true", StringComparison.OrdinalIgnoreCase);
        var role = verified ? mappings.RoleFor(principal.FindFirstValue("email")) : mappings.DefaultRole;

        Claim[] claims = role is null ? [] : [new Claim(ClaimTypes.Role, role)];
        principal.AddIdentity(new ClaimsIdentity(claims, AuthenticationType));
        return Task.FromResult(principal);
    }
}
