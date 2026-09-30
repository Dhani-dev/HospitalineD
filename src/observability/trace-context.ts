import { randomUUID } from "node:crypto";
import { context, propagation, trace } from "@opentelemetry/api";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
}

function incomingHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ? raw.trim() : undefined;
}

export function resolveTraceId(headerValue: string | string[] | undefined): string {
  return incomingHeader(headerValue) ?? randomUUID();
}

export function traceIdentifiers(xTraceId: string): {
  trace_id: string;
  "x-trace_id": string;
  "trace-id": string | null;
  "span-id": string | null;
} {
  const spanContext = trace.getActiveSpan()?.spanContext();
  const grafanaTraceId = spanContext?.traceId;
  const recorded =
    Boolean(grafanaTraceId) && !/^0+$/.test(grafanaTraceId ?? "");

  return {
    trace_id: xTraceId,
    "x-trace_id": xTraceId,
    "trace-id": recorded ? grafanaTraceId! : null,
    "span-id": recorded ? (spanContext?.spanId ?? null) : null
  };
}

export function tracedHeaders(traceId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-trace-id": traceId
  };
  propagation.inject(context.active(), headers);
  return headers;
}

export function traceContext(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const traceId = resolveTraceId(request.headers["x-trace-id"]);
  request.traceId = traceId;
  request.log = request.log.child({ traceId });
  reply.header("x-trace-id", traceId);

  const ids = traceIdentifiers(traceId);
  if (ids["trace-id"]) {
    reply.header("trace-id", ids["trace-id"]);
  }
  if (ids["span-id"]) {
    reply.header("span-id", ids["span-id"]);
  }

  const traceparent = incomingHeader(request.headers.traceparent);
  if (traceparent) {
    reply.header("traceparent", traceparent);
  }
}

export function registerTraceContext(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request, reply) => {
    traceContext(request, reply);
  });
}
