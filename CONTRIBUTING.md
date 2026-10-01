# Contributing to BroCo Mod

Thank you for contributing to **BroCo Mod**. This document establishes the branch-aware Git workflow, code standards, data isolation rules, and review processes.

---

## 1. Branch-Aware Development Workflow

We follow a strict branch lifecycle modeled after GitFlow:

```
feature/*  ───>  develop (Integration)  ───>  release/*  ───>  main (Production)
                  ▲                                             │
                  └──────────── (hotfix/*) ─────────────────────┘
```

### Branch Definitions

| Branch | Purpose | Direct Commits Allowed? | Deployment Target |
| :--- | :--- | :--- | :--- |
| `main` | Production releases only | **NO** (Strictly via PR from `release/*` or `hotfix/*`) | Production |
| `develop` | Active integration branch | **NO** (Strictly via PR from `feature/*`) | Staging / QA |
| `feature/*` | Feature development | **YES** (by feature owner) | Local Dev / Preview |
| `release/*` | Release stabilization & version bump | **YES** (bugfixes only) | UAT / Pre-prod |
| `hotfix/*` | Critical production bugfixes | **YES** | Staging & Prod |

> **RULE:** Never commit directly to `main` for normal development. All changes must pass CI validation before merging.

### Creating a Feature Branch

```bash
# 1. Start from latest develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/radius-spatial-query

# 3. Commit changes (following conventional commits)
git commit -m "feat(geo): implement 10km spatial radius filter"

# 4. Open Pull Request targeting develop
```

---

## 2. Security & Data Isolation Policy

### Pricing Security Mandate
Garage internal pricing and internal cost breakdowns must **NEVER** be exposed to customers through frontend or backend APIs.

- **DTO Projections:** Use `CustomerQuoteViewDto` for customer-facing responses. Never return `GarageQuote` entities or `GarageInternalPrice` directly.
- **Authorization Policies:** Guard internal pricing query endpoints using `AssertCanViewInternalPricing(role)` checks.
- **Secrets Management:** NEVER commit secrets, credentials, API keys, passwords, JWT secrets, database connection strings, or `.env` files to git. Use environment variables or cloud secret managers.

---

## 3. Pull Request Requirements

Before a PR can be merged into `develop` or `main`:

1. All unit tests must pass: `dotnet test tests/BroCoMod.UnitTests`
2. All integration tests must pass: `dotnet test tests/BroCoMod.IntegrationTests`
3. Frontend builds and passes linter: `npm run build && npm run lint`
4. GitHub Actions CI pipeline passes with green status.
5. Code review approved by at least one maintainer.
