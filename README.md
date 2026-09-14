# CareFlow Access Platform

CareFlow is an evaluator-ready prototype for autonomous multi-hospital patient intake, scheduling, verified booking, pre-visit workflows, and operational visibility.

It is built around one traceable journey:

`Patient request → clarification → hospital/doctor discovery → live availability → booking → external verification → synchronized state → questionnaire → workflow → doctor view → admin analytics/audit`

All patient and hospital records in the demo are synthetic.

## What is implemented

- Two approved demo hospitals with isolated doctors, specialties, departments, and calendars
- Seven active doctors with real generated availability across working hours
- Blocked lunch periods and booked-slot exclusion
- Patient-access agent with clarification, context-aware discovery, safety redirects, and controlled structured responses
- Verified booking flow with internal state, external mock EHR state, correlation IDs, operation IDs, and appointment timeline
- Intentional timeout/recovery scenario showing unknown outcome classification, read-before-retry reconciliation, and duplicate prevention
- Pre-visit questionnaire with structured answers and doctor-review workflow
- Role-aware patient, doctor, hospital-admin, and platform-admin views
- Workflow execution history, operational analytics, integration status, and audit trail
- OpenAPI contract, generated React Query hooks, route-level Zod validation, and documented mock connector boundary

## Architecture

```text
React patient/admin/doctor views
        ↓
Generated API hooks
        ↓
Express routes + Zod validation
        ↓
Role / tenant checks + application capabilities
        ↓
Scheduling state + appointment state machine
        ↓
HealthcareSystemConnector boundary
        ↓
Mock EHR create / retrieve / verify
        ↓
Synchronization + workflows + notifications + audit
```

The AI layer is intentionally administrative. It can help find and manage care access, but it does not diagnose, prescribe, recommend treatment, or claim confirmation before verification.

## Local setup

```bash
pnpm install
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

The managed API and web workflows provide their own `PORT` and routing prefix.

## Demo flow

1. Open the CareFlow app and choose the Patient role.
2. Start the assistant with: “I need to see a doctor for my shoulder pain sometime this week.”
3. Answer the clarification prompt about preferred day and visit type.
4. Select one of the returned slots. These come from the scheduling service, not hardcoded assistant copy.
5. Book the slot and watch the timeline move through request, schedule validation, mock EHR creation, verification, synchronization, and confirmation.
6. Open the questionnaire and submit the structured responses.
7. Switch to Doctor to see the appointment and questionnaire state.
8. Switch to Hospital Admin or Platform Admin to inspect metrics, workflows, integration status, and audit events.
9. Run “Failure simulation” to show timeout → unknown outcome → external lookup → duplicate prevention → recovery.

## Safety tests represented in the demo

- Clinical questions are redirected away from diagnosis and medication advice.
- Ambiguous booking requests result in clarification instead of a guessed hospital or slot.
- An unavailable slot is rejected by the API even if a caller bypasses the UI.
- Tenant-scoped list routes filter hospital resources server-side.
- External timeout never triggers a blind duplicate create.

## Environment variables

See `.env.example`. The current prototype does not require a user-supplied AI, voice, or EHR key. The connector and voice surfaces are provider-agnostic so those services can be attached later through managed secrets.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/AI.md`
- `docs/AI_USAGE.md`
- `docs/INTEGRATION.md`
- `docs/SCHEDULING.md`
- `docs/FAILURE_RECOVERY.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEMO_GUIDE.md`
- `docs/KNOWN_LIMITATIONS.md`