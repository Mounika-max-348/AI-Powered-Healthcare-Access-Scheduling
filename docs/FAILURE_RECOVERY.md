# Failure Recovery

Use the visible Failure Simulation action to run:

1. appointment request accepted
2. mock EHR request times out
3. operation classified as `UNKNOWN_OUTCOME`
4. external state queried before any retry
5. existing record found using the idempotency key
6. duplicate create prevented
7. internal appointment synchronized
8. external verification completed
9. final state confirmed

The UI receives the correlation ID, operation ID, retry count, external status, verification status, synchronization status, and each timeline event. The demo intentionally does not hide the timeout.