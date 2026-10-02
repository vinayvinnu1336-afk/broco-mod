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
| `/requests` | GET | List of service requests submitted by the authenticated customer |
| `/quotes` | GET | Sanitized customer quotations (strictly hides garage internal pricing) |
| `/quotes/{id}` | GET | Specific quotation proposal detail |

---

## 5. Garage Portal Endpoints (`/api/v1/garage`)
*Restricted to `GARAGE_OWNER`, `GARAGE_MANAGER`, `GARAGE_STAFF`, and `SUPER_ADMIN`.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Workshop statistics, nearby available requests, submitted quotes |
| `/profile` | GET | Workshop facility location, PostGIS coordinates, and team members |
| `/requests` | GET | Service requests dispatched within the workshop's 10 KM radius |
| `/quotes` | GET | Confidential workshop cost bids submitted to advisors |

---

## 6. Technical Advisor Endpoints (`/api/v1/advisor`)
*Restricted to `ADVISOR` and `SUPER_ADMIN`.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Pending reviews queue, active requests, and assigned garages count |
| `/profile` | GET | Advisor employee code and specialization credentials |
| `/requests` | GET | Customer requests dispatched for workshop quotation |
| `/quotes` | GET | Workshop bids under review with recommended margin markup calculations |
| `/assignments` | GET | Customer-accepted repair contract allocations |

---

## 7. Super Admin Portal Endpoints (`/api/v1/admin`)
*Restricted exclusively to `SUPER_ADMIN`.*

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | GET | Platform-wide totals and live security telemetry |
| `/users` | GET | Full user account list across all roles |
| `/users/{id}/status` | POST | Activates or suspends a platform user |
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
