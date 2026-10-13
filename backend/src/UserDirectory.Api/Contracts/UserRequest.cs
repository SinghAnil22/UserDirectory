using System.ComponentModel.DataAnnotations;

namespace UserDirectory.Api.Contracts;

/// <summary>Payload used to create or update a user.</summary>
public class UserRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters.")]
    public string? Name { get; set; }

    [Required]
    [Range(0, 100, ErrorMessage = "Age must be between 0 and 100.")]
    public int? Age { get; set; }

    [Required]
    [StringLength(100, ErrorMessage = "City must be at most 100 characters.")]
    public string? City { get; set; }

    [Required]
    [StringLength(100, ErrorMessage = "State must be at most 100 characters.")]
    public string? State { get; set; }

    [Required]
    [StringLength(10, MinimumLength = 4, ErrorMessage = "Pincode must be between 4 and 10 characters.")]
    [RegularExpression("^[A-Za-z0-9 -]+$", ErrorMessage = "Pincode may only contain letters, digits, spaces and hyphens.")]
    public string? Pincode { get; set; }
}
