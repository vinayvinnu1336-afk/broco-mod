# Provider-Independent Notification Architecture

## 1. Overview
The platform decouples business workflows from notification delivery mechanisms via `INotificationService`. This enables in-app persistence alongside multi-channel broadcast (Email, SMS, WhatsApp) without vendor lock-in or mandatory paid provider credentials during development.

---

## 2. Notification Channels & Extensibility
Defined in `BroCoMod.Domain.Enums.NotificationChannel`:
- `InApp` (Database persisted for portal notification bells/feeds)
- `Email` (Pluggable provider, defaulted to Console / Null Logger in dev)
- `Sms` (Pluggable provider interface `IOtpProvider` / `ISmsSender`)
- `WhatsApp` (Pluggable WhatsApp Business API integration)

---

## 3. Database Persistence (`Notification` Entity)
Every platform notification creates a persistent record in `Notifications`:
- `UserId`: Target recipient user account.
- `Title`: Short descriptive header.
- `Message`: Human-readable body.
- `Channel`: `NotificationChannel` enum.
- `ReferenceType` & `ReferenceId`: Linked entity ID (e.g. `ServiceRequest`, `GarageRequest`).
- `IsRead` & `ReadAtUtc`: Read tracking.

---

## 4. Dispatch Triggers
- **New Service Request**: Notifies platform Technical Advisors of newly submitted requests awaiting quote reviews.
- **Garage Dispatch**: Concurrently notifies owner/managers of all verified workshops matched within the 10 KM radius.
