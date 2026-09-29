import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { propagation } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";

let started = false;

export function isTelemetryEnabled(): boolean {
  return (
    Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()) &&
    process.env.OTEL_SDK_DISABLED !== "true"
  );
}

export function startTelemetry(serviceName = "hospitaline-api"): void {
  if (started || !isTelemetryEnabled()) {
    return;
  }

  started = true;
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": serviceName,
      "service.namespace": "hospitaline",
      "cloud.provider": "gcp"
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter()
    }),
    logRecordProcessor: new SimpleLogRecordProcessor({
      exporter: new OTLPLogExporter()
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          enabled: true,
          applyCustomAttributesOnSpan: (span, request) => {
            const route =
              "url" in request && typeof request.url === "string"
                ? request.url.split("?")[0]
                : "path" in request && typeof request.path === "string"
                  ? request.path
                  : undefined;

            if (route) {
              span.setAttribute("http.route", route);
              span.updateName(`${request.method ?? "HTTP"} ${route}`);
            }
          }
        },
        "@opentelemetry/instrumentation-undici": { enabled: true }
      })
    ]
  });

  sdk.start();
  console.log("OpenTelemetry initialized");
}
