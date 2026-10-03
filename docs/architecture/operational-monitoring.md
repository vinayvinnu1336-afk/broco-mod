# Operational Monitoring & Telemetry Architecture

## 1. System Health Monitoring
The platform features an active infrastructure health endpoint at `GET /api/v1/admin/system-health`:

| Component | Telemetry Checked | Healthy Threshold |
| :--- | :--- | :--- |
| **PostgreSQL 16** | Relational connectivity, CanConnect, ping latency | `< 100 ms` |
| **PostGIS 3.4** | Extension availability, PostGIS version query | `Installed & Verified` |
| **Redis 7** | Cache socket connection, ping response latency | `< 50 ms` |
| **Background Workers** | Hosted execution state, active worker pool | `Healthy & Running` |
| **Backend Runtime** | Managed process working set memory, application uptime | `Dynamic Tracking` |

## 2. Notification Delivery & Controlled Retry
Transactional notifications track delivery status, failure reasons, and retry counters:
- **Statuses**: `Pending`, `Sent`, `Failed`
- **Delivery Attributes**:
  - `RetryCount`: Incremented on each controlled delivery attempt
  - `LastAttemptAtUtc`: Timestamp of latest send execution
  - `ErrorSummary`: Normalized exception message on network or SMTP timeout
- **Idempotency Guarantee**: Retrying an already successful notification is safely guarded, preventing duplicate user messages.

## 3. Security Audit Trail & Retention
- **Ledger Invariance**: All critical state changes (garage status, advisor toggle, quotation revisions, customer decisions) record structured audit entries.
- **Indexed Search**: Supported by composite index `IX_AuditLogs_EntityName_EntityId` and `IX_AuditLogs_TimestampUtc` for high-throughput operational review.
- **Retention**: Permanent audit history retained for operational security and forensic audit readiness.
