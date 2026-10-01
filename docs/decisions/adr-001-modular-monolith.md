# ADR-001: Adoption of Modular Monolith Architecture

## Status
Accepted

## Context
BroCo Mod is establishing a multi-sided marketplace connecting vehicle owners (Customers), repair workshops (Garages), and BroCo Mod service intermediaries (Advisors) under executive governance (Super Admin).

A foundational architecture decision was required:
- Option A: Distributed Microservices (separate services for Customer, Garage, Quotes, Notifications, Portals).
- Option B: Modular Monolith (co-located Domain, Application, and Infrastructure bounded contexts in a single deployable unit with strict internal boundaries).

## Decision
We chose **Option B: Modular Monolith** with a stateless API core and Clean Architecture.

### Rationale:
1. **Premature Distributed Complexity:** Microservices introduce distributed transactions, dual-writes, network serialization overhead, eventual consistency failures, and complex distributed tracing before product-market fit.
2. **Transactional Guarantees:** Assigning a garage, locking in a quote, and creating the customer quotation require atomic consistency within PostgreSQL.
3. **Data Isolation Without Infrastructure Sprawl:** Pricing security and data isolation are strictly enforced via Domain entities, DTO projections, and authorization policies rather than physical database partitions.
4. **Horizontal Scalability:** The backend API is completely stateless. It can scale horizontally across multiple instances behind a load balancer while sharing PostgreSQL + PostGIS and Redis.
5. **Future Decoupling Path:** Modules are organized cleanly into distinct aggregates and bounded contexts. If high-throughput modules (e.g. notifications or telematics) require independent scaling in the future, they can be extracted without re-architecting the core domain.
