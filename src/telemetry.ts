import { propagation } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

let started = false;

export function isTelemetryEnabled(): boolean {
  return (
    Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()) &&
    process.env.OTEL_SDK_DISABLED !== "true"
  );
}

export function startTelemetry(serviceName: string): void {
  if (started || !isTelemetryEnabled()) {
    return;
  }

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  started = true;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": serviceName,
      "service.namespace": "hospitaline",
      "cloud.provider": "gcp",
      "k8s.namespace.name": process.env.POD_NAMESPACE ?? "hospitaline-prod",
      "k8s.pod.name": process.env.POD_NAME ?? "local"
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15000
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false }
      })
    ]
  });

  sdk.start();
}
