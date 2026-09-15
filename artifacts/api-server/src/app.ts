import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import { AccessError } from "./lib/auth";
import { DomainError } from "./lib/careflow-domain";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? `corr-${randomUUID()}`;
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  next();
});

app.use("/api", router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof AccessError || error instanceof DomainError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (typeof error === "object" && error && "issues" in error) {
    return res.status(400).json({ error: "Request validation failed.", details: (error as { issues: unknown }).issues });
  }
  logger.error({ err: error }, "Unhandled request error");
  return res.status(500).json({ error: "Internal server error." });
});

export default app;
