import type { FastifyInstance } from "fastify";
import { versionFields } from "./apiVersion";
import { appTrack, CURRENT_API } from "./release";

export const FAULT_HEADER = "x-fault-mode";

export function faultLatencyMs(): number {
  const value = Number(process.env.FAULT_LATENCY_MS);
  return Number.isFinite(value) && value > 0 ? value : 2500;
}

export function registerFaultInjection(app: FastifyInstance): void {
  if (appTrack() !== "canary") {
    return;
  }

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) {
      return;
    }

    const mode = request.headers[FAULT_HEADER];
    if (mode === "latency") {
      await new Promise((resolve) => setTimeout(resolve, faultLatencyMs()));
      return;
    }

    if (mode === "errors") {
      reply.status(500).send({
        api: "hospitaline",
        ...versionFields(CURRENT_API),
        message: "Injected fault"
      });
      return reply;
    }
  });
}
