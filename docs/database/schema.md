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

## 2. Platform Core Tables

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
| `VehicleMake` | `VARCHAR(100)` | `NOT NULL` | E.g., BMW, Audi |
| `VehicleModel` | `VARCHAR(100)` | `NOT NULL` | E.g., M340i, RS3 |
| `VehicleYear` | `INTEGER` | `NOT NULL` | Manufacture year |
| `Description` | `VARCHAR(2000)` | `NOT NULL` | Customer description of fault/upgrade |
| `CustomerLocation`| `geography(Point, 4326)` | `NOT NULL` | Pickup/service request coordinates |
| `RadiusKm` | `DOUBLE PRECISION`| `DEFAULT 10.0`| Configurable search radius |
| `Status` | `INTEGER` | `NOT NULL` | State machine enum value |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Audit creation timestamp |

**Indexes:**
- `CREATE INDEX "IX_ServiceRequests_CustomerLocation" ON "ServiceRequests" USING GIST ("CustomerLocation");`

---

### 2.3. `GarageQuotes` (CONFIDENTIAL INTERNAL)
Stores internal wholesale cost calculations submitted by garages.

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

> **SECURITY NOTICE:** Segregated by role policy. Never query this table for Customer endpoints.

---

### 2.4. `CustomerQuotations` (CUSTOMER-FACING)
Stores advisor-reviewed and sanitized customer-facing proposals.

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

## 3. Identity & Security Tables (Milestone 2)

### 3.1. `Users`
Authentication and platform identity core. Role-specific attributes are partitioned into profile tables.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique user identifier |
| `Email` | `VARCHAR(256)` | `NOT NULL` | User email address |
| `NormalizedEmail`| `VARCHAR(256)` | `NOT NULL, UNIQUE` | Uppercase normalized email |
| `FullName` | `VARCHAR(200)` | `NOT NULL` | User full legal name |
| `PhoneNumber` | `VARCHAR(50)` | `NOT NULL` | Contact telephone number |
| `PasswordHash` | `TEXT` | `NOT NULL` | PBKDF2 HMAC-SHA512 hash |
| `Salt` | `TEXT` | `NOT NULL` | 256-bit cryptographically secure salt |
| `IsActive` | `BOOLEAN` | `DEFAULT TRUE` | Operational state (suspended/active) |
| `IsEmailConfirmed`| `BOOLEAN` | `DEFAULT TRUE` | Email verification flag |
| `FailedLoginAttempts`| `INTEGER` | `DEFAULT 0` | Failed attempts counter |
| `LockoutEndUtc`| `TIMESTAMPTZ` | `NULL` | Brute force lockout expiration |

---

### 3.2. `Roles` & `Permissions`
Fine-grained Role-Based Access Control (RBAC).

- **`Roles`**: `Id`, `Name` (UNIQUE), `NormalizedName`, `Description`.
- **`Permissions`**: `Id`, `Code` (UNIQUE), `Description`, `Category`.
- **`UserRoles`**: Composite PK `(UserId, RoleId)`.
- **`RolePermissions`**: Composite PK `(RoleId, PermissionId)`.

---

### 3.3. `RefreshTokens`
Cryptographic refresh token rotation & reuse detection.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Token record ID |
| `UserId` | `UUID` | `FK -> Users(Id)` | User owner |
| `TokenHash` | `VARCHAR(256)` | `NOT NULL` | SHA256 hash of refresh token |
| `ReplacedByTokenHash`| `VARCHAR(256)`| `NULL` | Hash of successor token on rotation |
| `ExpiresAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Absolute token expiration |
| `RevokedAtUtc` | `TIMESTAMPTZ` | `NULL` | Timestamp token was revoked |
| `ReasonRevoked` | `VARCHAR(500)` | `NULL` | Revocation rationale |

---

### 3.4. Role Profile Tables
Strict separation of concerns separating authentication from role domain attributes:
- **`CustomerProfiles`**: `Id`, `UserId` (UNIQUE), `Address`, `PreferredContactMethod`.
- **`GarageUsers`**: `Id`, `UserId` (UNIQUE), `GarageId` (FK), `RoleName` (`GARAGE_OWNER`, `GARAGE_MANAGER`, `GARAGE_STAFF`), `Title`.
- **`AdvisorProfiles`**: `Id`, `UserId` (UNIQUE), `EmployeeCode`, `Specialization`, `MaxAssignedRequests`.
- **`AuditLogs`**: `Id`, `Action`, `UserId`, `UserEmail`, `EntityName`, `EntityId`, `Details`, `IpAddress`, `TimestampUtc`.

---

## 4. Vehicle Master & Customer Inventory

### 4.1. `VehicleManufacturers`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique manufacturer ID |
| `Name` | `VARCHAR(100)` | `NOT NULL` | Brand name (e.g. BMW, Audi) |
| `NormalizedName` | `VARCHAR(100)` | `UNIQUE` | Uppercase normalized name |
| `Country` | `VARCHAR(100)` | `NOT NULL` | Origin nation |
| `LogoUrl` | `VARCHAR(500)` | `NOT NULL` | Asset path or CDN URI |
| `DisplayOrder` | `INTEGER` | `NOT NULL` | Priority sorting order |
| `IsActive` | `BOOLEAN` | `NOT NULL` | Activation toggle |

### 4.2. `VehicleModels`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique model ID |
| `ManufacturerId` | `UUID` | `FK -> VehicleManufacturers(Id)` | Parent manufacturer |
| `Name` | `VARCHAR(100)` | `NOT NULL` | Model name (e.g. 3 Series) |
| `NormalizedName` | `VARCHAR(100)` | `NOT NULL` | Uppercase normalized name |
| `BodyType` | `VARCHAR(50)` | `NOT NULL` | Sedan, Coupe, SUV, Wagon, etc. |
| `YearFrom` | `INTEGER` | `NOT NULL` | Initial production year |
| `YearTo` | `INTEGER` | `NULL` | Final year or NULL if active |
| `IsActive` | `BOOLEAN` | `NOT NULL` | Activation toggle |

### 4.3. `VehicleVariants`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique variant ID |
| `ModelId` | `UUID` | `FK -> VehicleModels(Id)` | Parent model line |
| `Name` | `VARCHAR(100)` | `NOT NULL` | Trim name (e.g. M340i xDrive) |
| `Transmission` | `VARCHAR(50)` | `NOT NULL` | Automatic, Manual, DCT |
| `FuelType` | `INTEGER` | `NOT NULL` | Enum: Petrol(1), Diesel(2), EV(3), etc. |
| `EngineDisplacementCc` | `INTEGER` | `NULL` | Engine displacement |
| `Horsepower` | `INTEGER` | `NULL` | Rated peak horsepower |
| `YearFrom` | `INTEGER` | `NOT NULL` | Initial introduction year |
| `YearTo` | `INTEGER` | `NULL` | Final variant year |
| `IsActive` | `BOOLEAN` | `NOT NULL` | Activation toggle |

### 4.4. `CustomerVehicles`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Vehicle record ID |
| `CustomerId` | `UUID` | `INDEX` | Owning customer ID |
| `ManufacturerId` | `UUID` | `FK -> VehicleManufacturers(Id)` | Relational manufacturer link |
| `ModelId` | `UUID` | `FK -> VehicleModels(Id)` | Relational model link |
| `VariantId` | `UUID` | `FK -> VehicleVariants(Id) (NULL)` | Relational variant link |
| `Make` | `VARCHAR(100)` | `NOT NULL` | Denormalized make name |
| `Model` | `VARCHAR(100)` | `NOT NULL` | Denormalized model name |
| `VariantName` | `VARCHAR(100)` | `NOT NULL` | Denormalized variant name |
| `Year` | `INTEGER` | `NOT NULL` | Model year |
| `FuelType` | `INTEGER` | `NOT NULL` | Standard fuel type enum |
| `Transmission` | `VARCHAR(50)` | `NOT NULL` | Gearbox type |
| `LicensePlate` | `VARCHAR(50)` | `NOT NULL` | Vehicle registration plate |
| `Vin` | `VARCHAR(50)` | `NOT NULL` | Vehicle chassis number |
| `Mileage` | `INTEGER` | `NOT NULL` | Recorded odometer KM |
| `Color` | `VARCHAR(50)` | `NOT NULL` | Bodywork color |
| `IsPrimary` | `BOOLEAN` | `NOT NULL` | Customer default vehicle flag |
| `IsActive` | `BOOLEAN` | `NOT NULL` | Soft-delete / active status |

---

## 5. Service Requests, Locations & Dispatch (Milestone 4)

### 5.1. `ServiceLocations`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Service location ID |
| `AddressLine1` | `VARCHAR(250)` | `NOT NULL` | Street address or landmark |
| `AddressLine2` | `VARCHAR(250)` | `NULL` | Suite/apartment details |
| `City` | `VARCHAR(100)` | `NOT NULL` | City name |
| `State` | `VARCHAR(100)` | `NOT NULL` | State/province |
| `Pincode` | `VARCHAR(20)` | `NOT NULL` | Postal code |
| `Country` | `VARCHAR(100)` | `NOT NULL` | Country name |
| `Latitude` | `DOUBLE PRECISION` | `NOT NULL` | WGS84 latitude (-90 to 90) |
| `Longitude` | `DOUBLE PRECISION` | `NOT NULL` | WGS84 longitude (-180 to 180) |
| `Location` | `geography(Point, 4326)` | `NOT NULL, GIST INDEX` | PostGIS spatial point for geodetic distance |
| `FormattedAddress` | `VARCHAR(500)` | `NOT NULL` | Standardized readable address |

### 5.2. `ServiceRequests`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Service request ID |
| `RequestNumber` | `VARCHAR(32)` | `NOT NULL, UNIQUE INDEX` | Unique reference (`BM-XXXXXX`) via `ServiceRequestNumberSeq`. Values are not guaranteed to be gapless; security relies on auth and data isolation. |
| `CustomerId` | `UUID` | `FK -> CustomerProfiles(Id), INDEX` | Requesting customer ID |
| `CustomerVehicleId` | `UUID` | `FK -> CustomerVehicles(Id), INDEX` | Selected customer vehicle |
| `VehicleMake` | `VARCHAR(100)` | `NOT NULL` | Snapshot make |
| `VehicleModel` | `VARCHAR(100)` | `NOT NULL` | Snapshot model |
| `VehicleYear` | `INTEGER` | `NOT NULL` | Snapshot year |
| `VehicleLicensePlate` | `VARCHAR(50)` | `NOT NULL` | Snapshot registration |
| `ServiceLocationId` | `UUID` | `FK -> ServiceLocations(Id)` | Relational location entity |
| `CustomerLocation` | `geography(Point, 4326)` | `NOT NULL, GIST INDEX` | Snapshot spatial location |
| `ProblemDescription` | `VARCHAR(2000)` | `NOT NULL` | Customer reported symptoms/modifications |
| `ServiceCategory` | `VARCHAR(100)` | `NOT NULL` | Category (Periodic, Brakes, Tuning, etc.) |
| `PreferredServiceDate` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Customer preferred appointment date |
| `Status` | `INTEGER` | `NOT NULL, INDEX` | `ServiceRequestStatus` enum |
| `AssignedAdvisorId` | `UUID` | `FK -> AdvisorProfiles(Id) (NULL), INDEX` | Assigned technical advisor |
| `RadiusKm` | `DOUBLE PRECISION` | `NOT NULL DEFAULT 10.0` | Dispatch matching radius (KM) |
| `IdempotencyKey` | `VARCHAR(128)` | `NULL, INDEX(CustomerId, IdempotencyKey)` | Duplicate submission prevention key |
| `SubmittedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Dispatch timestamp |
| `CancelledAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Cancellation timestamp |
| `CancellationReason` | `VARCHAR(1000)` | `NULL` | Customer cancellation rationale |

### 5.3. `GarageRequests`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Dispatch record ID |
| `ServiceRequestId` | `UUID` | `FK -> ServiceRequests(Id), INDEX` | Parent service request |
| `GarageId` | `UUID` | `FK -> Garages(Id), INDEX` | Target matched workshop |
| `DistanceKm` | `DOUBLE PRECISION` | `NOT NULL` | PostGIS spheroid distance (KM) |
| `Status` | `INTEGER` | `NOT NULL, INDEX` | `GarageRequestStatus` enum (Notified, Viewed, Accepted, Declined) |
| `SentAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Dispatch timestamp |
| `ViewedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Workshop first view timestamp |
| `RespondedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Quote or decline response timestamp |

> **Unique Constraint**: `(ServiceRequestId, GarageId)` is enforced as unique to prevent duplicate broadcasts.

### 5.4. `Notifications`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Notification ID |
| `UserId` | `UUID` | `FK -> Users(Id), INDEX` | Recipient user |
| `Title` | `VARCHAR(200)` | `NOT NULL` | Notification subject |
| `Message` | `VARCHAR(1000)` | `NOT NULL` | Body text |
| `Channel` | `INTEGER` | `NOT NULL` | Enum: InApp(1), Email(2), Sms(3), WhatsApp(4) |
| `ReferenceType` | `VARCHAR(100)` | `NULL` | Entity type link (`ServiceRequest`, `GarageRequest`) |
| `ReferenceId` | `UUID` | `NULL` | Entity ID link |
| `IsRead` | `BOOLEAN` | `NOT NULL DEFAULT false` | Read status |
| `ReadAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Read receipt timestamp |
| `CreatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Delivery timestamp |

---

## 6. Garage Quotations, Line Items & Versions (Milestone 5)

### 6.1. Sequence: `GarageQuoteNumberSeq`
Atomic PostgreSQL integer sequence used for human-readable quotation reference generation (`BQ-XXXXXX`).

```sql
CREATE SEQUENCE IF NOT EXISTS "GarageQuoteNumberSeq" START WITH 100001 INCREMENT BY 1;
```

> **IMPORTANT IDENTIFIER NOTICE:** Generated atomically via PostgreSQL sequence `GarageQuoteNumberSeq`. The `BQ-XXXXXX` identifier is a unique human-readable quote reference. **Sequence values are not guaranteed to be gapless** due to transaction rollbacks, failed transactions, caching, or database restarts under standard sequence semantics. Security against enumeration relies strictly on authentication, permission checks, and multi-tenant resource isolation.

### 6.2. `GarageQuotes`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique quote identifier |
| `QuoteNumber` | `VARCHAR(32)` | `NOT NULL, UNIQUE INDEX` | Unique reference (`BQ-XXXXXX`) via `GarageQuoteNumberSeq` |
| `ServiceRequestId` | `UUID` | `FK -> ServiceRequests(Id), INDEX` | Associated service request |
| `GarageRequestId` | `UUID` | `FK -> GarageRequests(Id), INDEX` | Originating dispatch request |
| `GarageId` | `UUID` | `FK -> Garages(Id), INDEX` | Submitting partner workshop |
| `Status` | `INTEGER` | `NOT NULL, INDEX` | `QuoteStatus` enum (Draft, Submitted, UnderReview, Accepted, Rejected, Withdrawn, Expired) |
| `Version` | `INTEGER` | `NOT NULL DEFAULT 1` | Current active revision number |
| `Subtotal` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Sum of all line item totals (Server calculated) |
| `DiscountAmount` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Applied quotation discount |
| `TaxAmount` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Applicable tax/GST amount (Server calculated) |
| `GrandTotal` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Final quote amount (Server calculated) |
| `EstimatedDurationHours` | `INTEGER` | `NOT NULL` | Estimated turnaround time |
| `ValidUntil` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Quote expiration deadline |
| `Notes` | `VARCHAR(2000)` | `NULL` | Workshop remarks for Advisor |
| `SubmittedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Initial or latest submission timestamp |
| `CreatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Audit creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Audit modification timestamp |

### 6.3. `GarageQuoteLineItems`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Line item identifier |
| `GarageQuoteId` | `UUID` | `FK -> GarageQuotes(Id), INDEX` | Parent quotation |
| `Type` | `INTEGER` | `NOT NULL` | `QuoteLineType` (Labour=1, Part=2, Service=3, Other=4) |
| `Description` | `VARCHAR(500)` | `NOT NULL` | Item description / part name |
| `Quantity` | `NUMERIC(18,2)` | `NOT NULL` | Units or hours |
| `UnitPrice` | `NUMERIC(18,2)` | `NOT NULL` | Price per unit |
| `DiscountAmount` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Itemized discount |
| `LineTotal` | `NUMERIC(18,2)` | `NOT NULL` | Server-calculated total: `(Quantity * UnitPrice) - DiscountAmount` |
| `PartNumber` | `VARCHAR(100)` | `NULL` | Manufacturer part reference |
| `SortOrder` | `INTEGER` | `NOT NULL DEFAULT 0` | Display ordering |

### 6.4. `GarageQuoteVersions`
Stores immutable historical snapshots of quotes created upon each submission.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Snapshot version identifier |
| `GarageQuoteId` | `UUID` | `FK -> GarageQuotes(Id), INDEX` | Parent quotation |
| `Version` | `INTEGER` | `NOT NULL` | Snapshot revision number (`1, 2, ...`) |
| `Subtotal` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot subtotal |
| `DiscountAmount` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot discount |
| `TaxAmount` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot tax |
| `GrandTotal` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot grand total |
| `EstimatedDurationHours` | `INTEGER` | `NOT NULL` | Snapshot duration |
| `Notes` | `VARCHAR(2000)` | `NULL` | Snapshot notes |
| `LineItemsSnapshotJson` | `TEXT` | `NOT NULL` | Complete JSON serialization of all line items |
| `SubmittedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Snapshot timestamp |

