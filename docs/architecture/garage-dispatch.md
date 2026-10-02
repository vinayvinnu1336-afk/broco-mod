# PostGIS 10 KM Garage Matching & Dispatch Architecture

## 1. Overview
The BroCo Mod platform matches customer service requests to partner garages using geospatial queries powered by **PostgreSQL 16** and **PostGIS 3.4** (`NetTopologySuite`).

---

## 2. Spatial Modeling & SRID Standard
- **Coordinate Reference System**: EPSG:4326 (WGS84 spheroid).
- **PostGIS Column Type**: `geography(Point, 4326)` on `Garages.Location`, `ServiceLocations.Location`, and snapshot column `ServiceRequests.CustomerLocation`.
- **Spatial Index**: `GIST` indexes applied to all spatial columns to guarantee fast spatial bounding queries under heavy load.

---

## 3. Eligibility Criteria for Dispatch
A garage is eligible for automatic broadcast dispatch if and only if all the following conditions are satisfied:
1. `IsActive == true` (Garage account is active)
2. `IsVerified == true` (Garage has undergone manual platform verification)
3. `IsOperational == true` (Garage is open and operating)
4. `Geodetic Distance <= 10.0 KM` (`10,000 meters` evaluated on the WGS84 spheroid)

Garages outside the 10 KM perimeter, unverified garages, or non-operational facilities are strictly excluded from dispatch.

---

## 4. PostGIS ST_DWithin & Geodesic Distance
In `GarageMatchingService.cs`:
- Evaluates spatial proximity using `ST_DWithin` on geography types:
  ```csharp
  // Spatial filtering via NetTopologySuite + PostGIS provider
  g.Location.Distance(customerLocation) <= radiusMeters
  ```
- Calculates exact geodesic distance in kilometers on the spheroid.
- An in-memory geodesic Haversine fallback is maintained for InMemory provider test executions.

---

## 5. Domain Modeling: `GarageRequest`
Rather than linking garages directly to the customer entity, a separate `GarageRequest` junction record is created for each eligible matched workshop:
- Stores `ServiceRequestId`, `GarageId`, and calculated `DistanceKm`.
- Status lifecycle: `Pending` → `Notified` → `Viewed` → `Accepted` / `Declined` / `Expired`.
- **View Tracking**: When a workshop views the request detail (`GET /api/v1/garage/requests/{id}`), status automatically transitions to `Viewed` with `ViewedAtUtc` recorded.
- **Unique Constraint**: Composite index and constraint `(ServiceRequestId, GarageId)` prevent duplicate dispatches to the same workshop.

---

## 6. Strict Data Isolation Invariant
- **Customer Privacy**: Garages only receive the broad geographic area/city and problem description; exact customer street addresses and phone numbers are isolated until quotation selection.
- **Internal Garage Isolation**: Garages query incoming requests filtered strictly by their authenticated `GarageId`. A garage can never view or enumerate another garage's dispatch record or submitted internal quotes.
