import { randomUUID } from "node:crypto";
import { context, propagation } from "@opentelemetry/api";
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
