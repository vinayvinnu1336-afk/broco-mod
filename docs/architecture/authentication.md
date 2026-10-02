# Authentication Architecture

## 1. Overview
The BroCo Mod platform implements an enterprise-grade, stateless authentication architecture designed for high security, horizontal scalability, and defense-in-depth protection across all user portals: **Customer**, **Garage**, **Advisor**, and **Super Admin**.

---

## 2. Authentication Mechanics

### 2.1 Password Security
- **Algorithm**: PBKDF2 (HMAC-SHA512)
- **Iterations**: 100,000 iterations
- **Salt**: 32-byte (256-bit) cryptographically secure pseudorandom salt (`RandomNumberGenerator.GetBytes(32)`)
- **Hash Size**: 64-byte (512-bit) derived key
- **Comparison**: Constant-time fixed-buffer comparison (`CryptographicOperations.FixedTimeEquals`) to prevent timing side-channel attacks.

### 2.2 Token Lifecycle & Cryptographic Signing
- **Access Tokens**:
  - Signed via **HMAC-SHA256** using server-configured signing secret (`Jwt:Secret`).
  - Standard expiration: **60 minutes**.
  - Claims embedded in JWT:
    - `sub` / `NameIdentifier`: User GUID.
    - `email`: User email address.
    - `role`: Array of user roles (`CUSTOMER`, `GARAGE_OWNER`, `ADVISOR`, `SUPER_ADMIN`).
    - `permission`: Array of granted fine-grained permission codes.
    - `customer_id`: Dedicated profile identifier for customers.
    - `garage_id`: Registered facility identifier for garage operators.
    - `garage_role`: Role within workshop (`GARAGE_OWNER`, `GARAGE_MANAGER`, `GARAGE_STAFF`).
    - `jti`: Unique token nonce GUID.
- **Refresh Tokens & Rotation**:
  - Generated using 64 cryptographically secure random bytes (Base64 encoded).
  - Stored in database as a **SHA256 hash** (`TokenHash`). Plaintext refresh tokens are never persisted.
  - Validity: **7 days**.
  - **Single-Use Rotation**: Each call to `/api/v1/auth/refresh-token` revokes the incoming token with reason `"Rotated during token refresh"` and generates a new token linked to the family via `ReplacedByTokenHash`.
  - **Reuse Detection**: If a previously revoked token is presented, the system detects a token hijacking attempt, logs an audit warning (`AuditActions.RefreshTokenRevoked`), and immediately revokes all remaining active tokens for that user.

### 2.3 Brute-Force & Lockout Defense
- Failed login attempts are recorded atomically (`FailedLoginAttempts`).
- After **5 consecutive failed attempts**, the account enters a **15-minute lockout** (`LockoutEndUtc`).
- Successful login clears failed attempt counters.
- Dedicated IP-based rate limiting on `/api/v1/auth/*` via ASP.NET Core RateLimiter (30 permits/minute with sliding buffer).

### 2.4 OTP & Second-Factor Abstraction
- Defined via `IOtpProvider` with methods `GenerateOtpAsync` and `VerifyOtpAsync`.
- Decoupled from third-party vendor APIs (SMS / WhatsApp) to avoid premature lock-in or recurring cloud costs during foundational milestones.

---

## 3. Demo Accounts & Credentials

| Role | Email | Password | Access Boundary |
|---|---|---|---|
| **Super Admin** | `admin@brocomod.com` | `Password123!` | Unrestricted governance & audit |
| **Advisor** | `advisor@brocomod.com` | `Password123!` | Quotation curation, margin calculations, assignments |
| **Garage Owner** | `garage.owner@centralmetro.com` | `Password123!` | Workshop internal costs, dispatched 10 KM requests |
| **Customer** | `customer@brocomod.com` | `Password123!` | Sanitized quotations, vehicle inventory, request tracker |
