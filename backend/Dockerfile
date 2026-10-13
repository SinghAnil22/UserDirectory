# ---- build ------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/UserDirectory.Api/UserDirectory.Api.csproj src/UserDirectory.Api/
RUN dotnet restore src/UserDirectory.Api/UserDirectory.Api.csproj

COPY src/ src/
RUN dotnet publish src/UserDirectory.Api/UserDirectory.Api.csproj -c Release -o /app/publish --no-restore

# ---- runtime ----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# SQLite database lives on a volume mounted at /data (owned by the non-root "app" user).
RUN mkdir -p /data && chown app:app /data
VOLUME /data

COPY --from=build /app/publish .

USER app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ConnectionStrings__Default="Data Source=/data/app.db"
EXPOSE 8080

ENTRYPOINT ["dotnet", "UserDirectory.Api.dll"]
