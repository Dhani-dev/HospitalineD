import Fastify from "fastify";
import { ServiceContainer } from "./bootstrap/createServices";
import { queryMethodPlugin } from "./plugins/queryMethod";
import { doctorRoutes } from "./routes/doctorRoutes";
import { hospitalRoutes } from "./routes/hospitalRoutes";
import { pacienteRoutes } from "./routes/pacienteRoutes";
import { registerObservability } from "./observability";
import { metricsContentType, renderMetrics } from "./observability/metrics";
import { isOrchestratorConfigured } from "./integrations/orchestratorPlaceholder";
import { ApiVersion } from "./http/apiVersion";
import { registerFaultInjection } from "./http/faultInjection";
import { appTrack, appVersionHeader, APP_VERSION, CURRENT_API } from "./http/release";

export function buildApp(services: ServiceContainer) {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("X-App-Version", appVersionHeader());
  });

  app.register(queryMethodPlugin);
  registerObservability(app);
  registerFaultInjection(app);

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

    const release = { version: APP_VERSION, track: appTrack() };

    if (!cache) {
      return { status: "ok", ...release, cache: { backend: "disabled" }, telemetry };
    }

    return {
      status: "ok",
      ...release,
      cache: {
        ...cache.stats(),
        connected: await cache.ping()
      },
      telemetry
    };
  });

  const apiPrefixes: Array<{ prefix: string; version: ApiVersion }> = [
    { prefix: "/api/v1", version: "v1" },
    { prefix: "/api/v2", version: "v2" },
    { prefix: "/api/v3", version: "v3" },
    { prefix: "/api/v4", version: "v4" },
    { prefix: "/api/v5", version: "v5" },
    { prefix: "/api", version: CURRENT_API }
  ];

  for (const { prefix, version } of apiPrefixes) {
    const scoped = version === "v5" ? services.v5 ?? services : services;
    app.register(hospitalRoutes(scoped, version), { prefix });
    app.register(doctorRoutes(scoped, version), { prefix });
    app.register(pacienteRoutes(scoped, version), { prefix });
  }

  return app;
}
