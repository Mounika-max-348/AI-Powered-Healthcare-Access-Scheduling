# Backend risk audit

This audit covers the high-risk engineering requirements for the CareFlow prototype. The API behavior is tested through the domain service and the running Express app; UI state is not used as evidence.

| Requirement | Current implementation | Verification |
| --- | --- | --- |
| Multi-tenant isolation | Hospital-admin and doctor reads are scoped to the actor hospital. Platform admins may aggregate. Patients may browse the hospital directory and their own appointments across hospitals. | Cross-tenant HTTP read test |
| RBAC | Server-side actor context, role allowlists, hospital scope checks, signed bearer-session support, and production rejection of unsigned header context. | Signed-session and cross-tenant denial tests |
| Real scheduling availability | Availability is derived from future working-hour slots, excludes lunch, inactive doctors, booked slots, and appointment conflicts. Booking revalidates immediately before external work. | Availability and race tests |
| Double-booking prevention | Per-slot async lock, active appointment conflict check, and slot state transition prevent concurrent in-process double booking. | Concurrent `Promise.allSettled` booking test |
| Appointment state machine | Explicit transitions cover request, external pending, external-created, unknown, reconciling, verified, confirmed, completed, cancelled, and failed states. | Invalid transition test |
| Capability-based AI actions | AI routes only to an explicit capability allowlist: clarification, availability discovery, or booking preparation. Capability executions are audited and never directly create appointments. | Cross-tenant capability test |
| Mock EHR connector abstraction | `HealthcareConnector` defines create, lookup-by-idempotency-key, and read-by-external-ID operations. The mock connector persists a remote record before simulating a lost response. | Connector/domain recovery tests |
| External verification | Confirmation requires a second external read and matching hospital, doctor, patient, date, and time. | Verified booking test |
| Idempotency | `Idempotency-Key` is fingerprinted, replayed with the original result, rejected when payload data changes, and serialized under a key lock. Reconciliation updates the replay result. | Replay and mismatch tests |
| Unknown-outcome recovery | Connector timeout produces `UNKNOWN_OUTCOME` and holds the slot. Recovery performs lookup before retry and never creates a second external record when the lookup finds one. | Domain and HTTP recovery tests |
| Reconciliation | The recovery path transitions through `RECONCILING`, synchronizes the internal appointment, books the slot, verifies the external record, and records duplicate-prevention/recovery events. | Failure simulation and audit assertions |
| Audit/correlation IDs | Request correlation IDs are propagated to responses, appointments, capabilities, connector verification, recovery, and audit events. | Correlation assertions and live API check |

## Remaining production boundaries

- The prototype data store is process-local. Slot locks, idempotency records, appointments, and audit events are not durable or shared across multiple API processes. Production deployment requires PostgreSQL transactions/row locks plus unique constraints for tenant, slot, and idempotency invariants.
- The signed actor session path uses the workspace `SESSION_SECRET`; the demo role headers remain available only in development so the evaluator role switch continues to work. A production release should replace the demo session issuer with managed authentication and server-issued user/tenant claims.
- The EHR connector is intentionally synthetic. Vendor authentication, retries, rate limits, webhook reconciliation, and PHI controls remain connector-specific production work.
- Audit events are currently retained in memory. Production requires durable append-only storage and a retention/access policy.