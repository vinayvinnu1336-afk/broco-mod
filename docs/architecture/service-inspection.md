# Physical Vehicle Intake & Technical Inspection

## 1. Overview
Upon physical intake of a customer's vehicle at the assigned workshop, technicians perform an intake assessment and physical inspection. The system captures findings while enforcing a strict separation between confidential internal workshop diagnostics and customer-facing summaries.

---

## 2. Intake Mileage Recording
- At intake (`POST /api/v1/garage/jobs/{id}/receive-vehicle`), the workshop records the current odometer reading (`CurrentMileageKm`).
- The reading is validated to be non-negative and is permanently stamped onto the `ServiceJob` record.
- Intake marks the strict lock on customer cancellations.

---

## 3. Physical Inspection Separation Model

```
                    ┌─────────────────────────────────┐
                    │    PHYSICAL INTAKE INSPECTION   │
                    └────────────────┬────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
  ┌─────────────────────────────┐        ┌─────────────────────────────┐
  │ CONFIDENTIAL WORKSHOP DATA  │        │   CUSTOMER-FACING SUMMARY   │
  │ • Detailed technical notes  │        │ • Non-technical overview    │
  │ • Component wear metrics    │        │ • High-level health status  │
  │ • Internal recommendations  │        │ • Verified inspection date  │
  │ • Mechanics-only visibility │        │ • Customer app visibility   │
  └──────────────┬──────────────┘        └──────────────┬──────────────┘
                 │                                      │
                 ▼                                      ▼
       [Garage & Advisor Only]                 [Customer Portal]
```

### Data Fields

1. **`Findings` (Confidential Workshop Diagnostics)**:
   - Technical diagnostic details, OBD-II error codes, specific part fatigue, measurement tolerances, and mechanical observations.
   - Visible to: Workshop staff, Technical Advisors, Super Admins.
   - **Hidden from Customer DTOs**.

2. **`Recommendations` (Internal Workshop Guidance)**:
   - Recommended actions for technicians and service advisors regarding part procurement or upcoming maintenance.
   - Visible to: Workshop staff, Technical Advisors, Super Admins.
   - **Hidden from Customer DTOs**.

3. **`CustomerVisibleSummary` (Customer Overview)**:
   - Professional, accessible summary of the vehicle's physical condition upon arrival.
   - Visible to: Customers, Workshop staff, Technical Advisors, Super Admins.

4. **`OverallSeverity` (Assessment Grade)**:
   - `Info`: Normal vehicle intake; routine maintenance.
   - `Low`: Minor cosmetic or non-critical wear detected.
   - `Medium`: Noticeable wear; recommend attention in upcoming maintenance cycle.
   - `High`: Substantial safety or mechanical concern discovered.
   - `Critical`: Severe hazard discovered requiring immediate advisor and customer consultation.
