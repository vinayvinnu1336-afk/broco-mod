# Service Request & Customer Booking Architecture

## 1. Overview
The Service Request lifecycle enables vehicle owners (Customers) to create and track repair, maintenance, and performance modification requests. These requests are geolocated and automatically broadcast to verified partner workshops located within a configurable 10 KM perimeter.

---

## 2. Customer Booking Flow
The customer booking experience is implemented as a 5-step transactional wizard (`/customer/requests/new`):

```
Customer Login
    ↓
1. Select Vehicle (from saved garage, verified against customer ownership)
    ↓
2. Service Location (Address, City, State, Pincode + Canonical WGS84 Latitude/Longitude)
    ↓
3. Describe Problem (Category, Symptoms, Minimum 5 chars, Preferred Service Date)
    ↓
4. Review Request (Complete summary + 10 KM dispatch notice)
    ↓
5. Submit Request (Dispatched with Idempotency-Key header)
    ↓
Request Number Generated (BM-XXXXXX via PostgreSQL Sequence)
    ↓
PostGIS 10 KM Spatial Matching Engine Evaluates Eligible Workshops
    ↓
Separate GarageRequest Records Created per Eligible Garage
    ↓
Advisors & Eligible Garages Notified Concurrently
```

---

## 3. Human-Readable Request Numbering (`BM-XXXXXX`)
Generated atomically via PostgreSQL sequence ServiceRequestNumberSeq.
The BM-XXXXXX identifier is a unique human-readable service request
reference. Sequence values are not guaranteed to be gapless.

- Requests receive a unique code formatted as `BM-XXXXXX` (e.g. `BM-100001`, `BM-100002`), starting at 100001.
- In-memory thread-safe fallback is provided for isolated unit testing suites.
- The `BM-XXXXXX` reference itself does not provide security against enumeration. Security must continue to rely on:
  - Authentication
  - Authorization
  - Ownership checks
  - Resource-level data isolation

---

## 4. Idempotency & Network Resilience
To prevent duplicate requests and duplicate garage dispatch notifications resulting from double clicks or network retries:
- API endpoint `POST /api/v1/customer/requests` accepts an optional `Idempotency-Key` header.
- The `IdempotencyKey` is indexed alongside `CustomerId`.
- When an identical idempotency key is received for the same customer, the backend skips re-creation and re-dispatch, returning the existing request detail idempotently with HTTP 200/201.

---

## 5. Security & Ownership Validation
Security relies strictly on defense-in-depth authorization policies and data isolation rather than reference code obscurity:
- **Authentication**: Every request endpoint requires a valid JWT bearer token.
- **Authorization**: Platform policies (`CustomerOnly`, `AdvisorOnly`, `GarageOnly`, `AdminOnly`) enforce role-based and permission-based portal boundaries.
- **Ownership Checks**: The service verifies that the selected `VehicleId` belongs to the authenticated customer (`vehicle.CustomerId == customerId`). Unauthorized attempts return HTTP 403 Forbidden.
- **Resource-Level Data Isolation**: Customers can only view and cancel their own service requests (`CustomerId == resolvedCustomerId`). Cross-customer query attempts return HTTP 404 Not Found.
- **Vehicle Active Status**: Inactive/decommissioned vehicles cannot be used for new bookings.
- **Cancellation**: Customers can cancel pending requests with a mandatory reason. Cancel actions update status to `CANCELLED`, record cancellation timestamps, and emit an audit log entry.
