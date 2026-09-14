# CareFlow Access Platform

CareFlow is a multi-hospital healthcare access platform that turns a natural-language patient request into a verified, auditable appointment without crossing into diagnosis or treatment advice.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/careflow run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas

The application currently uses seeded synthetic data held by the API process so the evaluator can demonstrate the full journey without configuring an external EHR. It is intentionally not a clinical system.

## Stack

- pnpm workspace, TypeScript, React + Vite
- Express API with structured Zod validation
- OpenAPI-first API contracts and generated React Query hooks
- Deterministic scheduling engine with generated working-hour slots and blocked lunch periods
- Mock healthcare-system connector behavior with verification and reconciliation states

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `artifacts/api-server/src/lib/careflow-state.ts` — synthetic tenants, doctors, slots, appointments, workflows, and audit state
- `artifacts/api-server/src/routes/demo.ts` — role-aware demo capabilities and orchestration
- `artifacts/careflow/src/` — evaluator-facing web experience
- `docs/` — architecture, safety, scheduling, integration, and demo documentation

## Architecture decisions

- The AI endpoint only returns structured administrative intent and suggested slots; it never receives ORM or connector access.
- Slot availability is generated from doctor calendars and filtered again at booking time. A booked slot is removed from the available set.
- Appointment confirmation is only returned after the external record is verified and internal state is synchronized.
- Timeout recovery uses read-before-retry and an idempotency key so an unknown external outcome cannot create a duplicate.
- Hospital filters are enforced in route handlers, not only in the frontend.

## Product

The demo includes two approved hospitals, seven active doctors, working-hour availability, patient intake, an administrative AI assistant, verified booking, pre-visit questionnaire, doctor review, hospital operations analytics, workflow execution records, and an audit trail.

## Known prototype boundary

The demo state is process-backed rather than persisted to PostgreSQL, and the healthcare connector is deterministic mock behavior. The interfaces and state transitions are kept separate so a production database, authentication provider, and EHR connector can replace those pieces without changing the patient-access UI contract.