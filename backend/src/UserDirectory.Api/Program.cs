using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using UserDirectory.Api.Auth;
using UserDirectory.Api.Data;
using UserDirectory.Api.Services;

var builder = WebApplication.CreateBuilder(args);
// Email → role mapping (Admin / Guest). Reloaded on change so roles can be edited without a restart.
builder.Configuration.AddJsonFile("roles.json", optional: false, reloadOnChange: true);

// ---- Data -------------------------------------------------------------------
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var connectionString = sp.GetRequiredService<IConfiguration>().GetConnectionString("Default")
                           ?? "Data Source=/data/app.db";
    options.UseSqlite(connectionString);
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IUserService, UserService>();

// ---- Auth (OIDC JWT bearer – Google ID tokens by default) -------------------
var authSettings = builder.Configuration.GetSection("Auth").Get<AuthSettings>() ?? new AuthSettings();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authSettings.Authority;
        if (!string.IsNullOrWhiteSpace(authSettings.MetadataAddress))
            options.MetadataAddress = authSettings.MetadataAddress;
        options.RequireHttpsMetadata = authSettings.RequireHttpsMetadata;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = authSettings.ValidIssuers,
            ValidateAudience = true,
            ValidAudience = authSettings.Audience,
            ValidateLifetime = true,
            NameClaimType = "email",
        };
    });
builder.Services.AddOptions<RoleMappingSettings>()
    .Bind(builder.Configuration.GetSection(RoleMappingSettings.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<RoleMappingSettings>, RoleMappingSettingsValidator>();
builder.Services.AddTransient<IClaimsTransformation, RoleClaimsTransformation>();
builder.Services.AddAuthorization();

// ---- Web --------------------------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddProblemDetails();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "User Directory API", Version = "v1" });
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, "UserDirectory.Api.xml"));

    var bearer = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste a Google ID token (the credential returned by Sign in with Google).",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
    };
    options.AddSecurityDefinition("Bearer", bearer);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [bearer] = [] });
});

var app = builder.Build();

if (string.IsNullOrWhiteSpace(authSettings.Audience))
    app.Logger.LogWarning("Auth:Audience is not set – every bearer token will be rejected. " +
                          "Set it to your Google OAuth Client ID (e.g. env var Auth__Audience).");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbInitializer.Initialize(db, app.Configuration.GetValue("Seed:Enabled", false));
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Configuration.GetValue("Swagger:Enabled", true))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();

app.Run();

public partial class Program;
