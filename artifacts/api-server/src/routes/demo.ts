import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { classifyPatientMessage } from "../lib/ai-agent";
import {
  CreateDemoAppointmentBody,
  GetDemoAppointmentParams,
  GetDemoAppointmentsQueryParams,
  GetDemoAnalyticsQueryParams,
  GetDemoAuditQueryParams,
  GetDemoAvailabilityQueryParams,
  GetDemoDoctorsQueryParams,
  GetDemoOverviewQueryParams,
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
  workflows,
} from "../lib/careflow-state";
import {
  accessErrorHandler,
  actorFromRequest,
  canReadAppointment,
  canReadHospitalDirectory,
  requireHospitalAccess,
  requireRole,
  type Actor,
} from "../lib/auth";
import {
  careFlowDomain,
  DomainError,
  isLiveAvailableSlot,
  timelineFor,
} from "../lib/careflow-domain";
import { executeCapability } from "../lib/capabilities";

const router: IRouter = Router();

const correlationId = (request: { header(name: string): string | undefined }) =>
  request.header("x-correlation-id") ?? `corr-${randomUUID()}`;

const audit = (
  action: string,
  actor: Actor,
  resource: string,
  status: string,
  hospitalId: string,
  correlation: string,
) => {
  auditEvents.unshift({
    id: `audit-${randomUUID()}`,
    action,
    actor: actor.id,
    resource,
    status,
    timestamp: new Date().toISOString(),
    correlationId: correlation,
    hospitalId,
  });
};

function targetHospital(actor: Actor, requested?: string) {
  const target = requested ?? actor.hospitalId ?? "hospital-a";
  if (actor.role !== "PATIENT" && actor.role !== "PLATFORM_ADMIN") {
    requireHospitalAccess(actor, target);
  }
  if (!hospitals.some((hospital) => hospital.id === target)) {
    throw new DomainError("Hospital not found.", 404);
  }
  return target;
}

function visibleAppointments(actor: Actor, hospitalId?: string) {
  if (actor.role === "PLATFORM_ADMIN") {
    return hospitalId && hospitalId !== "all"
      ? appointments.filter((appointment) => appointment.hospitalId === hospitalId)
      : appointments;
  }
  if (actor.role === "PATIENT") {
    return appointments.filter((appointment) => appointment.patientName === actor.displayName);
  }
  const target = targetHospital(actor, hospitalId);
  return appointments.filter((appointment) => appointment.hospitalId === target);
}

router.get("/demo/overview", (req, res) => {
  const actor = actorFromRequest(req);
  const parsed = GetDemoOverviewQueryParams.parse(req.query);
  const hospitalId = targetHospital(actor, parsed.hospitalId);
  const selectedHospital = hospitalFor(hospitalId);
  const actorAppointments = visibleAppointments(actor, actor.role === "PATIENT" ? undefined : hospitalId);
  const activity = auditEvents
    .filter((event) => event.hospitalId === hospitalId)
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      label: event.action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
      detail: `${event.actor} · ${event.resource}`,
      time: "recently",
      tone: event.status === "SUCCESS" ? "success" : "warning",
    }));
  res.json({
    role: actor.role,
    user: actor.displayName,
    hospital: selectedHospital,
    metrics: actor.role === "PATIENT"
      ? [
          { label: "Upcoming visits", value: String(actorAppointments.filter((appointment) => appointment.status === "CONFIRMED").length), change: "Next visit this week", tone: "teal" },
          { label: "Questionnaire", value: questionnaire.status === "SUBMITTED" ? "Complete" : "Due", change: "Orthopedic intake", tone: "amber" },
          { label: "Care network", value: "2 hospitals", change: "Verified availability", tone: "indigo" },
        ]
      : [
          { label: "Appointments this week", value: String(actorAppointments.length), change: "Tenant-scoped", tone: "teal" },
          { label: "Verification rate", value: "100%", change: "Connector verified", tone: "green" },
          { label: "Average booking latency", value: "Measured", change: "From operation audit", tone: "indigo" },
          { label: "Open workflows", value: String(workflows.filter((workflow) => workflow.hospitalId === hospitalId && workflow.status !== "COMPLETED").length), change: "Tenant-scoped", tone: "amber" },
        ],
    appointments: actorAppointments.slice(0, 6),
    activity,
  });
});

router.get("/demo/hospitals", (req, res) => {
  const actor = actorFromRequest(req);
  if (canReadHospitalDirectory(actor)) return res.json(hospitals);
  return res.json(hospitals.filter((hospital) => hospital.id === actor.hospitalId));
});

router.get("/demo/doctors", (req, res) => {
  const actor = actorFromRequest(req);
  const parsed = GetDemoDoctorsQueryParams.parse(req.query);
  const hospitalId = targetHospital(actor, parsed.hospitalId);
  return res.json(doctors.filter((doctor) => doctor.hospitalId === hospitalId && doctor.status === "ACTIVE"));
});

router.get("/demo/availability", (req, res) => {
  const actor = actorFromRequest(req);
  const parsed = GetDemoAvailabilityQueryParams.parse(req.query);
  const doctor = doctorFor(parsed.doctorId);
  if (!doctor || doctor.hospitalId !== parsed.hospitalId) {
    return res.status(404).json({ error: "Doctor is not available in this hospital." });
  }
  targetHospital(actor, parsed.hospitalId);
  return res.json(
    slots.filter((slot) => slot.date === parsed.date && isLiveAvailableSlot(slot, doctor.id, parsed.hospitalId)),
  );
});

router.get("/demo/appointments", (req, res) => {
  const actor = actorFromRequest(req);
  const parsed = GetDemoAppointmentsQueryParams.parse(req.query);
  return res.json(visibleAppointments(actor, parsed.hospitalId));
});

router.post("/demo/appointments", async (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = CreateDemoAppointmentBody.parse(req.body);
  if (actor.role === "PATIENT" && parsed.patientName !== actor.displayName) {
    return res.status(403).json({ error: "Patients can only book for their own patient identity." });
  }
  if (actor.role !== "PATIENT") requireHospitalAccess(actor, parsed.hospitalId);
  const idempotencyKey = req.header("idempotency-key") ?? `careflow:${actor.id}:${parsed.slotId}`;
  const correlation = correlationId(req);
  const { result, statusCode } = await careFlowDomain.book(
    {
      ...parsed,
      idempotencyKey,
    },
    { actorId: actor.id, correlationId: correlation },
  );
  res.setHeader("x-correlation-id", correlation);
  res.status(statusCode).json(result);
  return undefined;
});

router.get("/demo/appointments/:appointmentId", (req, res) => {
  const actor = actorFromRequest(req);
  const parsed = GetDemoAppointmentParams.parse(req.params);
  const appointment = appointments.find((candidate) => candidate.id === parsed.appointmentId);
  if (!appointment) return res.status(404).json({ error: "Appointment not found." });
  if (!canReadAppointment(actor, appointment.hospitalId, appointment.patientName)) {
    return res.status(403).json({ error: "You are not authorized to access this appointment." });
  }
  return res.json({ appointment, timeline: timelineFor(appointment) });
});

router.post("/demo/appointments/:appointmentId/reconcile", async (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = GetDemoAppointmentParams.parse(req.params);
  const appointment = appointments.find((candidate) => candidate.id === parsed.appointmentId);
  if (!appointment) return res.status(404).json({ error: "Appointment not found." });
  requireHospitalAccess(actor, appointment.hospitalId);
  const correlation = correlationId(req);
  const result = await careFlowDomain.reconcile(parsed.appointmentId, {
    actorId: actor.id,
    correlationId: correlation,
  });
  res.setHeader("x-correlation-id", correlation);
  return res.json(result);
});

router.post("/demo/ai/message", async (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = SendDemoAiMessageBody.parse(req.body);
  const current = conversationMessages.get(parsed.conversationId) ?? [];
  const correlation = correlationId(req);
  current.push({ role: "user", text: parsed.message, timestamp: new Date().toISOString() });
  const lower = parsed.message.toLowerCase();
  let reply = "I can help with administrative care access, but I cannot diagnose conditions or recommend treatment.";
  let intent = "SAFETY_REDIRECT";
  let stage = "SAFE_REDIRECT";
  let suggestedSlots = slots.filter(() => false);

  // Deterministic safety net: catches clinical questions even if the model
  // is unavailable or misclassifies. This check always runs first and is
  // never skipped, regardless of what the model would have said.
  if (/(diagnos|disease|what do i have|medication|prescri)/.test(lower)) {
    audit("AI_SAFETY_REDIRECT", actor, `Conversation ${parsed.conversationId}`, "SUCCESS", parsed.hospitalId ?? actor.hospitalId ?? "hospital-a", correlation);
  } else {
    const hospitalId = targetHospital(actor, parsed.hospitalId);
    const doctor = parsed.selectedDoctorId ? doctorFor(parsed.selectedDoctorId) : undefined;
    if (doctor && doctor.hospitalId !== hospitalId) {
      return res.status(403).json({ error: "The selected doctor is outside the authorized hospital scope." });
    }
    if (parsed.selectedSlotId) {
      const selectedSlot = slots.find((slot) => slot.id === parsed.selectedSlotId);
      if (!selectedSlot || !doctor || selectedSlot.doctorId !== doctor.id || !isLiveAvailableSlot(selectedSlot, doctor.id, hospitalId)) {
        return res.status(409).json({ error: "The selected slot is not a currently bookable capability result." });
      }
    }

    const hospitalDoctors = doctors.filter((candidate) => candidate.hospitalId === hospitalId);
    const availableSpecialties = [...new Set(hospitalDoctors.map((candidate) => candidate.specialty))];

    // Ask Claude to classify the message only when the user hasn't already
    // made an explicit choice via the UI (picking a doctor/slot is handled
    // deterministically below — the model is never in that loop).
    const classification = !parsed.selectedDoctorId && !parsed.selectedSlotId
      ? await classifyPatientMessage(
          parsed.message,
          current.map((m) => ({ role: m.role as "user" | "assistant", text: m.text })),
          availableSpecialties,
        )
      : null;

    if (classification) {
      intent = classification.intent;
      stage = classification.stage;
      reply = classification.reply;

      if (intent === "SAFETY_REDIRECT") {
        audit("AI_SAFETY_REDIRECT", actor, `Conversation ${parsed.conversationId}`, "SUCCESS", hospitalId, correlation);
      } else {
        const selectedDoctor = doctor
          ?? hospitalDoctors.find((candidate) => candidate.specialty === classification.requestedSpecialty)
          ?? hospitalDoctors.find((candidate) => candidate.specialty === "Orthopedics");
        suggestedSlots = selectedDoctor
          ? slots.filter((slot) => slot.doctorId === selectedDoctor.id && isLiveAvailableSlot(slot, selectedDoctor.id, hospitalId)).slice(0, 4)
          : [];
        const capability = intent === "BOOK_APPOINTMENT" ? "prepare_booking" : intent === "FIND_APPOINTMENT" ? "find_available_slots" : "ask_clarifying_question";
        if (selectedDoctor && suggestedSlots.length) {
          executeCapability(capability, actor, hospitalId, correlation);
        }
        audit("CAPABILITY_EXECUTED", actor, `capability:${capability}`, "SUCCESS", hospitalId, correlation);
      }
    } else if (!parsed.selectedDoctorId && !parsed.selectedSlotId && /(shoulder|knee|back|doctor|appointment|see)/.test(lower)) {
      // Fallback rule-based path — used only when no ANTHROPIC_API_KEY is
      // configured, or the model call failed, so the demo keeps working.
      intent = "FIND_APPOINTMENT";
      stage = "CLARIFICATION";
      reply = "I can help you find an appointment. What day works best, and would you prefer an in-person consultation? I’ll only show slots that are actually bookable.";
      audit("CAPABILITY_EXECUTED", actor, "capability:ask_clarifying_question", "SUCCESS", hospitalId, correlation);
    } else {
      intent = parsed.selectedDoctorId || parsed.selectedSlotId || /(slot|book|in-person|friday|monday|tuesday|wednesday|thursday|weekend|tomorrow|today)/.test(lower)
        ? "BOOK_APPOINTMENT"
        : "FIND_APPOINTMENT";
      stage = intent === "BOOK_APPOINTMENT" ? "READY_TO_BOOK" : "DISCOVERY";
      const selectedDoctor = doctor ?? hospitalDoctors.find((candidate) => candidate.specialty === "Orthopedics");
      suggestedSlots = selectedDoctor
        ? slots.filter((slot) => slot.doctorId === selectedDoctor.id && isLiveAvailableSlot(slot, selectedDoctor.id, hospitalId)).slice(0, 4)
        : [];
      reply = intent === "BOOK_APPOINTMENT"
        ? "I found the live schedule. Select one of these verified slots and I’ll create the appointment through the booking capability, then verify it with the connected healthcare system."
        : `${selectedDoctor?.name ?? "The care team"} has verified availability. Which slot would you like?`;
      const capability = intent === "BOOK_APPOINTMENT" ? "prepare_booking" : "find_available_slots";
      executeCapability(capability, actor, hospitalId, correlation);
      audit("CAPABILITY_EXECUTED", actor, `capability:${capability}`, "SUCCESS", hospitalId, correlation);
    }
  }

  current.push({ role: "assistant", text: reply, timestamp: new Date().toISOString() });
  conversationMessages.set(parsed.conversationId, current);
  return res.json({
    conversationId: parsed.conversationId,
    reply,
    intent,
    stage,
    messages: current.map((message, index) => ({ id: `${parsed.conversationId}-${index}`, ...message })),
    suggestedSlots,
    safetyNote: "Administrative access only. No diagnosis, treatment, or medication advice.",
  });
});

router.get("/demo/questionnaire", (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  return res.json(questionnaire);
});

router.post("/demo/questionnaire", (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = SubmitDemoQuestionnaireBody.parse(req.body);
  const required = questionnaire.questions.filter((question) => question.required);
  if (required.some((question) => !parsed.answers[question.id]?.trim())) {
    return res.status(400).json({ error: "All required questionnaire questions must be answered." });
  }
  for (const question of questionnaire.questions) {
    question.answer = parsed.answers[question.id] ?? question.answer;
  }
  questionnaire.status = "SUBMITTED";
  questionnaire.submittedAt = new Date().toISOString();
  const hospitalId = actor.hospitalId ?? "hospital-a";
  workflows.unshift({
    id: `workflow-${randomUUID()}`,
    name: "Questionnaire review",
    trigger: "questionnaire.completed",
    status: "COMPLETED",
    scheduledFor: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    hospitalId,
    steps: [
      { label: "Validate structured answers", status: "COMPLETED" },
      { label: "Notify doctor", status: "COMPLETED" },
    ],
  });
  audit("QUESTIONNAIRE_COMPLETED", actor, questionnaire.title, "SUCCESS", hospitalId, correlationId(req));
  return res.json(questionnaire);
});

router.post("/demo/failure-simulation", async (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = RunFailureSimulationBody.parse(req.body ?? {});
  const hospitalId = targetHospital(actor, parsed.hospitalId);
  const doctor = doctors.find((candidate) => candidate.hospitalId === hospitalId && candidate.specialty === "Orthopedics")!;
  const slot = slots.find((candidate) => candidate.doctorId === doctor.id && isLiveAvailableSlot(candidate, doctor.id, hospitalId));
  if (!slot) return res.status(409).json({ error: "No simulation slot is available." });
  const correlation = correlationId(req);
  const booking = await careFlowDomain.book(
    {
      hospitalId,
      doctorId: doctor.id,
      slotId: slot.id,
      patientName: "Maya Nair",
      appointmentType: "In-person consultation",
      idempotencyKey: `failure-simulation:${hospitalId}:${slot.id}`,
      simulateTimeout: true,
    },
    { actorId: actor.id, correlationId: correlation },
  );
  const recovery = await careFlowDomain.reconcile(booking.result.appointment.id, {
    actorId: "reconciliation-worker",
    correlationId: correlation,
  });
  return res.json({
    scenario: "Mock EHR timeout → unknown outcome → read-before-retry reconciliation",
    classification: "UNKNOWN_OUTCOME",
    correlationId: correlation,
    operationId: `${recovery.appointment.id}:reconcile`,
    retryCount: 0,
    externalStatus: recovery.appointment.externalStatus,
    verificationStatus: recovery.appointment.verificationStatus,
    synchronizationStatus: recovery.appointment.synchronizationStatus,
    finalState: recovery.appointment.status,
    timeline: recovery.timeline,
  });
});

router.get("/demo/analytics", (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = GetDemoAnalyticsQueryParams.parse(req.query);
  const hospitalId = targetHospital(actor, parsed.hospitalId);
  const hospitalAppointments = appointments.filter((appointment) => appointment.hospitalId === hospitalId);
  return res.json({
    bookingSuccess: hospitalAppointments.length ? 100 : 0,
    verificationRate: hospitalAppointments.filter((appointment) => appointment.verificationStatus === "VERIFIED").length / Math.max(1, hospitalAppointments.length) * 100,
    medianLatency: 1.8,
    utilization: 76,
    weeklyVolume: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => ({ label, value: hospitalAppointments.length + index })),
    statusCounts: ["CONFIRMED", "COMPLETED", "PENDING", "CANCELLED"].map((status) => ({ label: status[0] + status.slice(1).toLowerCase(), value: hospitalAppointments.filter((appointment) => appointment.status === status).length })),
  });
});

router.get("/demo/audit", (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = GetDemoAuditQueryParams.parse(req.query);
  const hospitalId = targetHospital(actor, parsed.hospitalId === "all" ? actor.hospitalId ?? "hospital-a" : parsed.hospitalId);
  return res.json(auditEvents.filter((event) => actor.role === "PLATFORM_ADMIN" && parsed.hospitalId === "all" ? true : event.hospitalId === hospitalId).slice(0, 50));
});

router.get("/demo/workflows", (req, res) => {
  const actor = actorFromRequest(req);
  requireRole(actor, "HOSPITAL_ADMIN", "PLATFORM_ADMIN");
  const parsed = GetDemoWorkflowsQueryParams.parse(req.query);
  const hospitalId = targetHospital(actor, parsed.hospitalId === "all" ? actor.hospitalId ?? "hospital-a" : parsed.hospitalId);
  return res.json(workflows.filter((workflow) => actor.role === "PLATFORM_ADMIN" && parsed.hospitalId === "all" ? true : workflow.hospitalId === hospitalId));
});

router.use(accessErrorHandler);

export default router;
