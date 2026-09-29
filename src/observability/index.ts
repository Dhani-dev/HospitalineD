import type { FastifyInstance } from "fastify";
import { registerRequestLogger } from "./request-logger";
import { registerTraceContext } from "./trace-context";

export {
  parseTraceparent,
  registerTraceContext,
  resolveTraceId,
  tracedHeaders
} from "./trace-context";
export { registerRequestLogger } from "./request-logger";

export function registerObservability(app: FastifyInstance): void {
  registerTraceContext(app);
  registerRequestLogger(app);
}
