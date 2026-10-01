# BroCo Mod Database Schema Specification

## 1. Database Engine & Extensions

- **Database Engine:** PostgreSQL 16
- **Spatial Extension:** PostGIS 3.4
- **Coordinate Reference System:** WGS84 (SRID 4326)
- **Spatial Column Type:** `geography(Point, 4326)` for geodesic spheroid distance calculations in meters.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 2. Table Specifications

### 2.1. `Garages`
Stores onboarded garages and their verified geospatial coordinates.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique identifier |
| `Name` | `VARCHAR(200)` | `NOT NULL` | Workshop business name |
| `Email` | `VARCHAR(200)` | `NOT NULL` | Business contact email |
| `PhoneNumber` | `VARCHAR(50)` | `NOT NULL` | Contact telephone number |
| `Address` | `VARCHAR(500)` | `NOT NULL` | Physical facility address |
| `Location` | `geography(Point, 4326)` | `NOT NULL` | Geolocation coordinates (Lng, Lat) |
| `IsActive` | `BOOLEAN` | `DEFAULT TRUE` | Operational state |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Audit creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMPTZ` | `NULL` | Audit update timestamp |

**Indexes:**
- `CREATE INDEX "IX_Garages_Location" ON "Garages" USING GIST ("Location");`

---

### 2.2. `ServiceRequests`
Stores customer repair/maintenance submissions and origin locations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique identifier |
| `CustomerId` | `UUID` | `NOT NULL` | Identifier of customer account |
| `VehicleMake` | `VARCHAR(100)` | `NOT NULL` | E.g., Toyota, BMW |
| `VehicleModel` | `VARCHAR(100)` | `NOT NULL` | E.g., Camry, 330i |
| `VehicleYear` | `INTEGER` | `NOT NULL` | Manufacture year |
| `Description` | `VARCHAR(2000)` | `NOT NULL` | Customer description of fault |
| `CustomerLocation`| `geography(Point, 4326)` | `NOT NULL` | Pickup/service request coordinates |
| `RadiusKm` | `DOUBLE PRECISION`| `DEFAULT 10.0`| Configurable search radius |
| `Status` | `INTEGER` | `NOT NULL` | State machine enum value |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Audit creation timestamp |

**Indexes:**
- `CREATE INDEX "IX_ServiceRequests_CustomerLocation" ON "ServiceRequests" USING GIST ("CustomerLocation");`

---

### 2.3. `GarageQuotes` (CONFIDENTIAL INTERNAL)
Stores internal cost calculations submitted by garages.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique identifier |
| `ServiceRequestId`| `UUID` | `FK -> ServiceRequests(Id)` | Associated service request |
| `GarageId` | `UUID` | `FK -> Garages(Id)` | Bidding garage |
| `GarageInternalPrice` | `NUMERIC(18,2)` | `NOT NULL` | Wholesale garage quote |
| `InternalCostBreakdown` | `VARCHAR(4000)`| `NOT NULL` | Confidential parts & labor costs |
| `GarageNotes` | `VARCHAR(2000)`| `NULL` | Garage technical notes |
| `EstimatedDurationHours`| `INTEGER` | `NOT NULL` | Estimated labor duration |
| `Status` | `INTEGER` | `NOT NULL` | Quote status enum |

> **SECURITY:** NEVER query this table directly for customer requests.

---

### 2.4. `CustomerQuotations` (CUSTOMER-FACING)
Stores advisor-reviewed and customer-facing proposals.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique identifier |
| `ServiceRequestId`| `UUID` | `FK -> ServiceRequests(Id)` | Associated service request |
| `AssignedGarageId`| `UUID` | `NOT NULL` | Winning garage ID |
| `CustomerFacingPrice` | `NUMERIC(18,2)` | `NOT NULL` | Sanitized retail price |
| `AdvisorMarginApplied`| `NUMERIC(18,2)` | `NOT NULL` | Calculated margin |
| `ScopeSummary` | `VARCHAR(2000)`| `NOT NULL` | Customer-visible scope |
| `AdvisorNotes` | `VARCHAR(2000)`| `NULL` | Advisor advice for customer |
| `Status` | `INTEGER` | `NOT NULL` | Proposal status enum |

---

## 3. PostGIS Radius Search Query

```sql
-- High performance geospatial query utilizing GIST index:
SELECT "Id", "Name", "Address",
       ST_Distance("Location", ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) / 1000.0 AS DistanceKm
FROM "Garages"
WHERE "IsActive" = TRUE
  AND ST_DWithin(
        "Location",
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
        :radiusKm * 1000.0
      )
ORDER BY DistanceKm ASC;
```
