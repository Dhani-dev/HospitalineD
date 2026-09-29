import Fastify from "fastify";
import { ServiceContainer } from "./bootstrap/createServices";
import { queryMethodPlugin } from "./plugins/queryMethod";
import { doctorRoutes } from "./routes/doctorRoutes";
import { hospitalRoutes } from "./routes/hospitalRoutes";
import { pacienteRoutes } from "./routes/pacienteRoutes";
import { registerObservability } from "./observability";
import { metricsContentType, renderMetrics } from "./observability/metrics";
import { isOrchestratorConfigured } from "./integrations/orchestratorPlaceholder";

export function buildApp(services: ServiceContainer) {
  const app = Fastify({ logger: true });

  app.register(queryMethodPlugin);
  registerObservability(app);

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", metricsContentType);
    return renderMetrics();
  });

  app.get("/health", async () => {
    const cache = services.cache;
    const telemetry = {
      service: process.env.OTEL_SERVICE_NAME ?? "hospitaline-api",
      otlp: Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()) &&
        process.env.OTEL_SDK_DISABLED !== "true",
      orchestrator: isOrchestratorConfigured() ? "configured" : "placeholder"
    };

    if (!cache) {
      return { status: "ok", cache: { backend: "disabled" }, telemetry };
    }

    return {
      status: "ok",
      cache: {
        ...cache.stats(),
        connected: await cache.ping()
      },
      telemetry
    };
  });

  const apiPrefixes = ["/api/v1", "/api/v2"];

  for (const prefix of apiPrefixes) {
    const version = prefix.endsWith("v2") ? "v2" : "v1";
    app.register(hospitalRoutes(services, version), { prefix });
    app.register(doctorRoutes(services, version), { prefix });
    app.register(pacienteRoutes(services, version), { prefix });
  }

  return app;
}
