using UserDirectory.Api.Models;

namespace UserDirectory.Api.Contracts;

public record UserResponse(int Id, string Name, int Age, string City, string State, string Pincode)
{
    public static UserResponse From(User user) =>
        new(user.Id, user.Name, user.Age, user.City, user.State, user.Pincode);
}
