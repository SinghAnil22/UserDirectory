using Microsoft.EntityFrameworkCore;
using UserDirectory.Api.Contracts;
using UserDirectory.Api.Data;
using UserDirectory.Api.Models;

namespace UserDirectory.Api.Services;

public class UserService(AppDbContext db, TimeProvider clock) : IUserService
{
    public async Task<IReadOnlyList<UserResponse>> GetAllAsync(CancellationToken ct = default) =>
        await db.Users.AsNoTracking()
            .OrderBy(u => u.Name)
            .Select(u => new UserResponse(u.Id, u.Name, u.Age, u.City, u.State, u.Pincode))
            .ToListAsync(ct);

    public async Task<UserResponse?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        return user is null ? null : UserResponse.From(user);
    }

    public async Task<UserResponse> CreateAsync(UserRequest request, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var user = new User { CreatedAtUtc = now };
        Apply(user, request, now);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return UserResponse.From(user);
    }

    public async Task<UserResponse?> UpdateAsync(int id, UserRequest request, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return null;

        Apply(user, request, clock.GetUtcNow().UtcDateTime);
        await db.SaveChangesAsync(ct);
        return UserResponse.From(user);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return false;

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static void Apply(User user, UserRequest request, DateTime now)
    {
        user.Name = request.Name!.Trim();
        user.Age = request.Age!.Value;
        user.City = request.City!.Trim();
        user.State = request.State!.Trim();
        user.Pincode = request.Pincode!.Trim();
        user.UpdatedAtUtc = now;
    }
}
