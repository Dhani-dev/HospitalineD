import { logs } from "@opentelemetry/api-logs";
import { trace } from "@opentelemetry/api";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export const httpLogger = logs.getLogger("hospitaline-api-gcp");

declare module "fastify" {
  interface FastifyRequest {
    otelStartNs?: bigint;
  }
}

export function requestLogger(request: FastifyRequest, reply: FastifyReply): void {
  if (!request.url.startsWith("/api/v2")) {
    return;
  }

  const started = request.otelStartNs ?? process.hrtime.bigint();
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  const spanContext = trace.getActiveSpan()?.spanContext();

  httpLogger.emit({
    severityText: reply.statusCode >= 500 ? "ERROR" : "INFO",
    body: "HTTP request completed",
    attributes: {
      method: request.method,
      path: request.url,
      status_code: reply.statusCode,
      duration_ms: durationMs,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId
    }
  });
}

export function registerRequestLogger(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    if (request.url.startsWith("/api/v2")) {
      request.otelStartNs = process.hrtime.bigint();
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    requestLogger(request, reply);
  });
}
