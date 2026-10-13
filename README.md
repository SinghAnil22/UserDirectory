# User Directory

A small full-stack app for managing users. It has a **React** single-page app (Login, Add, List), a **.NET 8 Web API** with full CRUD, and **SQLite** persistence. Users sign in with their **Google (Gmail) account** through OAuth 2.0 / OpenID Connect, and every API call is protected by **Google-signed JWT bearer tokens**.

## 1. One-time setup: Google OAuth Client ID

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials). If prompted, configure the **OAuth consent screen**: External, app name, your email. While in *Testing*, add your Gmail address as a test user.
2. Click **Create credentials → OAuth client ID → Application type: Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost`, `http://localhost:5173` and `http://localhost:3000`. No redirect URI is needed.
4. Copy the **Client ID** (`xxxx.apps.googleusercontent.com`). It is public, not a secret. Put it in:

| Where | File | Setting |
|---|---|---|
| Frontend (local dev) | `frontend/.env.local` | `VITE_GOOGLE_CLIENT_ID=<client id>` |
| API (local dev) | `backend/src/UserDirectory.Api/appsettings.Development.json` | `"Auth": { "Audience": "<client id>" }` |
| Docker | `.env` in the repo root | `GOOGLE_CLIENT_ID=<client id>` |

## 2. Run

**Locally** (two terminals):

```bash
dotnet run --project backend/src/UserDirectory.Api      # API + Swagger on http://localhost:5000/swagger
cd frontend && npm install && npm run dev                # App on http://localhost:5173 (proxies /api → :5000)
```

**Docker:** `docker compose up --build`. This serves the app at http://localhost:3000 and the API at http://localhost:5000/swagger. The DB lives at `/data/app.db` on the `api-data` volume; run `docker compose down -v` to reset it.

**Tests:** `dotnet test UserDirectory.slnx` (44 tests) · `cd frontend && npm test` (56 tests)

## Structure

```
UserDirectory/
├── docker-compose.yml, .env.example    api + web containers
├── backend/
│   ├── Dockerfile                      multi-stage SDK → aspnet runtime (non-root, /data volume)
│   ├── src/UserDirectory.Api/
│   │   ├── Program.cs                  DI, JWT bearer (Google), CORS, Swagger, DB init
│   │   ├── Controllers/UsersController.cs   GET/GET{id}/POST/PUT/DELETE /api/users
│   │   ├── Contracts/                  UserRequest (DataAnnotations validation), UserResponse
│   │   ├── Services/UserService.cs     business logic over EF Core
│   │   ├── Data/                       AppDbContext, DbInitializer (EnsureCreated + optional seed)
│   │   └── Auth/AuthSettings.cs        issuer/audience settings bound from config
│   └── tests/UserDirectory.Api.Tests/  xUnit: validation, service, controller, HTTP, real JWT validation
└── frontend/                           (also opens in Visual Studio via frontend.esproj)
    ├── Dockerfile, nginx.conf          Vite build → nginx (SPA fallback, /api proxied to the API)
    └── src/
        ├── pages/                      LoginPage, AddUserPage, UserListPage (+ *.test.tsx)
        ├── auth/                       AuthContext (session), googleIdentity (GIS loader), jwt, RequireAuth
        ├── api/usersApi.ts             fetch wrapper: bearer token, ApiError, ProblemDetails mapping
        ├── validation/                 client-side rules that mirror the API
        ├── components/, toast/         NavBar, Spinner, toast notifications
        └── styles.css                  plain CSS, no UI framework
```

## Frontend (React)

| Route | Page | Behaviour |
|---|---|---|
| `/login` | **Login** | Google's official **Sign in with Google** button. Shows clear errors if the Client ID is missing, the Google script can't load, or the token is rejected. Returns you to the page you originally requested. |
| `/users/new` | **Add** | Form with Name, Age, City, State, Pincode. Inline validation messages; spinner while saving. On success → redirect to List and show a success toast. |
| `/users` | **List** | Table with Name, Age, City, State, Pincode, loaded from `GET /api/users` on mount. Shows a spinner, an empty state, and an error with Retry. |

The top bar has **Add** and **List** links, plus the signed-in Google name and **Log out**. Add and List both require sign-in. The app uses `GET /api/users` and `POST /api/users` and shows network, 401 and 500 failures as friendly messages.

## How authentication works

1. The Login page loads **Google Identity Services** and renders the Sign in with Google button. The user picks their Gmail account in Google's popup.
2. Google returns an **ID token**: an RS256-signed JWT containing `iss=accounts.google.com`, `aud=<your client id>`, `email`, `name` and `exp`. Using OpenID Connect this way needs no client secret in the browser.
3. The SPA keeps the token in `sessionStorage`, shows the user's name, and sends `Authorization: Bearer <id token>` on every API call. It signs the user out automatically when the token expires (about 1 hour).
4. The API validates each token with ASP.NET Core JwtBearer. It downloads Google's signing keys from `https://accounts.google.com/.well-known/openid-configuration`, then checks the signature, issuer, audience (your Client ID) and lifetime. Anything else gets a **401**.

## Roles (authorization)

There are two roles. Google ID tokens carry no roles, so the API assigns them after validating the token:

| Role | Can |
|---|---|
| **Admin** | Everything, including **delete** |
| **Guest** | List, view, add and edit, but **not delete** (403) |

Roles are mapped to emails in [`backend/src/UserDirectory.Api/roles.json`](backend/src/UserDirectory.Api/roles.json):

```jsonc
{
  "RoleMappings": {
    "DefaultRole": "Guest",          // role for signed-in users not listed below; null = deny them (403)
    "Users": [
      { "Email": "you@gmail.com",    "Role": "Admin" },
      { "Email": "friend@gmail.com", "Role": "Guest" }
    ]
  }
}
```

- Emails are matched case-insensitively, and only when Google reports them as verified.
- The API refuses to start if the file lists an unknown role, a blank email or the same email twice.
- Edits are picked up automatically while the API runs locally. In Docker the file is mounted into the container; run `docker compose restart api` after editing it.
- `GET /api/me` returns the caller's email and roles; the List page uses it to hide **Delete** from Guests.

## API

`GET /api/users` → 200 · `GET /api/users/{id}` → 200/404 · `POST` → 201 + `Location` / 400 · `PUT /{id}` → 200/400/404 · `DELETE /{id}` → 204/404 (Admin only, else 403) · `GET /api/me` → 200 · missing or invalid token → 401.

- Invalid input returns RFC 7807 `ValidationProblemDetails`.
- Swagger UI is at `/swagger`. To call the API from it, click *Authorize* and paste a Google ID token.
- All settings can be overridden with environment variables, e.g. `ConnectionStrings__Default`, `Auth__Audience`, `Seed__Enabled`.

**Validation (client and server use the same rules):** Name 2–100 chars · Age integer 0–100 · City and State required (≤100) · Pincode 4–10 chars (letters, digits, space, hyphen).

## Development process

1. Defined the contract first: endpoints, status codes and validation rules shared between UI and API.
2. Built the API in layers (entity → DTOs → service → thin controller), then added JWT bearer auth and Swagger.
3. Wrote backend tests: validation rules, the service against in-memory SQLite, controller results, and HTTP tests via `WebApplicationFactory`. The JWT tests mint RS256 tokens with Google's issuer and check that wrong audience, issuer, key or expiry are rejected.
4. Built the SPA: validation → API client → pages → auth and route guard → styling.
5. Wrote frontend tests with Vitest + Testing Library, covering every page state, the API client, the auth session and JWT decoding. Google Identity Services is faked in tests.
6. Containerised everything with multi-stage Dockerfiles and an nginx reverse proxy for same-origin `/api` calls.
7. **Iteration:** the first version used a self-hosted Keycloak server, which needed Docker running. Sign-in was changed to Google directly so that users can log in with Gmail with no extra infrastructure.

**Trade-offs:**
- Any Google account can sign in. Restricting access, for example to an email allow-list, would be a small authorization policy on top.
- ID tokens are not refreshed silently, so users sign in again after about an hour.
- The DB schema is created with `EnsureCreated()` instead of EF migrations.

## Technologies & AI disclosure

**Backend:** .NET 8, ASP.NET Core Web API, EF Core 8 + SQLite, JwtBearer, Swashbuckle, xUnit, Mvc.Testing.
**Frontend:** React 19, TypeScript, Vite, React Router, Google Identity Services, Vitest, Testing Library, jsdom.
**Infra:** Docker, Docker Compose, nginx. **Identity provider:** Google (OAuth 2.0 / OpenID Connect).

