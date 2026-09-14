# Evaluator Demo Guide

### Patient journey

Choose Patient, start the assistant, and say: “I need to see a doctor for my shoulder pain sometime this week.” The assistant clarifies the missing scheduling context, then returns live generated slots. Select a slot and book it.

After booking, inspect the appointment timeline. Confirmation appears only after the mock external record is verified and internal state is synchronized.

### Follow-up

Open the assigned orthopedic intake questionnaire, submit the structured responses, and switch to Doctor. The doctor view shows the new appointment and questionnaire workflow.

### Operations

Hospital Admin shows tenant-scoped appointments, doctors, workflows, and operational metrics. Platform Admin shows the cross-hospital view. Audit displays capability execution, verification, workflow, and recovery events.

### Recovery

Run Failure Simulation. The timeline explicitly shows the timeout and unknown outcome, then a read-before-retry lookup, duplicate prevention, reconciliation, and final confirmed state.