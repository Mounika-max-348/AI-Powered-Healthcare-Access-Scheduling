# AI Architecture

The demo assistant is a structured patient-access agent. It classifies administrative requests, asks for missing scheduling context, returns only live availability, and explains its safety boundary.

Supported behaviors:

- find an appointment
- clarify day, visit type, doctor, and hospital
- present generated availability
- prepare a booking action
- explain questionnaire and appointment status
- route clinical questions to a safe administrative redirect

The endpoint returns `intent`, `stage`, `messages`, `suggestedSlots`, and `safetyNote`. This output is validated against the OpenAPI-derived schema before it reaches the UI.