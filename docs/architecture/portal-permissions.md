# Portal Matrix & Route Protection

## 1. Overview
The BroCo Mod frontend operates four dedicated portals, each protected by client-side route guards (`ProtectedRoute`) and enforced by backend ASP.NET Core authorization attributes (`[Authorize(Roles = ...)]`, `[HasPermission(...)]`).

---

## 2. Route & Role Matrix

| Portal | URL Path | Primary Role | Secondary Roles | Unauthorized Response |
|---|---|---|---|---|
| **Customer Portal** | `/customer/*` | `CUSTOMER` | `SUPER_ADMIN` | 403 Forbidden with prompt to go to authorized portal |
| **Garage Portal** | `/garage/*` | `GARAGE_OWNER` | `GARAGE_MANAGER`, `GARAGE_STAFF`, `SUPER_ADMIN` | 403 Forbidden |
| **Advisor Portal** | `/advisor/*` | `ADVISOR` | `SUPER_ADMIN` | 403 Forbidden |
| **Super Admin Portal** | `/admin/*` | `SUPER_ADMIN` | None | 403 Forbidden |

---

## 3. Sub-Route Inventory

### 3.1 Customer Portal (`/customer`)
- `/customer/dashboard` — Metric counters, recent requests, pending quotations.
- `/customer/vehicles` — Vehicle inventory with full create/edit capability.
- `/customer/requests` — Active service and modification requests.
- `/customer/quotes` — Curated quotations with sanitized pricing only.
- `/customer/profile` — Contact information and communication preferences.

### 3.2 Garage Portal (`/garage`)
- `/garage/dashboard` — Workshop operating overview and dispatches count.
- `/garage/requests` — Requests dispatched within 10 KM radial perimeter.
- `/garage/quotes` — Direct workshop internal cost bids under advisor review.
- `/garage/profile` — Workshop coordinates (PostGIS) and authorized team roster.

### 3.3 Advisor Portal (`/advisor`)
- `/advisor/dashboard` — Advisor console with pending review queues.
- `/advisor/requests` — Vehicle repair inquiries requiring technical validation.
- `/advisor/quotes` — Multi-garage quote comparison and margin application.
- `/advisor/assignments` — Final customer-accepted repair allocations.
- `/advisor/profile` — Technical certifications and specialization details.

### 3.4 Super Admin Portal (`/admin`)
- `/admin/dashboard` — System-wide telemetry, user count, and real-time audit.
- `/admin/customers` — Account management with user suspension/activation controls.
- `/admin/garages` — Partner workshop network auditing and onboarding.
- `/admin/advisors` — Technical advisor capacity and workload tracking.
- `/admin/requests` — Platform dispatch overview.
- `/admin/vehicle-master` — Master automotive model and trim schemas.
- `/admin/settings` — Radial search distance (10 KM default) and lockout rules.
- `/admin/audit` — Immutable chronological audit log with filter capabilities.
