import { logs } from "@opentelemetry/api-logs";
import { metrics, trace, type Counter, type Histogram } from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";

const logger = logs.getLogger("hospitaline-api-gcp");

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

export function registerRequestLogger(app: FastifyInstance): void {
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

    if (!request.url.startsWith("/api/v2") || process.env.NODE_ENV === "test") {
      return;
    }

    const spanContext = trace.getActiveSpan()?.spanContext();

    logger.emit({
      severityText: status >= 500 ? "ERROR" : "INFO",
      body: "HTTP request completed",
      attributes: {
        method: request.method,
        path: request.url,
        status_code: status,
        duration_ms: durationMs,
        trace_id: request.traceId,
        otel_trace_id: spanContext?.traceId,
        span_id: spanContext?.spanId,
        cloud_provider: "gcp"
      }
    });
  });
}
