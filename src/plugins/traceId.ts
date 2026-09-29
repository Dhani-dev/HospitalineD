import { context, propagation, trace } from "@opentelemetry/api";
import { FastifyInstance } from "fastify";
import { parseTraceparent, resolveTraceId } from "../http/trace";

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
}

export { resolveTraceId };

export function registerTraceId(fastify: FastifyInstance): void {
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
