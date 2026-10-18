# BroCo Platform

Production-grade automotive service brokerage platform built as a high-performance **modular monolith**. Connects customers with vetted local garages via dedicated advisor curation and geospatial matching.

---

## Architecture Overview

BroCo orchestrates four dedicated portals over a stateless backend core:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BroCo Portals                             │
├─────────────────┬─────────────────┬──────────────────┬─────────────────┤
│ Customer Portal │  Garage Portal  │  Advisor Portal  │SuperAdmin Portal│
└────────┬────────┴────────┬────────┴────────┬─────────┴────────┬────────┘
         │                 │                 │                  │
         └─────────────────┼─────────────────┴──────────────────┘
                           ▼
                  [ Reverse Proxy (Nginx) ]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [ Next.js Frontend ]        [ ASP.NET Core 8 Web API ]
                                (Clean Architecture Core)
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
             [ PostgreSQL + PostGIS ]             [ Redis 7 Cache ]
             (Spatial 10 KM Matching)           (Session & Fast State)
```

### The 4 Dedicated Portals

1. **Customer Portal:** Request submission, location pin, vehicle details, review sanitized customer proposals, approve or decline quotes.
2. **Garage Portal:** Local service request notifications within configurable radius (default 10 KM), internal cost calculation, internal quote submission.
3. **Advisor Portal:** Multi-garage quotation review, markup and margin management, customer quotation approval and assignment.
4. **Super Admin Portal:** System administration, garage onboarding, geospatial radius configuration, auditing.

---

## Core Service Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant API as BroCo Core API
    participant GIS as PostGIS Spatial Engine
    actor Garage as Garage
    actor Advisor as Service Advisor

    Customer->>API: 1. Submits service request with location (lat, lng)
    API->>GIS: 2. Find eligible garages within 10 KM (ST_DWithin)
    GIS-->>API: Returns nearby active garages
    API->>Garage: 3. Dispatches notification to eligible garages
    Garage->>API: 4. Reviews request & submits internal quote (costs + notes)
    API->>Advisor: 5. Advisor receives confidential garage quotations
    Advisor->>Advisor: 6. Reviews quotations (no markup: customer price = garage price)
    Advisor->>API: 7. Assigns garage & prepares customer-facing quotation
    API->>Customer: 8. Customer receives sanitized quotation (zero garage internal costs)
    Customer->>API: 9. Accepts quotation & pays 10% booking advance online
    API->>Garage: 10. Job confirmed; customer pays the rest at the garage
    Garage->>API: 11. Hands car over; pays BroCo 10% commission
```

---

**Fixed-price packages (Basic / Standard / Premium)** skip steps 2-8: the customer picks a car and package on the website, sees the price, pays 10% to book, and an advisor assigns a nearby garage. BroCo currently serves **Hyderabad** only. Full money rules: [docs/architecture/money-flow.md](docs/architecture/money-flow.md).

---

## Pricing Security & Data Isolation Mandate

> **CRITICAL REQUIREMENT:** Garage internal pricing, wholesale parts costs, and garage profit margins must **NEVER** be exposed to customers through frontend or backend APIs.

- **Data Segregation:** The database schema maintains separate entities (`GarageQuote` vs `CustomerQuotation`).
- **DTO Isolation:** Customer-facing endpoints strictly return `CustomerQuoteViewDto` which omits all internal pricing fields.
- **Policy Enforcement:** `QuoteDataIsolationPolicy` throws `DataIsolationViolationException` if any attempt is made by a Customer role to read internal pricing.

---

## Repository Structure

```
broco-mod/
├── .github/workflows/ci.yml       # GitHub Actions Continuous Integration
├── docs/                          # Comprehensive system documentation
│   ├── architecture/              # High-level architecture and portals
│   ├── database/                  # PostgreSQL + PostGIS schemas and spatial indexes
│   ├── api/                       # API contracts and DTO specifications
│   ├── decisions/                 # Architecture Decision Records (ADRs)
│   └── deployment/                # Production and deployment guidelines
├── src/
│   ├── backend/                   # ASP.NET Core Clean Architecture
│   │   ├── BroCoMod.Domain/       # Entities, Enums, Value Objects, Exceptions
│   │   ├── BroCoMod.Application/  # DTOs, Security Policies, Interfaces
│   │   ├── BroCoMod.Infrastructure/# EF Core, PostGIS Npgsql, Redis, Migrations
│   │   └── BroCoMod.Api/          # REST Controllers, Health Checks, Swagger
│   └── frontend/                  # Next.js 14 (App Router, Tailwind CSS)
├── tests/
│   ├── BroCoMod.UnitTests/        # Domain rules & pricing isolation unit tests
│   └── BroCoMod.IntegrationTests/ # WebApplicationFactory integration tests
├── docker/
│   ├── backend/Dockerfile         # Multi-stage ASP.NET Core 8 container
│   ├── frontend/Dockerfile        # Multi-stage Next.js standalone container
│   ├── nginx/                     # Reverse proxy routing config and Dockerfile
│   └── postgres/init-postgis.sql  # PostGIS extension initialization
├── infra/                         # Kubernetes manifests and Terraform scaffolds
├── docker-compose.yml             # Local multi-container development environment
├── docker-compose.override.yml.example
├── .gitignore
├── .dockerignore
├── .env.example
├── CONTRIBUTING.md
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/) (with Docker Compose)
- [.NET 8 SDK](https://dotnet.microsoft.com/)
- [Node.js 20+](https://nodejs.org/)

### Quickstart with Docker Compose

```bash
# 1. Clone repository
git clone <repo-url> broco-mod
cd broco-mod

# 2. Copy environment template
cp .env.example .env

# 3. Start complete environment
docker compose up -d

# 4. Verify running services
docker compose ps
```

Services will be accessible at:
- **Web App / Nginx:** [http://localhost](http://localhost)
- **Direct Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API & Swagger:** [http://localhost:5000/swagger](http://localhost:5000/swagger)
- **Health Endpoint:** [http://localhost:5000/health](http://localhost:5000/health)

---

## Running Locally for Development

### 1. Start Database & Redis Only

```bash
docker compose up -d postgres redis
```

### 2. Run Backend

```bash
dotnet build BroCoMod.sln
dotnet run --project src/backend/BroCoMod.Api
```

### 3. Run Frontend

```bash
cd src/frontend
npm install
npm run dev
```

### Google Maps

Optional. Without keys, booking step 3 uses an address form and "Use my current location" fills it from OpenStreetMap. To turn on the map, place search and Google addresses, put `GOOGLE_MAPS_BROWSER_KEY` and `GOOGLE_MAPS_SERVER_KEY` in `.env` and restart the API (`docker compose up -d backend`); the website reads the browser key at runtime, so no rebuild is needed. Step-by-step guide for creating and restricting the keys: [docs/google-maps-setup.md](docs/google-maps-setup.md).

### Payments

Online payments (the customer's 10% booking advance and the garage commission) go through Razorpay, which opens its own payment sheet on the page. Put `PAYMENT_PROVIDER=Razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and (for the second confirmation on a public server) `RAZORPAY_WEBHOOK_SECRET` in `.env`, then restart the API (`docker compose up -d backend`); the website learns the active provider from `GET /api/v1/config/public`, so no rebuild is needed. Test-mode keys (`rzp_test_...`) move no real money and work with Razorpay's test cards and UPI ids. Without keys the app uses the `DevelopmentFake` gateway, which marks payments paid without any money moving (Development only, or `ALLOW_FAKE_PAYMENTS=true` for a demo server). Step-by-step owner guide: [docs/razorpay-setup.md](docs/razorpay-setup.md).

---

## Testing

```bash
# Run unit tests
dotnet test tests/BroCoMod.UnitTests

# Run integration tests
dotnet test tests/BroCoMod.IntegrationTests

# Run all tests
dotnet test BroCoMod.sln
```

Integration tests need PostgreSQL + PostGIS. Point them at it with `ConnectionStrings__DefaultConnection`.

### End-to-end (Playwright)

Drives the real app on a phone-sized screen (and desktop for the page sweep) against a running API and frontend with demo data:

```bash
cd src/frontend
npx playwright test                       # everything
npx playwright test e2e/journey.spec.ts   # booking → quote → payment → job → payout
```

`E2E_BASE_URL`, `E2E_API_URL` and `E2E_CHANNEL` (default `msedge`) configure where it runs.

---

## Deployment

- **One command on a Hostinger VPS (KVM 1, 4 GB)** - owner's guide: [docs/deployment/hostinger-kvm1.md](docs/deployment/hostinger-kvm1.md).
  Images are built by GitHub Actions ([release-images.yml](.github/workflows/release-images.yml) on every push to `main`, pushed to
  `ghcr.io/vinayvinnu1336-afk/broco-mod-{backend,frontend,nginx}`); the server only pulls them.
  `scripts/deploy/setup-server.sh` installs Docker, swap, firewall, generated secrets, HTTPS and backups;
  `scripts/deploy/update.sh` and `status.sh` handle day two.
- **Manual reference** (any plan, build on the server or pull images): [docs/deployment/vps-hostinger.md](docs/deployment/vps-hostinger.md).
- UI rules: [docs/design/mobile-ui-guidelines.md](docs/design/mobile-ui-guidelines.md).

Releases come from `main` (`develop` → `main` merge); CI tests run on both branches.

---

## Branching Strategy

- `main`: Production releases only
- `develop`: Integration branch
- `feature/*`: Active feature development
- `release/*`: Release stabilization

Direct commits to `main` are disabled. Pull requests must pass all CI checks before merging.
