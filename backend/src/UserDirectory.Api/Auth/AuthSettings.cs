namespace UserDirectory.Api.Auth;

/// <summary>OIDC / JWT bearer settings bound from the "Auth" configuration section.</summary>
public class AuthSettings
{
    /// <summary>OIDC issuer used to discover signing keys. Defaults to Google.</summary>
    public string Authority { get; set; } = "https://accounts.google.com";

    /// <summary>Optional explicit metadata URL (defaults to {Authority}/.well-known/openid-configuration).</summary>
    public string? MetadataAddress { get; set; }

    /// <summary>Expected "aud" claim. For Google ID tokens this is the OAuth 2.0 Client ID of the web app.</summary>
    public string? Audience { get; set; }

    /// <summary>Accepted "iss" values. Google issues tokens as either form.</summary>
    public string[] ValidIssuers { get; set; } = ["https://accounts.google.com", "accounts.google.com"];

    public bool RequireHttpsMetadata { get; set; } = true;
}
