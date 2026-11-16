import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { handleControllerError } from "../controllers/baseController";
import { DependencyFaultSwitch } from "./dependencyFault";

export const CHAOS_TOKEN_HEADER = "x-chaos-token";
export const MAX_FAULT_SECONDS = 900;

const faultRequestSchema = z.object({
  target: z.enum(["biblio-express", "pokenetes", "all"]).default("biblio-express"),
  rate: z.number().min(0).max(1).default(1),
  durationSeconds: z.number().int().min(1).max(MAX_FAULT_SECONDS)
});

function sameToken(received: unknown, expected: string): boolean {
  if (typeof received !== "string") {
    return false;
  }
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function logWindow(event: "chaos_fault_enabled" | "chaos_fault_disabled", detail: object): void {
  if (process.env.NODE_ENV !== "test") {
    console.log(JSON.stringify({ severity: "WARNING", event, ...detail }));
  }
}

export function registerChaosRoutes(
  app: FastifyInstance,
  faults: DependencyFaultSwitch | undefined,
  token: string | undefined = process.env.CHAOS_TOKEN?.trim()
): void {
  if (!faults || !token) {
    return;
  }

  app.register(
    async (scope) => {
      scope.addHook("onRequest", async (request, reply) => {
        if (!sameToken(request.headers[CHAOS_TOKEN_HEADER], token)) {
          reply.status(401).send({ message: "Invalid chaos token" });
          return reply;
        }
      });

      scope.get("/dependency-5xx", async () => ({ fault: await faults.current() }));

      scope.put("/dependency-5xx", async (request, reply) => {
        try {
          const fault = await faults.enable(faultRequestSchema.parse(request.body ?? {}));
          logWindow("chaos_fault_enabled", fault);
          return reply.status(200).send({ fault });
        } catch (error) {
          return handleControllerError(error, reply);
        }
      });

      scope.delete("/dependency-5xx", async () => {
        await faults.disable();
        logWindow("chaos_fault_disabled", { fault: "dependency-5xx" });
        return { fault: await faults.current() };
      });
    },
    { prefix: "/chaos" }
  );
}
