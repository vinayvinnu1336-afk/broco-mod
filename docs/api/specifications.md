# BroCo Mod API Specifications

## 1. Design Principles

- **Stateless REST:** All requests carry self-contained authentication (JWT bearer tokens).
- **Format:** JSON payloads with standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`, `500 Internal Error`).
- **Data Isolation:** Endpoints strictly emit role-safe DTOs to enforce pricing security.

---

## 2. Health & Monitoring Endpoints

### `GET /health`
Comprehensive health check returning status of PostgreSQL, PostGIS, and Redis.

```json
{
  "status": "Healthy",
  "totalDuration": "00:00:00.0124310",
  "postgisActive": true,
  "redisActive": true,
  "entries": {
    "postgres": { "status": "Healthy", "database": "broco_mod" },
    "postgis": { "status": "Healthy", "version": "POSTGIS=\"3.4.2\" ..." },
    "redis": { "status": "Healthy", "connected": true }
  }
}
```

### `GET /healthz`
Lightweight probe endpoint for container orchestrators (Kubernetes liveness/readiness).
- Returns `200 OK` (Healthy) or `503 Service Unavailable`.

---

## 3. Core System & Geospatial Endpoints

### `GET /api/system/info`
Returns platform metadata and active architecture parameters.

### `GET /api/system/garages/eligible`
Finds garages within a specified radius using PostGIS.

**Parameters:**
- `longitude` (query, double, required)
- `latitude` (query, double, required)
- `radiusKm` (query, double, default: 10.0)

**Response:**
```json
{
  "searchRadiusKm": 10.0,
  "coordinates": { "longitude": -122.4194, "latitude": 37.7749 },
  "count": 3,
  "garages": [
    {
      "id": "e83e9b11-a836-47b2-841f-1358d7b30c4e",
      "name": "Central Metro Auto Care",
      "distanceKm": 1.42,
      "address": "123 Innovation Way",
      "isActive": true
    }
  ]
}
```

---

## 4. Quote & Pricing Isolation Demonstration

### `GET /api/system/quote-isolation-demo`
Demonstrates runtime data segregation between customer and garage views.

**Customer-Facing Payload (Zero Leakage):**
```json
{
  "id": "a1f09bb2-4048-4cb1-97cf-8984da6c498d",
  "serviceRequestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "customerFacingPrice": 489.99,
  "scopeSummary": "Complete front brake pads and rotors replacement with warranty.",
  "advisorNotes": "Approved standard tier markup. Dispatched to customer.",
  "status": "Submitted"
}
```

**Garage Internal Payload (Advisor / Garage Only):**
```json
{
  "id": "76ec2a5b-d368-45fa-a9f8-b4b0eb140810",
  "garageId": "c4d3e2f1-0000-0000-0000-000000000000",
  "garageInternalPrice": 350.00,
  "internalCostBreakdown": "Parts: $220.00 (Wholesale), Labor: $130.00 (3 hrs @ $43.33/hr)",
  "garageNotes": "Includes OEM brake pads and rotors replacement."
}
```
