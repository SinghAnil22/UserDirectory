using UserDirectory.Api.Contracts;

namespace UserDirectory.Api.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserResponse>> GetAllAsync(CancellationToken ct = default);
    Task<UserResponse?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<UserResponse> CreateAsync(UserRequest request, CancellationToken ct = default);
    Task<UserResponse?> UpdateAsync(int id, UserRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
}
