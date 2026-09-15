import { Router, type IRouter } from "express";
import {
  AccessError,
  actorFromRequest,
  createDemoSessionToken,
  demoActorForRole,
  demoEmailForRole,
  isKnownRole,
} from "../lib/auth";
import type { Role } from "../lib/careflow-state";

const router: IRouter = Router();

const DEMO_ROLES: Role[] = ["PATIENT", "DOCTOR", "HOSPITAL_ADMIN", "PLATFORM_ADMIN"];

/**
 * Lists the four fixed demo personas a visitor can sign in as. No secrets
 * here — these are intentionally public so the hero/login screens can
 * render "Continue as demo Patient / Doctor / Hospital Admin / Platform
 * Admin" without a separate lookup call.
 */
router.get("/auth/demo-accounts", (_req, res) => {
  res.json(
    DEMO_ROLES.map((role) => {
      const actor = demoActorForRole(role);
      return {
        role,
        displayName: actor.displayName,
        email: demoEmailForRole(role),
        hospitalId: actor.hospitalId,
      };
    }),
  );
});

/**
 * Issues a signed session token for one of the fixed demo personas.
 * This is intentionally not a real credential check — the whole point of
 * a "demo login" is that anyone can step into any of the four roles to see
 * the product from that seat. Real password-based accounts are future work
 * (see docs/KNOWN_LIMITATIONS.md).
 */
router.post("/auth/demo-login", (req, res) => {
  const role = typeof req.body?.role === "string" ? req.body.role.toUpperCase() : "";
  if (!isKnownRole(role)) {
    return res.status(400).json({ error: "Provide a valid role: PATIENT, DOCTOR, HOSPITAL_ADMIN, or PLATFORM_ADMIN." });
  }
  const actor = demoActorForRole(role);
  const token = createDemoSessionToken(actor);
  return res.json({ token, actor });
});

router.get("/auth/me", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    return res.json({ actor });
  } catch (error) {
    if (error instanceof AccessError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(401).json({ error: "Not authenticated." });
  }
});

export default router;
