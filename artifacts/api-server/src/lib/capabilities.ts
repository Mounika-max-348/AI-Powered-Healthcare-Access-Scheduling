import { AccessError, type Actor } from "./auth";

export type Capability =
  | "ask_clarifying_question"
  | "find_available_slots"
  | "prepare_booking";

const allowedRoles: Record<Capability, Actor["role"][]> = {
  ask_clarifying_question: ["PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN"],
  find_available_slots: ["PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN"],
  prepare_booking: ["PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN"],
};

export function executeCapability(
  capability: Capability,
  actor: Actor,
  hospitalId: string,
  correlationId: string,
) {
  if (!allowedRoles[capability].includes(actor.role)) {
    throw new AccessError(`Capability ${capability} is not available to this role.`, 403);
  }
  return {
    capability,
    actorId: actor.id,
    hospitalId,
    correlationId,
  };
}
