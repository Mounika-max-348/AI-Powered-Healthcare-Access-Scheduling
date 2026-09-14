# Scheduling

Availability is generated for active doctors over six future days. The working day is 09:00–17:00 with a blocked 13:00–14:00 period and 30-minute appointment durations.

A slot is shown only when:

- the doctor is active
- the doctor belongs to the selected hospital
- the slot is inside configured hours
- the slot is not in the blocked period
- the slot is not already booked

The API repeats the availability check immediately before creating an appointment and marks the slot booked after the successful state transition.