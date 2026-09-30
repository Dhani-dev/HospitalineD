import { startTelemetry } from "./observability/telemetry";

startTelemetry(process.env.OTEL_SERVICE_NAME ?? "hospitaline-api");

async function main(): Promise<void> {
  const { getEnvConfig } = await import("./config/env.js");
  const { createDefaultServices } = await import("./bootstrap/createServices.js");
  const { buildApp } = await import("./app.js");

  const { port } = getEnvConfig();
  const app = buildApp(createDefaultServices());

  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server listening on port ${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
