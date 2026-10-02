# Service Execution Architecture & Multi-Portal Segregation

## 1. Overview
The BroCo Mod Service Execution subsystem coordinates automotive work across four distinct portal personas following customer quotation acceptance. It enforces strict role boundaries and data isolation.

```
Customer Portal               Garage Portal                 Advisor Console               Super Admin
[Track Status]               [Workshop Operations]          [Technical Oversight]        [System Audit]
  • High-level tracker        • Schedule intake              • Review all jobs            • Global visibility
  • Customer notes            • Record odometer              • Review additional work     • Activity audit
  • Inspection summary        • Workshop findings            • In-app notifications       • SLA compliance
  • Milestone dates           • Log progress & work          • Advisory guidance
```

---

## 2. Multi-Portal Access & Data Boundaries

### A. Garage Portal (`GARAGE_OWNER`, `GARAGE_MANAGER`, `GARAGE_STAFF`)
- **Isolation Boundary**: A workshop can **only** view and manage `ServiceJob` records assigned to their own `GarageId`. Access attempts across garages result in immediate `Forbidden` (403).
- **Capabilities**:
  - Set intake schedule (`/api/v1/garage/jobs/{id}/schedule`)
  - Record vehicle arrival & odometer mileage (`/api/v1/garage/jobs/{id}/receive-vehicle`)
  - Conduct physical inspections with internal workshop notes (`/api/v1/garage/jobs/{id}/start-inspection`, `complete-inspection`)
  - Log execution updates with toggleable customer visibility (`/api/v1/garage/jobs/{id}/progress`)
  - Request additional work proposals (`/api/v1/garage/jobs/{id}/additional-work`)
  - Mark completion, vehicle readiness, and handover (`/api/v1/garage/jobs/{id}/complete-work`, `vehicle-ready`, `handover`, `close`)

### B. Customer Portal (`CUSTOMER`)
- **Isolation Boundary**: A customer can **only** view jobs linked to their own `ServiceRequest` records.
- **Data Protection Policy**:
  - Internal technician findings, workshop recommendations, and garage internal notes are **never** exposed.
  - Workshop profit margins and commercial markups are never exposed.
  - Customers see high-level sanitized milestones, estimated ready dates, the sanitized customer inspection summary, and customer-facing progress notes.

### C. Technical Advisor Console (`ADVISOR`)
- **Capabilities**:
  - Global technical oversight across all active platform jobs.
  - Full visibility into confidential workshop findings, technician notes, and diagnostic inspections.
  - Evaluation and adjudication (Approval/Rejection) of Additional Work Proposals submitted by workshops.
  - Independent advisory communication with customers.

### D. Super Admin (`SUPER_ADMIN`)
- **Capabilities**:
  - Platform-wide execution registry, compliance monitoring, and immutable security audit trail inspection.

---

## 3. Automated Notifications & Auditing
Every state transition triggers:
1. In-app notifications dispatched to Customer, Assigned Garage Staff, and Technical Advisors.
2. Structured audit log entries written to the security audit repository recording Actor, Action, Old State, New State, and Entity Id.
