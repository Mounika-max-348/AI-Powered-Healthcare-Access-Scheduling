# AI Usage

The prototype uses deterministic orchestration so an evaluator can repeat the same journey without an external model key. The provider seam is the `sendDemoAiMessage` capability: a production AI provider can replace the intent parser while retaining the same structured response contract and capability authorization.

No raw clinical content is written into the demo audit trail. Audit events record capability names, resources, actors, correlation IDs, and outcomes.