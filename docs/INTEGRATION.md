# Healthcare Integration

The integration is intentionally mock but behaves like a connector: it creates an external appointment ID, can return an unknown outcome, supports external lookup, and exposes verification/synchronization statuses.

Internal-to-external mappings shown in the demo include patient/doctor/facility context and the internal appointment correlation ID. A future connector can implement the same operations against an EHR or scheduling vendor without changing the assistant.