import { describe, expect, it, vi } from "vitest";
import { startTelemetry, isTelemetryEnabled } from "../../src/observability/telemetry";
import { resolveTraceId, tracedHeaders } from "../../src/observability/trace-context";
import { requestLogger, httpLogger } from "../../src/observability/request-logger";
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
});

describe("trace-context", () => {
  it("reuses x-trace-id and generates one when it is missing", () => {
    expect(resolveTraceId("corr-123")).toBe("corr-123");
    expect(resolveTraceId(undefined)).toEqual(expect.any(String));
  });

  it("sends the trace id header used by the three clouds", () => {
    expect(tracedHeaders("demo-trace")).toMatchObject({
      "x-trace-id": "demo-trace",
      Accept: "application/json"
    });
  });
});

describe("request-logger", () => {
  it("emits an OTel log only for /api/v2", () => {
    const emit = vi.spyOn(httpLogger, "emit");

    requestLogger(
      { url: "/health", method: "GET", otelStartNs: process.hrtime.bigint() } as any,
      { statusCode: 200 } as any
    );
    expect(emit).not.toHaveBeenCalled();

    requestLogger(
      { url: "/api/v2/hospitals/last", method: "GET", otelStartNs: process.hrtime.bigint() } as any,
      { statusCode: 200 } as any
    );

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "HTTP request completed",
        attributes: expect.objectContaining({
          method: "GET",
          path: "/api/v2/hospitals/last",
          status_code: 200
        })
      })
    );
    emit.mockRestore();
  });
});

describe("orchestrator placeholder", () => {
  it("stays empty until the URL is filled in", () => {
    delete process.env.ORCHESTRATOR_API_URL;
    expect(isOrchestratorConfigured()).toBe(false);
    expect(getOrchestratorPlaceholder().expectedSpanName).toBe("flujo.hospitaline");
  });
});
