# BroCo Mod API Specifications

## 1. Design Principles

- **Stateless REST:** All requests carry self-contained authentication (JWT bearer tokens).
- **Format:** JSON payloads with standardized response envelopes (`ApiResponse<T>`).
- **Data Isolation:** Endpoints strictly emit role-safe DTO projections to enforce pricing security.
- **Rate Limiting:** Authentication routes are protected by a sliding-window rate limiter (30 requests/min).

---

## 2. Authentication & Identity (`/api/v1/auth`)

| Endpoint | Method | Auth | Roles | Description |
|---|---|---|---|---|
| `/register` | POST | Anonymous | Any | Register a new customer or workshop account |
| `/login` | POST | Anonymous | Any | Authenticate with email/password; returns JWT + Refresh Token |
| `/refresh-token` | POST | Anonymous | Any | Rotates refresh token and generates new JWT |
| `/revoke-token` | POST | Bearer | Any | Explicitly revokes a refresh token |
| `/logout` | POST | Bearer | Any | Revokes user refresh tokens and logs security audit |
| `/forgot-password` | POST | Anonymous | Any | Requests password reset OTP (timing-safe) |
| `/reset-password` | POST | Anonymous | Any | Submits reset token and sets new password |

### Standard Authentication Response Envelope
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "aGVsbG93b3JsZGNyeXB0b3JhbmRvbXRva2Vu...",
    "expiresInSeconds": 3600,
    "user": {
      "id": "f8a08d27-...",
      "email": "customer@brocomod.com",
      "fullName": "Jordan Hayes",
      "roles": ["CUSTOMER"],
      "permissions": ["CUSTOMER_REQUEST_CREATE", "CUSTOMER_QUOTE_VIEW"],
      "customerId": "0bb78c66-...",
      "garageId": null,
      "garageRole": null,
      "isActive": true
    }
  }
}
```

---

## 3. User Self-Service (`/api/v1/users`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/me` | GET | Bearer | Fetches current authenticated user profile, active roles, and permissions |

---

## 4. Customer Portal Endpoints (`/api/v1/customer`)
*Restricted to `CUSTOMER` and `SUPER_ADMIN` roles.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Aggregated customer statistics, recent requests, and pending quotes |
| `/profile` | GET | Customer personal details and communication preferences |
| `/vehicles` | GET | Customer's registered vehicle inventory |
| `/vehicles` | POST | Registers a new vehicle into the customer's garage |
| `/vehicles/{id}` | GET | Specific customer vehicle details |
| `/vehicles/{id}` | PUT | Updates vehicle details |
| `/vehicles/{id}` | DELETE | Soft-deletes a vehicle |
| `/vehicles/{id}/set-primary` | POST | Sets primary default vehicle |
| `/requests` | POST | Creates a service booking (supports `Idempotency-Key` header) and dispatches to 10 KM garages |
| `/requests` | GET | Paginated list of service requests submitted by the authenticated customer |
| `/requests/{id}` | GET | Detailed service request view with PostGIS location coordinates |
| `/requests/{id}/cancel` | POST | Cancels service request with customer reason |
| `/quotes` | GET | Sanitized customer quotations in SENT/ACCEPTED/REJECTED status (strictly hides garage internal pricing and notes) |
| `/quotes/{id}` | GET | Specific quotation proposal detail with customer-facing line items (403/404 if Draft or ReadyToSend) |
| `/quotes/{id}/accept` | POST | Customer accepts proposal (supports `Idempotency-Key` header/body); confirms booking and workshop assignment |
| `/quotes/{id}/reject` | POST | Customer declines proposal (requires mandatory reason & category); notifies advisor (confidential from garage) |
| `/quotes/{id}/decision` | GET | Retrieves customer's recorded decision and snapshot metadata |

---

## 5. Garage Portal Endpoints (`/api/v1/garage`)
*Restricted to `GARAGE_OWNER`, `GARAGE_MANAGER`, `GARAGE_STAFF`, and `SUPER_ADMIN`.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Workshop statistics, nearby available requests, submitted quotes |
| `/profile` | GET | Workshop facility location, PostGIS coordinates, and team members |
| `/requests` | GET | Paginated service requests dispatched within the workshop's 10 KM radius |
| `/requests/{id}` | GET | Dispatch detail with calculated distance; marks status as `VIEWED` |
| `/quotes` | GET | Paginated list of quotes belonging to authenticated workshop (supports status filter) |
| `/quotes/draft` | POST | Creates a draft quote for a dispatched garage request |
| `/quotes/{id}` | GET | Detailed quote with line items and immutable revision history |
| `/quotes/{id}` | PUT | Updates a draft quote (server recalculates all totals, discounts, taxes) |
| `/quotes/{id}/submit` | POST | Submits quote to advisors; creates immutable version snapshot (`v1`, etc.) |
| `/quotes/{id}/revision` | POST | Creates a new draft revision (`v{n+1}`) from an existing quote |
| `/quotes/{id}/withdraw` | POST | Withdraws a draft or submitted quote |
| `/confirmed-bookings` | GET | Retrieves confirmed customer service bookings assigned to authenticated workshop |

---

## 6. Technical Advisor Endpoints (`/api/v1/advisor`)
*Restricted to `ADVISOR` and `SUPER_ADMIN`.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Pending reviews queue, active requests, and assigned garages count |
| `/profile` | GET | Advisor employee code and specialization credentials |
| `/requests` | GET | Paginated customer requests dispatched for workshop quotation |
| `/requests/{id}` | GET | Detailed request inspection including all dispatched partner garages |
| `/requests/{id}/quotes` | GET | Multi-garage quote comparison summary with distance, pricing, and turnaround |
| `/requests/{id}/notes` | GET | List confidential internal advisor notes for service request |
| `/requests/{id}/notes` | POST | Create confidential internal advisor note |
| `/requests/{id}/notes/{noteId}` | PUT | Update internal note (Author advisor only) |
| `/requests/{id}/notes/{noteId}` | DELETE | Delete internal note (Author advisor only) |
| `/requests/{id}/assignment` | POST | Assign workshop & winning quote (Enforces single active assignment) |
| `/requests/{id}/assignment` | GET | Retrieve active workshop assignment for request |
| `/requests/{id}/customer-quotation` | POST | Create customer quotation draft from winning assignment |
| `/customer-quotations/{id}` | GET | Detailed customer quotation with version history and lineage |
| `/customer-quotations/{id}/draft` | PUT | Update customer quotation draft (Server recalculates totals) |
| `/customer-quotations/{id}/ready` | POST | Mark quotation ready to send; captures immutable version snapshot |
| `/customer-quotations/{id}/send` | POST | Formally dispatch curated quotation to customer portal |
| `/customer-quotations/{id}/decision` | GET | Inspect customer acceptance or decline decision with reason and category |
| `/quotes` | GET | Workshop bids under review across the platform |
| `/quotes/{id}` | GET | Full quote inspection: itemized line items, server-calculated totals, and version history |
| `/assignments` | GET | Customer-accepted repair contract allocations |

---

## 7. Super Admin Portal Endpoints (`/api/v1/admin`)
*Restricted exclusively to `SUPER_ADMIN`.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Platform-wide totals and live security telemetry |
| `/users` | GET | Full user account list across all roles |
| `/users/{id}/status` | POST | Activates or suspends a platform user |
| `/requests` | GET | Paginated platform-wide service requests with dispatched garage counts |
| `/requests/{id}` | GET | Complete audit and dispatch breakdown for any service request |
| `/quotes` | GET | Platform-wide audit of all partner garage quotations |
| `/quotes/{id}` | GET | Complete quotation audit breakdown including immutable snapshots |
| `/assignments` | GET | Platform-wide audit of all workshop assignments |
| `/customer-quotations` | GET | Platform-wide audit of all customer proposals and statuses |
| `/customer-quotations/{id}` | GET | Detailed audit view of specific customer quotation |
| `/customer-quotations/{id}/decision` | GET | Audit view of customer acceptance or decline decision with audit metadata |
| `/garages` | GET | Complete registry of certified partner garages |
| `/advisors` | GET | Certified technical advisor roster |
| `/audit` | GET | Security audit log trail with filter limits |
| `/settings` | GET | System operational parameters (radius, lockout limits, token lifecycles) |

---

## 8. Health & System Diagnostic Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/healthz` | GET | Anonymous | Fast probe for load balancers and orchestrators |
| `/api/system/info` | GET | Anonymous | Platform architecture overview and metadata |
| `/api/system/quote-isolation-demo` | GET | Anonymous | Interactive demonstration of pricing isolation |
