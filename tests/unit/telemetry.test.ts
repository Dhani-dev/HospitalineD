import { describe, expect, it } from "vitest";
import { startTelemetry, isTelemetryEnabled } from "../../src/observability/telemetry";
import {
  parseTraceparent,
  resolveTraceId,
  tracedHeaders
} from "../../src/observability";
import {
  getOrchestratorPlaceholder,
  isOrchestratorConfigured
} from "../../src/integrations/orchestratorPlaceholder";

describe("telemetry", () => {
  it("does not start the SDK when the OTLP endpoint is missing", () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(isTelemetryEnabled()).toBe(false);
    expect(() => startTelemetry("hospitaline-api")).not.toThrow();
  });

  it("sends the trace id header used by the three clouds", () => {
    expect(tracedHeaders("demo-trace")).toMatchObject({
      "x-trace-id": "demo-trace",
      Accept: "application/json"
    });
  });

  it("reads the W3C trace id from traceparent", () => {
    expect(
      parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
    ).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("prefers x-trace-id and falls back to the otel trace id", () => {
    expect(resolveTraceId("corr-123", "4bf92f3577b34da6a3ce929d0e0e4736")).toBe("corr-123");
    expect(resolveTraceId(undefined, "4bf92f3577b34da6a3ce929d0e0e4736")).toBe(
      "4bf92f3577b34da6a3ce929d0e0e4736"
    );
  });

  it("leaves the orchestrator unconfigured until its URL is filled in", () => {
    delete process.env.ORCHESTRATOR_API_URL;
    expect(isOrchestratorConfigured()).toBe(false);
    expect(getOrchestratorPlaceholder().expectedSpanName).toBe("flujo.hospitaline");
  });
});
