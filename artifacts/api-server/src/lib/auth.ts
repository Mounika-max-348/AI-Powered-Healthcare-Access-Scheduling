import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { hospitals, type Role } from "./careflow-state";

export type Actor = {
  id: string;
  role: Role;
  hospitalId: string | null;
  displayName: string;
};

export class AccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 = 403,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

const roles = new Set<Role>([
  "PLATFORM_ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "PATIENT",
]);

const sessionSecret = () =>
  process.env["SESSION_SECRET"] ?? "careflow-local-development-secret";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createDemoSessionToken(actor: Actor) {
  const payload = encode({
    id: actor.id,
    role: actor.role,
    hospitalId: actor.hospitalId,
    displayName: actor.displayName,
  });
  return `${payload}.${signature(payload)}`;
}

function actorFromSignedToken(token: string): Actor | null {
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;
  const expected = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const actual = Buffer.from(expected);
  if (supplied.length !== actual.length || !timingSafeEqual(supplied, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Actor;
    if (!roles.has(parsed.role) || (parsed.hospitalId && !hospitals.some((hospital) => hospital.id === parsed.hospitalId))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function header(request: Request, name: string) {
  const value = request.header(name);
  return value?.trim() || undefined;
}

const demoDefaults: Record<Role, { id: string; displayName: string; email: string }> = {
  PATIENT: { id: "patient-maya", displayName: "Maya Nair", email: "patient@careflow.demo" },
  DOCTOR: { id: "doctor-rao", displayName: "Dr. Anika Rao", email: "doctor@careflow.demo" },
  HOSPITAL_ADMIN: { id: "admin-northstar", displayName: "Nisha Kulkarni", email: "hospitaladmin@careflow.demo" },
  PLATFORM_ADMIN: { id: "platform-aarav", displayName: "Aarav Shah", email: "platformadmin@careflow.demo" },
};

export function isKnownRole(value: string): value is Role {
  return roles.has(value as Role);
}

/**
 * Builds the fixed demo persona for a role. Used both by the header-based
 * dev fallback below and by the /api/auth/demo-login capability, so both
 * paths always agree on who "Dr. Anika Rao" (etc.) is.
 */
export function demoActorForRole(role: Role): Actor {
  const fallback = demoDefaults[role];
  return {
    id: fallback.id,
    role,
    hospitalId: role === "PLATFORM_ADMIN" ? null : "hospital-a",
    displayName: fallback.displayName,
  };
}

export function demoEmailForRole(role: Role): string {
  return demoDefaults[role].email;
}

export function actorFromRequest(request: Request): Actor {
  const bearer = header(request, "authorization")?.replace(/^Bearer\s+/i, "");
  const signedActor = bearer ? actorFromSignedToken(bearer) : null;
  if (signedActor) return signedActor;
  if (bearer) throw new AccessError("The authenticated session is invalid.", 401);
  if (process.env["NODE_ENV"] === "production") {
    throw new AccessError("A signed authenticated session is required.", 401);
  }

  const roleValue = header(request, "x-careflow-role") ?? "PATIENT";
  if (!roles.has(roleValue as Role)) {
    throw new AccessError("A valid CareFlow role is required.", 401);
  }

  const role = roleValue as Role;
  const hospitalId =
    header(request, "x-careflow-hospital-id") ??
    (role === "PLATFORM_ADMIN" ? null : "hospital-a");
  if (hospitalId && !hospitals.some((hospital) => hospital.id === hospitalId)) {
    throw new AccessError("The requested hospital is not available.", 403);
  }

  const fallback = demoDefaults[role];
  return {
    id: header(request, "x-careflow-user-id") ?? fallback.id,
    role,
    hospitalId,
    displayName: header(request, "x-careflow-user-name") ?? fallback.displayName,
  };
}

export function requireHospitalAccess(actor: Actor, hospitalId: string) {
  if (actor.role === "PLATFORM_ADMIN" || actor.hospitalId === hospitalId) return;
  throw new AccessError("You are not authorized to access this hospital.", 403);
}

export function requireRole(actor: Actor, ...allowed: Role[]) {
  if (allowed.includes(actor.role)) return;
  throw new AccessError("This action is not permitted for your role.", 403);
}

export function canReadHospitalDirectory(actor: Actor) {
  return actor.role === "PATIENT" || actor.role === "PLATFORM_ADMIN";
}

export function canReadAppointment(actor: Actor, hospitalId: string, patientName: string) {
  if (actor.role === "PLATFORM_ADMIN") return true;
  if (actor.role === "PATIENT") return actor.displayName === patientName;
  return actor.hospitalId === hospitalId;
}

export function accessErrorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  if (error instanceof AccessError) {
    return response.status(error.statusCode).json({ error: error.message });
  }
  return next(error);
}