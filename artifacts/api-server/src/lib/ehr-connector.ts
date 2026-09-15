import { randomUUID } from "node:crypto";

export type ExternalAppointment = {
  id: string;
  idempotencyKey: string;
  hospitalId: string;
  doctorId: string;
  patientName: string;
  date: string;
  time: string;
  appointmentType: string;
  status: "BOOKED";
};

export type ExternalAppointmentInput = Omit<ExternalAppointment, "id" | "status"> & {
  simulateTimeout?: boolean;
};

export class UnknownOutcomeError extends Error {
  constructor(message = "The healthcare system did not confirm the create response.") {
    super(message);
    this.name = "UnknownOutcomeError";
  }
}

export interface HealthcareConnector {
  createAppointment(input: ExternalAppointmentInput): Promise<ExternalAppointment>;
  findAppointmentByIdempotencyKey(
    hospitalId: string,
    idempotencyKey: string,
  ): Promise<ExternalAppointment | null>;
  getAppointment(hospitalId: string, externalId: string): Promise<ExternalAppointment | null>;
}

export class MockHealthcareConnector implements HealthcareConnector {
  private readonly records = new Map<string, ExternalAppointment>();

  async createAppointment(input: ExternalAppointmentInput) {
    const existing = await this.findAppointmentByIdempotencyKey(
      input.hospitalId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const appointment: ExternalAppointment = {
      id: `${input.hospitalId === "hospital-b" ? "HSH" : "NSMC"}-EXT-${randomUUID().slice(0, 8)}`,
      idempotencyKey: input.idempotencyKey,
      hospitalId: input.hospitalId,
      doctorId: input.doctorId,
      patientName: input.patientName,
      date: input.date,
      time: input.time,
      appointmentType: input.appointmentType,
      status: "BOOKED",
    };
    this.records.set(appointment.id, appointment);

    // This simulates a remote commit followed by a lost response. A retry
    // must read by idempotency key rather than creating another record.
    if (input.simulateTimeout) throw new UnknownOutcomeError();
    return appointment;
  }

  async findAppointmentByIdempotencyKey(hospitalId: string, idempotencyKey: string) {
    return (
      [...this.records.values()].find(
        (record) =>
          record.hospitalId === hospitalId && record.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async getAppointment(hospitalId: string, externalId: string) {
    const record = this.records.get(externalId);
    return record?.hospitalId === hospitalId ? record : null;
  }
}