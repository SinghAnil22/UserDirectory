namespace UserDirectory.Api.Contracts;

public record CurrentUserResponse(string? Email, IReadOnlyList<string> Roles);
