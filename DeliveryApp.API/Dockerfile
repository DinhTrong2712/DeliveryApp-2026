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

# Non-root user for safety
RUN groupadd -r app && useradd -r -g app app \
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
