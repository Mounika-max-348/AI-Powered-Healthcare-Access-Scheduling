# Testing

The main verification surface is the deterministic evaluator journey in `docs/DEMO_GUIDE.md`. The API contract is generated from OpenAPI and request bodies/query parameters are parsed with the generated Zod schemas.

Recommended production test layers:

- scheduling slot generation and blocked-period tests
- concurrent booking conflict tests
- appointment state-transition tests
- AI safety and clarification tests
- connector timeout, idempotency, verification, and reconciliation tests
- tenant-isolation and role tests
- end-to-end patient → doctor → admin journey

The prototype keeps these concerns in separate route/domain modules so those tests can be added without rewriting the UI.