import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { slots } from "./lib/careflow-state";
import { actorFromRequest, canReadAppointment, createDemoSessionToken, requireHospitalAccess } from "./lib/auth";
import { CareFlowDomain, DomainError, transitionAppointment } from "./lib/careflow-domain";
import { MockHealthcareConnector } from "./lib/ehr-connector";
import app from "./app";

const headers = (role: string, hospitalId?: string) => ({
  "x-careflow-role": role,
  ...(hospitalId ? { "x-careflow-hospital-id": hospitalId } : {}),
});

function availableSlot(doctorId: string) {
  const slot = slots.find((candidate) => candidate.doctorId === doctorId && candidate.status === "AVAILABLE");
  assert.ok(slot, `expected an available slot for ${doctorId}`);
  return slot;
}

describe("CareFlow backend controls", () => {
  it("enforces the appointment state machine", () => {
    const appointment = {
      status: "REQUESTED",
    } as { status: string };
    transitionAppointment(appointment as never, "PENDING_EXTERNAL");
    assert.equal(appointment.status, "PENDING_EXTERNAL");
    assert.throws(
      () => transitionAppointment(appointment as never, "CONFIRMED"),
      (error: unknown) => error instanceof DomainError && error.statusCode === 409,
    );
  });

  it("does not allow tenant scope to be escalated by a hospital id", () => {
    const actor = { id: "admin-a", role: "HOSPITAL_ADMIN" as const, hospitalId: "hospital-a", displayName: "Admin A" };
    assert.throws(() => requireHospitalAccess(actor, "hospital-b"), /not authorized/);
    assert.equal(canReadAppointment(actor, "hospital-a", "Any Patient"), true);
    assert.equal(canReadAppointment(actor, "hospital-b", "Any Patient"), false);
  });

  it("prevents double booking when two requests race for one slot", async () => {
    const domain = new CareFlowDomain(new MockHealthcareConnector());
    const slot = availableSlot("dr-mehta");
    const base = {
      hospitalId: "hospital-a",
      doctorId: "dr-mehta",
      slotId: slot.id,
      patientName: "Maya Nair",
      appointmentType: "Consultation",
    };
    const results = await Promise.allSettled([
      domain.book({ ...base, idempotencyKey: `race-a-${slot.id}` }, { actorId: "patient-maya", correlationId: "corr-race-a" }),
      domain.book({ ...base, idempotencyKey: `race-b-${slot.id}` }, { actorId: "patient-maya", correlationId: "corr-race-b" }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  });

  it("replays an idempotent booking without creating a second appointment", async () => {
    const domain = new CareFlowDomain(new MockHealthcareConnector());
    const slot = availableSlot("dr-shah");
    const input = {
      hospitalId: "hospital-a",
      doctorId: "dr-shah",
      slotId: slot.id,
      patientName: "Maya Nair",
      appointmentType: "Consultation",
      idempotencyKey: `replay-${slot.id}`,
    };
    const first = await domain.book(input, { actorId: "patient-maya", correlationId: "corr-replay-1" });
    const second = await domain.book(input, { actorId: "patient-maya", correlationId: "corr-replay-2" });
    assert.equal(first.result.appointment.id, second.result.appointment.id);
    assert.equal(second.result.replayed, true);
    await assert.rejects(
      () => domain.book({ ...input, patientName: "Different Patient" }, { actorId: "patient-maya", correlationId: "corr-replay-3" }),
      (error: unknown) => error instanceof DomainError && /Idempotency key/.test(error.message),
    );
  });

  it("recovers an unknown external outcome by lookup before retry", async () => {
    const domain = new CareFlowDomain(new MockHealthcareConnector());
    const slot = availableSlot("dr-iyer");
    const input = {
      hospitalId: "hospital-a",
      doctorId: "dr-iyer",
      slotId: slot.id,
      patientName: "Maya Nair",
      appointmentType: "Consultation",
      idempotencyKey: `unknown-${slot.id}`,
      simulateTimeout: true,
    };
    const pending = await domain.book(input, { actorId: "patient-maya", correlationId: "corr-unknown" });
    assert.equal(pending.statusCode, 202);
    assert.equal(pending.result.appointment.status, "UNKNOWN_OUTCOME");
    const recovered = await domain.reconcile(pending.result.appointment.id, { actorId: "worker", correlationId: "corr-recover" });
    assert.equal(recovered.appointment.status, "CONFIRMED");
    assert.equal(recovered.appointment.verificationStatus, "VERIFIED");
    assert.ok(recovered.appointment.externalId);
  });

  describe("HTTP RBAC, capabilities, verification, and correlation", () => {
    let server: ReturnType<typeof app.listen>;
    let baseUrl = "";

    before(async () => {
      server = app.listen(0);
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}`;
    });

    after(async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    it("returns only the actor tenant for hospital-admin directory reads", async () => {
      const response = await fetch(`${baseUrl}/api/demo/hospitals`, { headers: headers("HOSPITAL_ADMIN", "hospital-a") });
      assert.equal(response.status, 200);
      const body = await response.json() as Array<{ id: string }>;
      assert.deepEqual(body.map((hospital) => hospital.id), ["hospital-a"]);
    });

    it("accepts signed actor sessions and rejects forged bearer tokens", async () => {
      const token = createDemoSessionToken({
        id: "platform-aarav",
        role: "PLATFORM_ADMIN",
        hospitalId: null,
        displayName: "Aarav Shah",
      });
      const authorized = await fetch(`${baseUrl}/api/demo/hospitals`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(authorized.status, 200);
      assert.equal((await authorized.json() as Array<unknown>).length, 2);
      const forged = await fetch(`${baseUrl}/api/demo/hospitals`, {
        headers: { authorization: "Bearer forged-token" },
      });
      assert.equal(forged.status, 401);
    });

    it("issues a working session token for each demo persona and rejects unknown roles", async () => {
      for (const role of ["PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN"]) {
        const login = await fetch(`${baseUrl}/api/auth/demo-login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        });
        assert.equal(login.status, 200);
        const body = await login.json() as { token: string; actor: { role: string } };
        assert.equal(body.actor.role, role);
        const me = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { authorization: `Bearer ${body.token}` },
        });
        assert.equal(me.status, 200);
        const meBody = await me.json() as { actor: { role: string } };
        assert.equal(meBody.actor.role, role);
      }

      const invalid = await fetch(`${baseUrl}/api/auth/demo-login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "SUPERUSER" }),
      });
      assert.equal(invalid.status, 400);
    });

    it("rejects cross-tenant audit access and ignores query-string role escalation", async () => {
      const response = await fetch(`${baseUrl}/api/demo/audit?hospitalId=hospital-b&role=PLATFORM_ADMIN`, {
        headers: headers("HOSPITAL_ADMIN", "hospital-a"),
      });
      assert.equal(response.status, 403);
    });

    it("keeps AI discovery capability-scoped to the actor tenant", async () => {
      const response = await fetch(`${baseUrl}/api/demo/ai/message`, {
        method: "POST",
        headers: { ...headers("HOSPITAL_ADMIN", "hospital-a"), "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "capability-scope-test",
          message: "book a slot",
          hospitalId: "hospital-b",
          selectedDoctorId: "dr-wilson",
        }),
      });
      assert.equal(response.status, 403);
    });

    it("verifies a booking externally and returns a correlation id", async () => {
      const slot = availableSlot("dr-rao");
      const response = await fetch(`${baseUrl}/api/demo/appointments`, {
        method: "POST",
        headers: {
          ...headers("PATIENT", "hospital-a"),
          "content-type": "application/json",
          "idempotency-key": `http-booking-${slot.id}`,
          "x-correlation-id": "corr-http-booking",
        },
        body: JSON.stringify({
          hospitalId: "hospital-a",
          doctorId: "dr-rao",
          slotId: slot.id,
          patientName: "Maya Nair",
          appointmentType: "Consultation",
        }),
      });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get("x-correlation-id"), "corr-http-booking");
      const body = await response.json() as { appointment: { status: string; verificationStatus: string; externalId: string | null } };
      assert.equal(body.appointment.status, "CONFIRMED");
      assert.equal(body.appointment.verificationStatus, "VERIFIED");
      assert.ok(body.appointment.externalId);
    });

    it("runs the real timeout, lookup, duplicate-prevention, and reconciliation path", async () => {
      const response = await fetch(`${baseUrl}/api/demo/failure-simulation`, {
        method: "POST",
        headers: { ...headers("HOSPITAL_ADMIN", "hospital-a"), "content-type": "application/json", "x-correlation-id": "corr-http-recovery" },
        body: JSON.stringify({ hospitalId: "hospital-a" }),
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { finalState: string; correlationId: string };
      assert.equal(body.finalState, "CONFIRMED");
      assert.equal(body.correlationId, "corr-http-recovery");
      const auditResponse = await fetch(`${baseUrl}/api/demo/audit?hospitalId=hospital-a`, { headers: headers("HOSPITAL_ADMIN", "hospital-a") });
      const audit = await auditResponse.json() as Array<{ action: string; correlationId: string }>;
      assert.ok(audit.some((event) => event.action === "DUPLICATE_CREATION_PREVENTED" && event.correlationId === "corr-http-recovery"));
      assert.ok(audit.some((event) => event.action === "RECONCILIATION_RECOVERED" && event.correlationId === "corr-http-recovery"));
    });
  });
});
