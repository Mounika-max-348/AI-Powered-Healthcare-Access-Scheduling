import { createHash, randomUUID } from "node:crypto";
import {
  appointments,
  auditEvents,
  doctors,
  slots,
  workflows,
  type Appointment,
  type AuditEvent,
  type Slot,
} from "./careflow-state";
import {
  MockHealthcareConnector,
  UnknownOutcomeError,
  type HealthcareConnector,
} from "./ehr-connector";

export type AppointmentState =
  | "REQUESTED"
  | "PENDING_EXTERNAL"
  | "EXTERNAL_CREATED"
  | "UNKNOWN_OUTCOME"
  | "RECONCILING"
  | "VERIFIED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type BookingInput = {
  hospitalId: string;
  doctorId: string;
  slotId: string;
  patientName: string;
  appointmentType: string;
  idempotencyKey: string;
  simulateTimeout?: boolean;
};

export type DomainContext = {
  actorId: string;
  correlationId: string;
};

export type BookingResult = {
  appointment: Appointment;
  timeline: ReturnType<typeof timelineFor>;
  message: string;
  replayed: boolean;
};

type IdempotencyRecord = {
  fingerprint: string;
  appointmentId: string;
  result: BookingResult;
  statusCode: 201 | 202;
};

const transitions: Record<AppointmentState, AppointmentState[]> = {
  REQUESTED: ["PENDING_EXTERNAL", "CANCELLED"],
  PENDING_EXTERNAL: ["EXTERNAL_CREATED", "UNKNOWN_OUTCOME", "FAILED"],
  EXTERNAL_CREATED: ["VERIFIED", "UNKNOWN_OUTCOME", "FAILED"],
  UNKNOWN_OUTCOME: ["RECONCILING", "CANCELLED"],
  RECONCILING: ["EXTERNAL_CREATED", "VERIFIED", "FAILED"],
  VERIFIED: ["CONFIRMED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 409,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function transitionAppointment(
  appointment: Appointment,
  next: AppointmentState,
) {
  const current = appointment.status as AppointmentState;
  if (!transitions[current]?.includes(next)) {
    throw new DomainError(`Invalid appointment transition ${current} → ${next}.`, 409);
  }
  appointment.status = next;
  return appointment;
}

export function isBookableSlot(slot: Slot, doctorId: string, hospitalId: string) {
  const doctor = doctors.find((candidate) => candidate.id === doctorId);
  if (!doctor || doctor.hospitalId !== hospitalId) return false;
  if (slot.doctorId !== doctorId || slot.status !== "AVAILABLE") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^\d{2}:\d{2}$/.test(slot.time)) return false;
  const minutes = Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3));
  return minutes >= 9 * 60 && minutes + slot.duration <= 17 * 60 && !(minutes >= 13 * 60 && minutes < 14 * 60);
}

export function hasSchedulingConflict(slot: Slot) {
  return appointments.some(
    (appointment) =>
      appointment.doctorId === slot.doctorId &&
      appointment.date === slot.date &&
      appointment.time === slot.time &&
      !["CANCELLED", "FAILED"].includes(appointment.status),
  );
}

export function isLiveAvailableSlot(slot: Slot, doctorId: string, hospitalId: string) {
  return isBookableSlot(slot, doctorId, hospitalId) && !hasSchedulingConflict(slot);
}

function fingerprint(input: BookingInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        hospitalId: input.hospitalId,
        doctorId: input.doctorId,
        slotId: input.slotId,
        patientName: input.patientName,
        appointmentType: input.appointmentType,
      }),
    )
    .digest("hex");
}

export function timelineFor(appointment: Appointment) {
  const base = new Date(appointment.createdAt).getTime();
  return [
    { id: `${appointment.id}-requested`, label: "Appointment requested", detail: "Request accepted with an idempotency key.", status: "COMPLETED", timestamp: new Date(base).toISOString(), operationId: `${appointment.id}:request` },
    { id: `${appointment.id}-external`, label: "External booking", detail: `Connector state: ${appointment.externalStatus}.`, status: appointment.externalStatus === "UNKNOWN" ? "FAILED" : "COMPLETED", timestamp: new Date(base + 100).toISOString(), operationId: `${appointment.id}:ehr-create` },
    { id: `${appointment.id}-verify`, label: "External appointment verified", detail: `Verification state: ${appointment.verificationStatus}.`, status: appointment.verificationStatus === "VERIFIED" ? "COMPLETED" : "PENDING", timestamp: new Date(base + 200).toISOString(), operationId: `${appointment.id}:verify` },
    { id: `${appointment.id}-sync`, label: "Internal state synchronized", detail: `Appointment state: ${appointment.status}.`, status: appointment.synchronizationStatus === "SYNCHRONIZED" ? "COMPLETED" : "PENDING", timestamp: new Date(base + 300).toISOString(), operationId: `${appointment.id}:sync` },
  ];
}

export class CareFlowDomain {
  private readonly connector: HealthcareConnector;
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(connector: HealthcareConnector = new MockHealthcareConnector()) {
    this.connector = connector;
  }

  private async withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, current);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }

  private audit(
    action: string,
    actor: string,
    resource: string,
    status: string,
    hospitalId: string,
    correlationId: string,
  ) {
    const event: AuditEvent = {
      id: `audit-${randomUUID()}`,
      action,
      actor,
      resource,
      status,
      timestamp: new Date().toISOString(),
      correlationId,
      hospitalId,
    };
    auditEvents.unshift(event);
    return event;
  }

  private appointmentFor(id: string) {
    const appointment = appointments.find((candidate) => candidate.id === id);
    if (!appointment) throw new DomainError("Appointment not found.", 404);
    return appointment;
  }

  private slotConflicted(slot: Slot) {
    return hasSchedulingConflict(slot);
  }

  async book(input: BookingInput, context: DomainContext): Promise<{ result: BookingResult; statusCode: 201 | 202 }> {
    const existing = this.idempotency.get(input.idempotencyKey);
    const currentFingerprint = fingerprint(input);
    if (existing) {
      if (existing.fingerprint !== currentFingerprint) {
        throw new DomainError("Idempotency key was already used with different booking data.", 409);
      }
      return { result: { ...existing.result, replayed: true }, statusCode: existing.statusCode };
    }

    return this.withLock(`idempotency:${input.idempotencyKey}`, async () => {
      const replay = this.idempotency.get(input.idempotencyKey);
      if (replay) {
        if (replay.fingerprint !== currentFingerprint) {
          throw new DomainError("Idempotency key was already used with different booking data.", 409);
        }
        return { result: { ...replay.result, replayed: true }, statusCode: replay.statusCode };
      }

      return this.withLock(`slot:${input.slotId}`, async () => {
        const slot = slots.find((candidate) => candidate.id === input.slotId);
        if (!slot || !isBookableSlot(slot, input.doctorId, input.hospitalId) || this.slotConflicted(slot)) {
          throw new DomainError("That slot is no longer available. Please select another verified slot.", 409);
        }
        const doctor = doctors.find((candidate) => candidate.id === input.doctorId)!;
        const appointment: Appointment = {
          id: `apt-${randomUUID()}`,
          hospitalId: input.hospitalId,
          patientName: input.patientName,
          doctorName: doctor.name,
          specialty: doctor.specialty,
          date: slot.date,
          time: slot.time,
          type: input.appointmentType,
          status: "REQUESTED",
          externalStatus: "NOT_REQUESTED",
          verificationStatus: "PENDING",
          synchronizationStatus: "PENDING",
          correlationId: context.correlationId,
          externalId: null,
          questionnaireStatus: "ASSIGNED",
          createdAt: new Date().toISOString(),
          doctorId: doctor.id,
        };
        appointments.unshift(appointment);
        slot.status = "HELD";
        this.audit("APPOINTMENT_REQUESTED", context.actorId, `Appointment ${appointment.id}`, "SUCCESS", input.hospitalId, context.correlationId);
        transitionAppointment(appointment, "PENDING_EXTERNAL");

        try {
          const external = await this.connector.createAppointment({
            idempotencyKey: input.idempotencyKey,
            hospitalId: input.hospitalId,
            doctorId: input.doctorId,
            patientName: input.patientName,
            date: slot.date,
            time: slot.time,
            appointmentType: input.appointmentType,
            simulateTimeout: input.simulateTimeout,
          });
          appointment.externalId = external.id;
          appointment.externalStatus = "CREATED";
          transitionAppointment(appointment, "EXTERNAL_CREATED");
        } catch (error) {
          if (!(error instanceof UnknownOutcomeError)) {
            transitionAppointment(appointment, "FAILED");
            slot.status = "AVAILABLE";
            throw error;
          }
          appointment.externalStatus = "UNKNOWN";
          transitionAppointment(appointment, "UNKNOWN_OUTCOME");
          this.audit("EHR_UNKNOWN_OUTCOME", context.actorId, `Appointment ${appointment.id}`, "WARNING", input.hospitalId, context.correlationId);
        }

        if (appointment.status === "EXTERNAL_CREATED") {
          const external = await this.connector.getAppointment(input.hospitalId, appointment.externalId!);
          if (!external || external.doctorId !== input.doctorId || external.date !== slot.date || external.time !== slot.time || external.patientName !== input.patientName) {
            appointment.verificationStatus = "FAILED";
            transitionAppointment(appointment, "FAILED");
            slot.status = "AVAILABLE";
            throw new DomainError("External appointment verification failed.", 409);
          }
          appointment.verificationStatus = "VERIFIED";
          transitionAppointment(appointment, "VERIFIED");
          transitionAppointment(appointment, "CONFIRMED");
          appointment.externalStatus = "VERIFIED";
          appointment.synchronizationStatus = "SYNCHRONIZED";
          slot.status = "BOOKED";
          this.audit("EXTERNAL_VERIFICATION_COMPLETED", "external-verifier", `Appointment ${appointment.id}`, "SUCCESS", input.hospitalId, context.correlationId);
          this.audit("APPOINTMENT_CONFIRMED", context.actorId, `Appointment ${appointment.id}`, "SUCCESS", input.hospitalId, context.correlationId);
        }

        const result: BookingResult = {
          appointment,
          timeline: timelineFor(appointment),
          message: appointment.status === "CONFIRMED"
            ? "Your appointment is confirmed after external verification."
            : "The external system did not return a response. The appointment is held for reconciliation.",
          replayed: false,
        };
        const statusCode = appointment.status === "UNKNOWN_OUTCOME" ? 202 : 201;
        this.idempotency.set(input.idempotencyKey, { fingerprint: currentFingerprint, appointmentId: appointment.id, result, statusCode });
        return { result, statusCode };
      });
    });
  }

  async reconcile(appointmentId: string, context: DomainContext) {
    const appointment = this.appointmentFor(appointmentId);
    if (appointment.status !== "UNKNOWN_OUTCOME") {
      throw new DomainError("Only appointments with an unknown external outcome can be reconciled.", 409);
    }
    return this.withLock(`appointment:${appointmentId}`, async () => {
      transitionAppointment(appointment, "RECONCILING");
      this.audit("RECONCILIATION_STARTED", context.actorId, `Appointment ${appointment.id}`, "SUCCESS", appointment.hospitalId, context.correlationId);
      const key = [...this.idempotency.entries()].find(([, record]) => record.appointmentId === appointment.id)?.[0];
      if (!key) throw new DomainError("Appointment idempotency record is missing.", 409);
      let external = await this.connector.findAppointmentByIdempotencyKey(appointment.hospitalId, key);
      let duplicatePrevented = Boolean(external);
      if (!external) {
        external = await this.connector.createAppointment({
          idempotencyKey: key,
          hospitalId: appointment.hospitalId,
          doctorId: appointment.doctorId,
          patientName: appointment.patientName,
          date: appointment.date,
          time: appointment.time,
          appointmentType: appointment.type,
        });
      }
      if (duplicatePrevented) {
        this.audit("DUPLICATE_CREATION_PREVENTED", "reconciliation-worker", `Appointment ${appointment.id}`, "SUCCESS", appointment.hospitalId, context.correlationId);
      }
      appointment.externalId = external.id;
      appointment.externalStatus = "VERIFIED";
      const verified = await this.connector.getAppointment(appointment.hospitalId, external.id);
      if (!verified || verified.doctorId !== appointment.doctorId || verified.date !== appointment.date || verified.time !== appointment.time) {
        transitionAppointment(appointment, "FAILED");
        throw new DomainError("Reconciliation verification failed.", 409);
      }
      appointment.verificationStatus = "VERIFIED";
      transitionAppointment(appointment, "VERIFIED");
      transitionAppointment(appointment, "CONFIRMED");
      appointment.synchronizationStatus = "SYNCHRONIZED";
      const slot = slots.find((candidate) => candidate.doctorId === appointment.doctorId && candidate.date === appointment.date && candidate.time === appointment.time);
      if (slot) slot.status = "BOOKED";
      this.audit("RECONCILIATION_RECOVERED", "reconciliation-worker", `Appointment ${appointment.id}`, "SUCCESS", appointment.hospitalId, context.correlationId);
      this.audit("APPOINTMENT_SYNCHRONIZED", "reconciliation-worker", `Appointment ${appointment.id}`, "SUCCESS", appointment.hospitalId, context.correlationId);
      const idempotencyRecord = this.idempotency.get(key);
      if (idempotencyRecord) {
        idempotencyRecord.result = {
          appointment,
          timeline: timelineFor(appointment),
          message: "Your appointment is confirmed after reconciliation and external verification.",
          replayed: false,
        };
        idempotencyRecord.statusCode = 201;
      }
      return { appointment, timeline: timelineFor(appointment) };
    });
  }
}

export const careFlowDomain = new CareFlowDomain();
