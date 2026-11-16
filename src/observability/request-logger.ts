import { logs } from "@opentelemetry/api-logs";
import { trace } from "@opentelemetry/api";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { APP_VERSION, appTrack } from "../http/release";
import { dependencyFaultRequested } from "../chaos/requestContext";
import { recordFlowRequest, recordHttpRequest } from "./metrics";

export const httpLogger = logs.getLogger("hospitaline-api-gcp");

declare module "fastify" {
  interface FastifyRequest {
    otelStartNs?: bigint;
  }
}

function isV5Flow(request: FastifyRequest): boolean {
  if (request.method !== "GET") {
    return false;
  }
  const route = request.routeOptions?.url ?? "";
  return /\/api\/v5\/(hospitals|doctors|pacientes)\/:id$/.test(route);
}

function isObserved(url: string): boolean {
  return url.startsWith("/api/") && !url.startsWith("/api/v1/");
}

export function requestLogger(request: FastifyRequest, reply: FastifyReply): void {
  if (!isObserved(request.url)) {
    return;
  }

  const started = request.otelStartNs ?? process.hrtime.bigint();
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  const spanContext = trace.getActiveSpan()?.spanContext();
  const route = (request.routeOptions?.url ?? request.url.split("?")[0]).replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ":id"
  );
  const traceId = request.traceId ?? spanContext?.traceId;

  recordHttpRequest(request.method, route, reply.statusCode, durationMs / 1000);
  if (isV5Flow(request)) {
    recordFlowRequest(reply.statusCode, dependencyFaultRequested());
  }

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

  if (process.env.NODE_ENV !== "test") {
    console.log(
      JSON.stringify({
        severity: reply.statusCode >= 500 ? "ERROR" : "INFO",
        message: "HTTP request completed",
        method: request.method,
        path: request.url,
        route,
        status_code: reply.statusCode,
        duration_ms: durationMs,
        track: appTrack(),
        version: APP_VERSION,
        trace_id: traceId,
        span_id: spanContext?.spanId
      })
    );
  }
}

export function registerRequestLogger(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    if (isObserved(request.url)) {
      request.otelStartNs = process.hrtime.bigint();
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    requestLogger(request, reply);
  });
}
