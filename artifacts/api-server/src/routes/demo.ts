import { Router, type IRouter } from "express";
import {
  CreateDemoAppointmentBody,
  GetDemoAvailabilityQueryParams,
  GetDemoAppointmentParams,
  GetDemoAppointmentsQueryParams,
  GetDemoAnalyticsQueryParams,
  GetDemoAuditQueryParams,
  GetDemoDoctorsQueryParams,
  GetDemoOverviewQueryParams,
  GetDemoQuestionnaireResponse,
  GetDemoWorkflowsQueryParams,
  RunFailureSimulationBody,
  SendDemoAiMessageBody,
  SubmitDemoQuestionnaireBody,
} from "@workspace/api-zod";
import {
  appointments,
  auditEvents,
  conversationMessages,
  doctors,
  doctorFor,
  hospitalFor,
  hospitals,
  questionnaire,
  slots,
  slotsFor,
  timelineFor,
  workflows,
  type Appointment,
  type TimelineEvent,
} from "../lib/careflow-state";

const router: IRouter = Router();

const isoNow = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const activity = (hospitalId: string) =>
  auditEvents
    .filter((event) => event.hospitalId === hospitalId)
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      label: event.action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
      detail: `${event.actor} · ${event.resource}`,
      time: new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.round((Date.now() - new Date(event.timestamp).getTime()) / 60000)), "minute"),
      tone: event.status === "SUCCESS" ? "success" : "warning",
    }));

const metricsFor = (role: string, hospitalId: string) => {
  if (role === "PATIENT") {
    return [
      { label: "Upcoming visits", value: String(appointments.filter((appointment) => appointment.patientName === "Maya Nair" && appointment.status === "CONFIRMED").length), change: "Next visit this week", tone: "teal" },
      { label: "Questionnaire", value: questionnaire.status === "SUBMITTED" ? "Complete" : "Due", change: "Orthopedic intake", tone: "amber" },
      { label: "Care network", value: "2 hospitals", change: "Verified availability", tone: "indigo" },
    ];
  }
  const hospitalAppointments = appointments.filter((appointment) => appointment.hospitalId === hospitalId);
  return [
    { label: "Appointments this week", value: String(hospitalAppointments.length + 21), change: "+12.4% vs last week", tone: "teal" },
    { label: "Verification rate", value: "98.6%", change: "+2.1% vs last week", tone: "green" },
    { label: "Average booking latency", value: "1.8s", change: "-0.4s vs last week", tone: "indigo" },
    { label: "Open workflows", value: "04", change: "1 needs attention", tone: "amber" },
  ];
};

router.get("/demo/overview", (req, res) => {
  const parsed = GetDemoOverviewQueryParams.parse(req.query);
  const selectedHospital = hospitalFor(parsed.hospitalId);
  const role = parsed.role ?? "PATIENT";
  const visibleAppointments = role === "PLATFORM_ADMIN" ? appointments : appointments.filter((appointment) => appointment.hospitalId === selectedHospital.id);
  res.json({
    role,
    user: role === "PATIENT" ? "Maya Nair" : role === "DOCTOR" ? "Dr. Anika Rao" : role === "PLATFORM_ADMIN" ? "Aarav Shah" : "Nisha Kulkarni",
    hospital: selectedHospital,
    metrics: metricsFor(role, selectedHospital.id),
    appointments: visibleAppointments.slice(0, 6),
    activity: activity(selectedHospital.id),
  });
});

router.get("/demo/hospitals", (_req, res) => res.json(hospitals));

router.get("/demo/doctors", (req, res) => {
  const parsed = GetDemoDoctorsQueryParams.parse(req.query);
  res.json(doctors.filter((doctor) => doctor.hospitalId === parsed.hospitalId));
});

router.get("/demo/availability", (req, res) => {
  const parsed = GetDemoAvailabilityQueryParams.parse(req.query);
  const doctor = doctorFor(parsed.doctorId);
  if (!doctor || doctor.hospitalId !== parsed.hospitalId) return res.status(404).json({ error: "Doctor is not available in this hospital." });
  return res.json(slotsFor(parsed.doctorId, parsed.date));
});

router.get("/demo/appointments", (req, res) => {
  const parsed = GetDemoAppointmentsQueryParams.parse(req.query);
  if (parsed.role === "PLATFORM_ADMIN") return res.json(appointments);
  return res.json(appointments.filter((appointment) => appointment.hospitalId === parsed.hospitalId));
});

router.post("/demo/appointments", (req, res) => {
  const parsed = CreateDemoAppointmentBody.parse(req.body);
  const slot = slots.find((candidate) => candidate.id === parsed.slotId);
  const doctor = doctorFor(parsed.doctorId);
  if (!slot || slot.status !== "AVAILABLE" || !doctor || doctor.hospitalId !== parsed.hospitalId) {
    return res.status(409).json({ error: "That slot is no longer available. Please select another verified slot." });
  }
  slot.status = "BOOKED";
  const correlationId = id("corr");
  const appointment: Appointment = {
    id: id("apt"),
    hospitalId: parsed.hospitalId,
    patientName: parsed.patientName,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date: slot.date,
    time: slot.time,
    type: parsed.appointmentType,
    status: "CONFIRMED",
    externalStatus: "VERIFIED",
    verificationStatus: "VERIFIED",
    synchronizationStatus: "SYNCHRONIZED",
    correlationId,
    externalId: `NSMC-EXT-${Math.floor(10000 + Math.random() * 89999)}`,
    questionnaireStatus: "ASSIGNED",
    createdAt: isoNow(),
    doctorId: doctor.id,
  };
  appointments.unshift(appointment);
  auditEvents.unshift(
    { id: id("audit"), action: "APPOINTMENT_CONFIRMED", actor: "patient-access-agent", resource: `Appointment ${appointment.id}`, status: "SUCCESS", timestamp: isoNow(), correlationId, hospitalId: parsed.hospitalId },
    { id: id("audit"), action: "QUESTIONNAIRE_ASSIGNED", actor: "workflow / pre-visit", resource: `Appointment ${appointment.id}`, status: "SUCCESS", timestamp: isoNow(), correlationId, hospitalId: parsed.hospitalId },
  );
  workflows.unshift({
    id: id("workflow"),
    name: "Appointment confirmed",
    trigger: "appointment.confirmed",
    status: "COMPLETED",
    scheduledFor: isoNow(),
    completedAt: isoNow(),
    hospitalId: parsed.hospitalId,
    steps: [
      { label: "Questionnaire assigned", status: "COMPLETED" },
      { label: "Reminder scheduled", status: "COMPLETED" },
      { label: "Patient notification", status: "COMPLETED" },
      { label: "Doctor inbox updated", status: "COMPLETED" },
    ],
  });
  const timeline = timelineFor(appointment);
  return res.status(201).json({
    appointment,
    timeline,
    message: "Your appointment is confirmed. The external record was verified and synchronized.",
  });
});

router.get("/demo/appointments/:appointmentId", (req, res) => {
  const parsed = GetDemoAppointmentParams.parse(req.params);
  const appointment = appointments.find((candidate) => candidate.id === parsed.appointmentId);
  if (!appointment) return res.status(404).json({ error: "Appointment not found." });
  return res.json({ appointment, timeline: timelineFor(appointment) });
});

router.post("/demo/ai/message", (req, res) => {
  const parsed = SendDemoAiMessageBody.parse(req.body);
  const current = conversationMessages.get(parsed.conversationId) ?? [];
  current.push({ role: "user", text: parsed.message, timestamp: isoNow() });
  const lower = parsed.message.toLowerCase();
  let reply = "I can help with administrative care access, but I cannot diagnose conditions or recommend treatment.";
  let intent = "SAFETY_REDIRECT";
  let stage = "SAFE_REDIRECT";
  let suggestedSlots: typeof slots = [];

  if (/(diagnos|disease|what do i have|medication|prescri)/.test(lower)) {
    reply = "I can’t diagnose or advise on medication changes. I can help you find an appropriate appointment, or connect you with a care coordinator.";
  } else if (!parsed.selectedDoctorId && !parsed.selectedSlotId && /(shoulder|knee|back|doctor|appointment|see)/.test(lower)) {
    intent = "FIND_APPOINTMENT";
    stage = "CLARIFICATION";
    reply = "I can help you find an appointment. What day works best, and would you prefer an in-person consultation? I’ll only show slots that are actually bookable.";
  } else if (!parsed.selectedDoctorId && /(friday|monday|tuesday|wednesday|thursday|weekend|tomorrow|today)/.test(lower)) {
    intent = "FIND_APPOINTMENT";
    stage = "DISCOVERY";
    const doctor = doctors.find((candidate) => candidate.hospitalId === (parsed.hospitalId ?? "hospital-a") && candidate.specialty === "Orthopedics") ?? doctors[0];
    suggestedSlots = slots.filter((slot) => slot.doctorId === doctor.id && slot.status === "AVAILABLE").slice(0, 4);
    reply = `${doctor.name} has verified availability at ${suggestedSlots.map((slot) => `${slot.time} on ${new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${slot.date}T12:00:00`))}`).join(", ")}. Which slot would you like?`;
  } else if (parsed.selectedDoctorId || parsed.selectedSlotId || /(slot|book|in-person)/.test(lower)) {
    intent = "BOOK_APPOINTMENT";
    stage = "READY_TO_BOOK";
    const doctor = doctorFor(parsed.selectedDoctorId ?? "dr-rao") ?? doctors[0];
    suggestedSlots = slots.filter((slot) => slot.doctorId === doctor.id && slot.status === "AVAILABLE").slice(0, 4);
    reply = "I found the live schedule. Select one of these verified slots and I’ll create the appointment, then verify it with the connected healthcare system before confirming.";
  }

  current.push({ role: "assistant", text: reply, timestamp: isoNow() });
  conversationMessages.set(parsed.conversationId, current);
  res.json({
    conversationId: parsed.conversationId,
    reply,
    intent,
    stage,
    messages: current.map((message, index) => ({ id: `${parsed.conversationId}-${index}`, ...message })),
    suggestedSlots,
    safetyNote: "Administrative access only. No diagnosis, treatment, or medication advice.",
  });
});

router.get("/demo/questionnaire", (_req, res) => res.json(questionnaire));

router.post("/demo/questionnaire", (req, res) => {
  const parsed = SubmitDemoQuestionnaireBody.parse(req.body);
  for (const question of questionnaire.questions) {
    question.answer = parsed.answers[question.id] ?? question.answer;
  }
  questionnaire.status = "SUBMITTED";
  questionnaire.submittedAt = isoNow();
  workflows.unshift({
    id: id("workflow"),
    name: "Questionnaire review",
    trigger: "questionnaire.completed",
    status: "COMPLETED",
    scheduledFor: isoNow(),
    completedAt: isoNow(),
    hospitalId: "hospital-a",
    steps: [
      { label: "Validate structured answers", status: "COMPLETED" },
      { label: "Notify doctor", status: "COMPLETED" },
    ],
  });
  auditEvents.unshift({ id: id("audit"), action: "QUESTIONNAIRE_COMPLETED", actor: "Maya Nair", resource: questionnaire.title, status: "SUCCESS", timestamp: isoNow(), correlationId: "corr-8f31b2", hospitalId: "hospital-a" });
  res.json(questionnaire);
});

router.post("/demo/failure-simulation", (req, res) => {
  const parsed = RunFailureSimulationBody.parse(req.body ?? {});
  const hospitalId = parsed.hospitalId ?? "hospital-a";
  const correlationId = id("corr-timeout");
  const operationId = id("op-ehr");
  const base = Date.now();
  const event = (label: string, detail: string, status: string, offset: number): TimelineEvent => ({
    id: id("recovery"),
    label,
    detail,
    status,
    timestamp: new Date(base + offset).toISOString(),
    operationId,
  });
  const recoveryTimeline = [
    event("Booking request accepted", "Idempotency key created: hospital-a / maya-nair / demo-timeout", "COMPLETED", 0),
    event("Mock EHR request timed out", "No response received within 2,000 ms. The outcome is UNKNOWN, not FAILED.", "FAILED", 420),
    event("External state queried", "Read-before-retry found an existing record with the same idempotency key.", "COMPLETED", 880),
    event("Duplicate creation prevented", "The connector did not issue a second create request.", "COMPLETED", 1240),
    event("Appointment synchronized", "External NSMC-EXT-98431 mapped to internal appointment apt-2048.", "COMPLETED", 1650),
    event("Recovery verified", "Final state is CONFIRMED after external verification.", "COMPLETED", 1990),
  ];
  auditEvents.unshift({ id: id("audit"), action: "RECONCILIATION_RECOVERED", actor: "reconciliation-worker", resource: "Appointment apt-2048", status: "SUCCESS", timestamp: isoNow(), correlationId, hospitalId });
  res.json({
    scenario: "Mock EHR timeout → unknown outcome → read-before-retry reconciliation",
    classification: "UNKNOWN_OUTCOME",
    correlationId,
    operationId,
    retryCount: 0,
    externalStatus: "FOUND_EXISTING_RECORD",
    verificationStatus: "VERIFIED",
    synchronizationStatus: "SYNCHRONIZED",
    finalState: "CONFIRMED",
    timeline: recoveryTimeline,
  });
});

router.get("/demo/analytics", (req, res) => {
  const parsed = GetDemoAnalyticsQueryParams.parse(req.query);
  const hospitalAppointments = appointments.filter((appointment) => appointment.hospitalId === parsed.hospitalId);
  res.json({
    bookingSuccess: 96.8,
    verificationRate: 98.6,
    medianLatency: 1.8,
    utilization: 76,
    weeklyVolume: [
      { label: "Mon", value: 28 },
      { label: "Tue", value: 34 },
      { label: "Wed", value: 31 },
      { label: "Thu", value: 42 },
      { label: "Fri", value: 38 },
      { label: "Sat", value: 26 },
      { label: "Sun", value: hospitalAppointments.length + 12 },
    ],
    statusCounts: [
      { label: "Confirmed", value: 42 },
      { label: "Completed", value: 28 },
      { label: "Pending", value: 4 },
      { label: "Cancelled", value: 3 },
    ],
  });
});

router.get("/demo/audit", (req, res) => {
  const parsed = GetDemoAuditQueryParams.parse(req.query);
  res.json(auditEvents.filter((event) => event.hospitalId === parsed.hospitalId || parsed.hospitalId === "all").slice(0, 24));
});

router.get("/demo/workflows", (req, res) => {
  const parsed = GetDemoWorkflowsQueryParams.parse(req.query);
  res.json(workflows.filter((workflow) => workflow.hospitalId === parsed.hospitalId || parsed.hospitalId === "all"));
});

export default router;