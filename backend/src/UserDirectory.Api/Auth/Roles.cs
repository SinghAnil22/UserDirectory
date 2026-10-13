namespace UserDirectory.Api.Auth;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Guest = "Guest";

    /// <summary>Every signed-in user has one of these roles.</summary>
    public const string Any = $"{Admin},{Guest}";
}
