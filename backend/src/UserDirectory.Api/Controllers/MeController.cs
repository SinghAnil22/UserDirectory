using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserDirectory.Api.Auth;
using UserDirectory.Api.Contracts;

namespace UserDirectory.Api.Controllers;

[ApiController]
[Authorize(Roles = Roles.Any)]
[Route("api/me")]
[Produces("application/json")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public class MeController : ControllerBase
{
    /// <summary>Returns the signed-in user's email and roles.</summary>
    [HttpGet]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    public ActionResult<CurrentUserResponse> Get() =>
        Ok(new CurrentUserResponse(
            User.FindFirstValue("email"),
            User.FindAll(ClaimTypes.Role).Select(c => c.Value).Distinct().ToList()));
}
