# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# Stage 1: restore + publish (build SDK image)
# ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj first to leverage layer cache
COPY DeliveryApp.API/DeliveryApp.API.csproj DeliveryApp.API/
RUN dotnet restore DeliveryApp.API/DeliveryApp.API.csproj

# Copy the rest of the source
COPY DeliveryApp.API/ DeliveryApp.API/

RUN dotnet publish DeliveryApp.API/DeliveryApp.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ─────────────────────────────────────────────────────────────
# Stage 2: runtime (slim ASP.NET image)
# ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# postgresql-client-16 (matches the postgres:16 server) for pg_dump / psql,
# tzdata so DateTime.Now respects TZ=Asia/Ho_Chi_Minh, wget for HEALTHCHECK.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg lsb-release wget tzdata \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && apt-get purge -y --auto-remove curl gnupg lsb-release \
 && rm -rf /var/lib/apt/lists/*

# Non-root user for safety (idempotent — newer aspnet:8.0 images ship an 'app' user)
RUN (getent group app  || groupadd -r app) \
 && (getent passwd app || useradd  -r -g app app) \
 && mkdir -p /app/wwwroot /backups \
 && chown -R app:app /app /backups

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_NOLOGO=true

COPY --from=build --chown=app:app /app/publish ./

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["dotnet", "DeliveryApp.API.dll"]
