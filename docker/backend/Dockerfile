# Stage 1: Runtime Base
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

# Install curl for container health checks
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
USER app

# Stage 2: SDK Build & Restore
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for caching restore layer
COPY ["src/backend/BroCoMod.Domain/BroCoMod.Domain.csproj", "src/backend/BroCoMod.Domain/"]
COPY ["src/backend/BroCoMod.Application/BroCoMod.Application.csproj", "src/backend/BroCoMod.Application/"]
COPY ["src/backend/BroCoMod.Infrastructure/BroCoMod.Infrastructure.csproj", "src/backend/BroCoMod.Infrastructure/"]
COPY ["src/backend/BroCoMod.Api/BroCoMod.Api.csproj", "src/backend/BroCoMod.Api/"]
COPY ["tests/BroCoMod.UnitTests/BroCoMod.UnitTests.csproj", "tests/BroCoMod.UnitTests/"]
COPY ["tests/BroCoMod.IntegrationTests/BroCoMod.IntegrationTests.csproj", "tests/BroCoMod.IntegrationTests/"]
COPY ["BroCoMod.sln", "./"]

RUN dotnet restore "BroCoMod.sln"

# Copy source code and build
COPY . .
WORKDIR "/src/src/backend/BroCoMod.Api"
RUN dotnet build "BroCoMod.Api.csproj" -c Release -o /app/build

# Stage 3: Publish
FROM build AS publish
RUN dotnet publish "BroCoMod.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 4: Production Image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "BroCoMod.Api.dll"]
