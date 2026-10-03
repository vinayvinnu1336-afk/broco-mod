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

---

## 7. Advisor Review, Garage Assignment & Customer Quotation (Milestone 6)

### 7.1. Sequence: `CustomerQuotationNumberSeq`
Atomic PostgreSQL integer sequence used for human-readable customer quotation reference generation (`CQ-XXXXXX`).

```sql
CREATE SEQUENCE IF NOT EXISTS "CustomerQuotationNumberSeq" START WITH 100001 INCREMENT BY 1;
```

> **IMPORTANT IDENTIFIER NOTICE:** Generated atomically via PostgreSQL sequence `CustomerQuotationNumberSeq`. The `CQ-XXXXXX` identifier is a unique human-readable quotation reference. **Sequence values are not guaranteed to be gapless** due to transaction rollbacks, failed transactions, caching, or database restarts under standard sequence semantics. Security against enumeration relies strictly on authentication, permission checks, and multi-tenant resource isolation.

### 7.2. `AdvisorRequestNotes`
Confidential technical, diagnostic, and pricing records authored by Technical Advisors.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Note identifier |
| `ServiceRequestId` | `UUID` | `FK -> ServiceRequests(Id), INDEX` | Parent service request |
| `AdvisorId` | `UUID` | `NOT NULL, INDEX` | User ID of authoring advisor |
| `AdvisorName` | `VARCHAR(200)` | `NOT NULL` | Author display name / email |
| `Note` | `TEXT` | `NOT NULL` | Confidential operational note content |
| `IsInternal` | `BOOLEAN` | `NOT NULL DEFAULT true` | Always true (Never exposed to external parties) |
| `CreatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Last edit timestamp |

### 7.3. `GarageAssignments`
Binds a ServiceRequest to a selected partner workshop and their winning quote.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Assignment identifier |
| `ServiceRequestId` | `UUID` | `FK -> ServiceRequests(Id)` | Associated service request |
| `GarageId` | `UUID` | `FK -> Garages(Id), INDEX` | Selected workshop |
| `SelectedQuoteId` | `UUID` | `FK -> GarageQuotes(Id), INDEX` | Selected workshop quotation |
| `AssignedByAdvisorId` | `UUID` | `NOT NULL, INDEX` | Assigning advisor ID |
| `AssignedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Assignment timestamp |
| `Status` | `INTEGER` | `NOT NULL` | Enum: Assigned(1), Cancelled(2), Reassigned(3), Confirmed(4) |
| `AssignmentReason` | `VARCHAR(1000)` | `NULL` | Technical/operational selection rationale |
| `CancelledAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Cancellation timestamp |
| `CancellationReason` | `VARCHAR(1000)` | `NULL` | Cancellation rationale |
| `ConcurrencyToken` | `UUID` | `NOT NULL` | Optimistic concurrency token |

> **Single Active or Confirmed Assignment Unique Partial Index**:
> ```sql
> CREATE UNIQUE INDEX "IX_GarageAssignments_ServiceRequestId"
> ON "GarageAssignments" ("ServiceRequestId")
> WHERE "Status" IN (1, 4); -- 1 = Assigned, 4 = Confirmed
> ```

### 7.4. `CustomerQuotations`
The curated commercial quotation presented to the customer.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique customer quotation ID |
| `ServiceRequestId` | `UUID` | `FK -> ServiceRequests(Id), INDEX` | Parent service request |
| `GarageAssignmentId` | `UUID` | `FK -> GarageAssignments(Id) (NULL), INDEX` | Winning assignment lineage |
| `AssignedGarageId` | `UUID` | `FK -> Garages(Id), INDEX` | Fulfilling partner workshop |
| `AdvisorId` | `UUID` | `NOT NULL, INDEX` | Curating advisor ID |
| `QuotationNumber` | `VARCHAR(32)` | `NOT NULL, UNIQUE INDEX` | Unique reference (`CQ-XXXXXX`) via `CustomerQuotationNumberSeq` |
| `Currency` | `VARCHAR(10)` | `NOT NULL DEFAULT 'INR'` | Currency code |
| `CustomerSubtotal` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Retail line items subtotal |
| `CustomerDiscount` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Promotional platform discount |
| `CustomerTax` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Applicable statutory GST |
| `CustomerTotal` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Final payable total |
| `ValidUntilUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Customer acceptance expiry date |
| `Status` | `INTEGER` | `NOT NULL, INDEX` | Enum: Draft(1), ReadyToSend(2), Sent(3), Accepted(4), Rejected(5), Expired(6), Cancelled(7) |
| `VersionNumber` | `INTEGER` | `NOT NULL DEFAULT 1` | Revision number |
| `ScopeSummary` | `VARCHAR(1000)` | `NOT NULL` | Customer-facing work package summary |
| `AdvisorRemarks` | `VARCHAR(2000)` | `NULL` | Warranty and parts compliance remarks |
| `SentAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Customer dispatch timestamp |
| `AcceptedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Customer acceptance timestamp |
| `RejectedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Customer rejection timestamp |
| `AcceptedVersionId`| `UUID` | `FK -> CustomerQuotationVersions(Id) (NULL)` | Immutable accepted version binding |
| `ConcurrencyToken` | `UUID` | `NOT NULL` | Optimistic locking token |
| `CreatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Audit creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Audit modification timestamp |

### 7.5. `CustomerQuotationLineItems`
Individual commercial items approved for customer invoicing.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Line item identifier |
| `CustomerQuotationId` | `UUID` | `FK -> CustomerQuotations(Id), INDEX` | Parent customer quotation |
| `LineType` | `INTEGER` | `NOT NULL` | Enum: Labour(1), Part(2), Service(3), Other(4) |
| `Description` | `VARCHAR(500)` | `NOT NULL` | Scope or item description |
| `Quantity` | `NUMERIC(18,2)` | `NOT NULL` | Units or billable hours |
| `UnitPrice` | `NUMERIC(18,2)` | `NOT NULL` | Customer unit retail rate |
| `TaxRate` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 18.00` | GST tax rate percentage |
| `DiscountAmount` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0.00` | Line item discount |
| `LineTotal` | `NUMERIC(18,2)` | `NOT NULL` | Line total: `(Quantity * UnitPrice) - DiscountAmount` |
| `SortOrder` | `INTEGER` | `NOT NULL DEFAULT 0` | Display sorting |

### 7.6. `CustomerQuotationVersions`
Immutable historical snapshot preserving financial and line item states upon `ReadyToSend` and revision events.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Version snapshot identifier |
| `CustomerQuotationId` | `UUID` | `FK -> CustomerQuotations(Id), INDEX` | Parent customer quotation |
| `VersionNumber` | `INTEGER` | `NOT NULL` | Snapshot revision (`1, 2, ...`) |
| `CustomerSubtotal` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot subtotal |
| `CustomerDiscount` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot discount |
| `CustomerTax` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot tax |
| `CustomerTotal` | `NUMERIC(18,2)` | `NOT NULL` | Snapshot total |
| `ValidUntilUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Snapshot expiry |
| `ScopeSummary` | `VARCHAR(1000)` | `NULL` | Snapshot scope |
| `AdvisorRemarks` | `VARCHAR(2000)` | `NULL` | Snapshot remarks |
| `LineItemsJson` | `TEXT` | `NOT NULL` | Serialized JSON of all approved line items |
| `CreatedByUserId` | `UUID` | `NOT NULL` | Snapshot user attribution |
| `CreatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Snapshot timestamp |

### 7.7. `CustomerQuotationDecisions`
Immutable audit and legal record of customer acceptance or decline decision.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Unique decision identifier |
| `CustomerQuotationId` | `UUID` | `FK -> CustomerQuotations(Id), UNIQUE INDEX` | At most one decision per quotation |
| `CustomerQuotationVersionId` | `UUID` | `FK -> CustomerQuotationVersions(Id), INDEX` | Binding snapshot version |
| `VersionNumber` | `INTEGER` | `NOT NULL` | Version number reviewed by customer |
| `CustomerId` | `UUID` | `FK -> Users(Id), INDEX` | Customer user account |
| `Decision` | `INTEGER` | `NOT NULL, INDEX` | Enum: Accepted(1), Rejected(2) |
| `DecisionCategory` | `VARCHAR(100)` | `NULL` | Feedback category (e.g. `PRICE_TOO_HIGH`) |
| `DecisionReason` | `VARCHAR(1000)` | `NULL` | Mandatory explanation on rejection, optional on accept |
| `IdempotencyKey` | `VARCHAR(128)` | `NULL, INDEX` | Idempotent replay key |
| `ClientIpAddress` | `VARCHAR(45)` | `NULL` | IPv4/IPv6 client address for audit |
| `UserAgent` | `VARCHAR(500)` | `NULL` | Client user agent string |
| `DecidedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, INDEX` | Decision timestamp |
| `CreatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Entity creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Modification timestamp |

---

## 8. Service Execution & Job Lifecycle (Milestone 8)

### 8.1. `ServiceJobs`
Stores the operational execution state of automotive repairs/modifications following quote acceptance. Identifiers generated via PostgreSQL sequence `ServiceJobNumberSeq` (`JOB-XXXXXX`).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Job identifier |
| `JobNumber` | `VARCHAR(32)` | `NOT NULL, UNIQUE INDEX` | Human-readable `JOB-XXXXXX` |
| `ServiceRequestId` | `UUID` | `FK -> ServiceRequests(Id), INDEX` | Parent service request |
| `CustomerQuotationId` | `UUID` | `FK -> CustomerQuotations(Id), INDEX` | Accepted customer proposal |
| `GarageAssignmentId` | `UUID` | `FK -> GarageAssignments(Id), INDEX` | Assigned workshop |
| `GarageId` | `UUID` | `FK -> Garages(Id), INDEX` | Workshop tenant identifier |
| `Status` | `INTEGER` | `NOT NULL, INDEX` | `ServiceJobStatus` enum (BookingConfirmed=1..Cancelled=99) |
| `ScheduledStartAtUtc` | `TIMESTAMPTZ` | `NULL` | Workshop planned intake start |
| `EstimatedCompletionAtUtc` | `TIMESTAMPTZ` | `NULL` | Estimated ready date |
| `ActualVehicleReceivedAtUtc` | `TIMESTAMPTZ` | `NULL` | Actual vehicle arrival timestamp |
| `ActualWorkStartedAtUtc` | `TIMESTAMPTZ` | `NULL` | Active repair start timestamp |
| `ActualWorkCompletedAtUtc` | `TIMESTAMPTZ` | `NULL` | Active repair finished timestamp |
| `VehicleReadyAtUtc` | `TIMESTAMPTZ` | `NULL` | Customer pickup ready timestamp |
| `HandedOverAtUtc` | `TIMESTAMPTZ` | `NULL` | Customer handover timestamp |
| `ClosedAtUtc` | `TIMESTAMPTZ` | `NULL` | Job completion/closeout timestamp |
| `CancelledAtUtc` | `TIMESTAMPTZ` | `NULL` | Pre-intake cancellation timestamp |
| `CancellationReason` | `VARCHAR(1000)` | `NULL` | Reason recorded for cancellation |
| `CurrentMileageKm` | `INTEGER` | `NULL` | Odometer reading recorded at physical intake |
| `GarageInternalNotes` | `VARCHAR(4000)` | `NULL` | Confidential workshop notes (hidden from customer) |
| `CustomerFacingNotes` | `VARCHAR(2000)` | `NULL` | Customer-visible status updates |
| `CustomerComplaintSnapshot` | `VARCHAR(4000)` | `NOT NULL` | Frozen copy of complaint at job creation |
| `RowVersion` | `bytea` / `xmin` | `NOT NULL` | Optimistic concurrency token |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Entity creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMPTZ` | `NULL` | Modification timestamp |

### 8.2. `ServiceInspections`
Physical condition and diagnostic intake inspections performed by workshops.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Inspection identifier |
| `ServiceJobId` | `UUID` | `FK -> ServiceJobs(Id), INDEX` | Associated service job |
| `InspectorUserId` | `UUID` | `FK -> Users(Id)` | Technician performing inspection |
| `InspectionStartedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Inspection started timestamp |
| `InspectionCompletedAtUtc` | `TIMESTAMPTZ` | `NULL` | Inspection finished timestamp |
| `Findings` | `VARCHAR(4000)` | `NULL` | Confidential workshop findings (hidden from customer) |
| `Recommendations` | `VARCHAR(2000)` | `NULL` | Internal technical recommendations |
| `CustomerVisibleSummary` | `VARCHAR(2000)` | `NULL` | Sanitized non-technical summary for customer |
| `OverallSeverity` | `INTEGER` | `NOT NULL` | Enum: Info(0), Low(1), Medium(2), High(3), Critical(4) |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Entity creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMPTZ` | `NULL` | Modification timestamp |

### 8.3. `ServiceJobActivities`
Operational event and milestone activity log for the service job.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Activity identifier |
| `ServiceJobId` | `UUID` | `FK -> ServiceJobs(Id), INDEX` | Associated service job |
| `ActivityType` | `INTEGER` | `NOT NULL` | `JobActivityType` enum (StatusChange, Inspection, etc.) |
| `Message` | `VARCHAR(1000)` | `NOT NULL` | Description of activity |
| `IsCustomerVisible` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Customer visibility flag |
| `ActorUserId` | `UUID` | `FK -> Users(Id)` | User who triggered the activity |
| `ActorName` | `VARCHAR(200)` | `NOT NULL` | Display name of the actor |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL, INDEX` | Activity timestamp |

### 8.4. `AdditionalWorkRequests`
Proposals for additional repair or maintenance items discovered during physical service.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `UUID` | `PRIMARY KEY` | Proposal identifier |
| `ServiceJobId` | `UUID` | `FK -> ServiceJobs(Id), INDEX` | Associated service job |
| `Description` | `VARCHAR(500)` | `NOT NULL` | Proposed work description |
| `EstimatedAdditionalAmount` | `NUMERIC(18,2)` | `NOT NULL` | Proposed estimate |
| `Reason` | `VARCHAR(2000)` | `NOT NULL` | Technical justification discovered during service |
| `Status` | `INTEGER` | `NOT NULL, INDEX` | Enum: PendingAdvisorReview(1), Approved(2), Rejected(3), Cancelled(4) |
| `ReviewedByAdvisorId` | `UUID` | `FK -> Users(Id), NULL` | Advisor reviewing the proposal |
| `AdvisorRemarks` | `VARCHAR(2000)` | `NULL` | Remarks explaining approval or rejection |
| `ReviewedAtUtc` | `TIMESTAMPTZ` | `NULL` | Decision timestamp |
| `CreatedAtUtc` | `TIMESTAMPTZ` | `NOT NULL` | Creation timestamp |
| `UpdatedAtUtc` | `TIMESTAMPTZ` | `NULL` | Modification timestamp |

---

## 9. Milestone 9 — Operations & Admin Control Center Schema Enhancements

### 9.1. Enhanced `Garages` Table Attributes
Operational verification state machine, configurable spatial service radius, and optimistic concurrency token.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Status` | `INTEGER` | `NOT NULL DEFAULT 1, INDEX` | Enum: `PendingVerification(0)`, `Verified(1)`, `Suspended(2)`, `Inactive(3)` |
| `ServiceRadiusKm` | `DOUBLE PRECISION` | `NOT NULL DEFAULT 10.0` | Spatial dispatch coverage bounds: [1.0 KM, 50.0 KM] |
| `StatusReason` | `VARCHAR(1000)` | `NULL` | Administrative reason for suspension or deactivation |
| `StatusChangedAtUtc` | `TIMESTAMPTZ` | `NULL` | Timestamp of latest status transition |
| `ConcurrencyToken` | `UUID` | `NOT NULL` | Optimistic locking token for administrative updates |

### 9.2. Enhanced `Notifications` Table Attributes
Operational delivery monitoring, retry tracking, and failure diagnostics.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Status` | `INTEGER` | `NOT NULL DEFAULT 1, INDEX` | Enum: `Pending(0)`, `Sent(1)`, `Failed(2)` |
| `RetryCount` | `INTEGER` | `NOT NULL DEFAULT 0` | Counter of delivery retry attempts |
| `LastAttemptAtUtc` | `TIMESTAMPTZ` | `NULL` | Timestamp of latest delivery attempt |
| `ErrorSummary` | `VARCHAR(2000)` | `NULL` | Exception or network failure reason |
| `ConcurrencyToken` | `UUID` | `NOT NULL` | Optimistic locking token for retry processing |

### 9.3. Operational Performance Indexes
- `IX_Garages_Status`: High-throughput filter on partner workshop verification state.
- `IX_Notifications_Status`: High-throughput query for failed notifications in attention queues.
- `IX_AuditLogs_EntityName_EntityId`: Composite index for real-time timeline reconstruction on entities.





