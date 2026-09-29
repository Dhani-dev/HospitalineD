import { randomUUID } from "node:crypto";
import {
  context,
  metrics,
  propagation,
  trace,
  type Counter,
  type Histogram
} from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";

let duration: Histogram | undefined;
let requests: Counter | undefined;
let errors: Counter | undefined;

function instruments() {
  if (!duration || !requests || !errors) {
    const meter = metrics.getMeter("hospitaline");
    duration = meter.createHistogram("http.server.request.duration", { unit: "ms" });
    requests = meter.createCounter("http.server.requests");
    errors = meter.createCounter("http.server.errors");
  }

  return { duration, requests, errors };
}

export function parseTraceparent(
  headerValue: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!raw?.trim()) {
    return undefined;
  }

  const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(raw.trim());
  return match?.[1]?.toLowerCase();
}

export function resolveTraceId(
  headerValue: string | string[] | undefined,
  fallbackTraceId?: string
): string {
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  if (fallbackTraceId && fallbackTraceId !== "00000000000000000000000000000000") {
    return fallbackTraceId;
  }

  return randomUUID();
}

export function tracedHeaders(traceId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-trace-id": traceId
  };
  propagation.inject(context.active(), headers);
  return headers;
}

export function observeRequests(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions?.url ?? request.url;
    const status = reply.statusCode;
    const durationMs = reply.elapsedTime;
    const attrs = {
      "http.method": request.method,
      "http.route": route,
      "http.status_code": status
    };
    const series = instruments();
    series.duration.record(durationMs, attrs);
    series.requests.add(1, attrs);
    if (status >= 400) {
      series.errors.add(1, attrs);
    }

    if (process.env.NODE_ENV === "test") {
      return;
    }

    console.log(
      JSON.stringify({
        msg: "request",
        trace_id: request.traceId,
        otel_trace_id: trace.getActiveSpan()?.spanContext().traceId,
        method: request.method,
        route,
        status,
        duration_ms: Math.round(durationMs)
      })
    );
  });
}
