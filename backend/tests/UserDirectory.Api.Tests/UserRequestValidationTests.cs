using System.ComponentModel.DataAnnotations;
using UserDirectory.Api.Contracts;

namespace UserDirectory.Api.Tests;

public class UserRequestValidationTests
{
    private static List<ValidationResult> Validate(UserRequest request)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(request, new ValidationContext(request), results, validateAllProperties: true);
        return results;
    }

    private static bool HasErrorFor(List<ValidationResult> results, string member) =>
        results.Any(r => r.MemberNames.Contains(member));

    [Fact]
    public void Valid_request_has_no_errors()
    {
        Assert.Empty(Validate(TestData.ValidRequest()));
    }

    [Fact]
    public void Missing_fields_are_all_reported()
    {
        var results = Validate(new UserRequest());

        foreach (var field in new[] { "Name", "Age", "City", "State", "Pincode" })
            Assert.True(HasErrorFor(results, field), $"Expected an error for {field}");
    }

    [Theory]
    [InlineData("A")]
    [InlineData("   ")]
    public void Name_shorter_than_two_characters_is_invalid(string name)
    {
        var request = TestData.ValidRequest();
        request.Name = name;

        Assert.True(HasErrorFor(Validate(request), "Name"));
    }

    [Fact]
    public void Name_longer_than_100_characters_is_invalid()
    {
        var request = TestData.ValidRequest();
        request.Name = new string('a', 101);

        Assert.True(HasErrorFor(Validate(request), "Name"));
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(100, true)]
    [InlineData(101, false)]
    public void Age_must_be_between_0_and_100(int age, bool valid)
    {
        var request = TestData.ValidRequest();
        request.Age = age;

        Assert.Equal(!valid, HasErrorFor(Validate(request), "Age"));
    }

    [Theory]
    [InlineData("123", false)]
    [InlineData("1234", true)]
    [InlineData("1234567890", true)]
    [InlineData("12345678901", false)]
    [InlineData("12$45", false)]
    [InlineData("SW1A 1AA", true)]
    public void Pincode_must_be_4_to_10_allowed_characters(string pincode, bool valid)
    {
        var request = TestData.ValidRequest();
        request.Pincode = pincode;

        Assert.Equal(!valid, HasErrorFor(Validate(request), "Pincode"));
    }
}
