# Architecture

CareFlow is a single web artifact backed by one Express service. The service exposes a narrow set of capabilities rather than allowing the patient-access agent to reach the database or healthcare connector directly.

The current prototype keeps synthetic state in a process-backed domain module. The module is organized around the production entities that matter to the demo: hospitals, doctors, calendars/slots, appointments, questionnaire responses, workflows, integration operations, and audit events.

The interface boundary is:

`UI → generated client → route validation → application capability → domain state → connector boundary → verification → synchronization → workflow/audit`

The mock EHR is deliberately behind the route/service boundary. The AI response contains administrative intent, clarification, and structured slot suggestions; it does not contain vendor-specific integration logic.