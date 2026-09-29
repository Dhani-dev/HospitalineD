import type { FastifyInstance } from "fastify";
import { registerRequestLogger } from "./request-logger";
import { registerTraceContext } from "./trace-context";

export { requestLogger, registerRequestLogger } from "./request-logger";
export {
  registerTraceContext,
  resolveTraceId,
  traceContext,
  tracedHeaders
} from "./trace-context";

export function registerObservability(app: FastifyInstance): void {
  registerTraceContext(app);
  registerRequestLogger(app);
}
