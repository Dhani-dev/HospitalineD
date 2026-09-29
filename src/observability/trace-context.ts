import { randomUUID } from "node:crypto";
import { context, propagation, trace } from "@opentelemetry/api";
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
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

export function registerTraceContext(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request, reply) => {
    const extracted = propagation.extract(context.active(), request.headers);
    const otelTraceId =
      parseTraceparent(request.headers.traceparent) ??
      trace.getSpan(extracted)?.spanContext().traceId;
    const traceId = resolveTraceId(request.headers["x-trace-id"], otelTraceId);

    request.traceId = traceId;
    request.log = request.log.child({ traceId });
    reply.header("x-trace-id", traceId);

    const outgoing: Record<string, string> = {};
    propagation.inject(extracted, outgoing);
    if (outgoing.traceparent) {
      reply.header("traceparent", outgoing.traceparent);
    }
    if (outgoing.tracestate) {
      reply.header("tracestate", outgoing.tracestate);
    }
  });
}
