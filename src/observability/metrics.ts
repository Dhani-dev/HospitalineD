import { metrics } from "@opentelemetry/api";
import client from "prom-client";
import { APP_VERSION, appTrack } from "../http/release";

export const registry = new client.Registry();

client.collectDefaultMetrics({
  register: registry,
  prefix: "hospitaline_"
});

const httpRequestsTotal = new client.Counter({
  name: "hospitaline_http_requests_total",
  help: "HTTP requests to api/v2+ by method, route, status and release track",
  labelNames: ["method", "route", "status", "track", "version"] as const,
  registers: [registry]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "hospitaline_http_request_duration_seconds",
  help: "HTTP latency for api/v2+ (p50/p95/p99 via histogram_quantile)",
  labelNames: ["method", "route", "track", "version"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.8, 1, 2, 5],
  registers: [registry]
});

const hospitalsRegisteredTotal = new client.Counter({
  name: "hospitaline_hospitals_registered_total",
  help: "Business metric: hospitals created, by release track and bed capacity presence",
  labelNames: ["track", "version", "with_capacity"] as const,
  registers: [registry]
});

const cacheHitsTotal = new client.Counter({
  name: "hospitaline_cache_hits_total",
  help: "Cache hits for local entities and peer last records",
  labelNames: ["backend"] as const,
  registers: [registry]
});

const cacheMissesTotal = new client.Counter({
  name: "hospitaline_cache_misses_total",
  help: "Cache misses for local entities and peer last records",
  labelNames: ["backend"] as const,
  registers: [registry]
});

const dashboardCacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Cache hits labeled for the unified Grafana dashboard",
  labelNames: ["service_name"] as const,
  registers: [registry]
});

const dashboardCacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Cache misses labeled for the unified Grafana dashboard",
  labelNames: ["service_name"] as const,
  registers: [registry]
});

const chaosInjectedFaultsTotal = new client.Counter({
  name: "hospitaline_chaos_injected_faults_total",
  help: "Outbound peer calls answered by the chaos switch instead of the real peer",
  labelNames: ["fault", "peer", "status"] as const,
  registers: [registry]
});

const SERVICE_NAME = "hospitaline-api";

export function recordInjectedFault(peer: string, status: number): void {
  chaosInjectedFaultsTotal.inc({ fault: "dependency-5xx", peer, status: String(status) });
}

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number
): void {
  const release = releaseLabels();
  httpRequestsTotal.inc({ method, route, status: String(status), ...release });
  httpRequestDurationSeconds.observe({ method, route, ...release }, durationSeconds);
}

export function recordHospitalRegistered(withCapacity: boolean): void {
  const release = releaseLabels();
  hospitalsRegisteredTotal.inc({ ...release, with_capacity: String(withCapacity) });

  if (process.env.NODE_ENV !== "test") {
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "hospital registered",
        event: "hospital_registered",
        with_capacity: withCapacity,
        ...release
      })
    );
  }
}

function releaseLabels() {
  return { track: appTrack(), version: APP_VERSION };
}

function otelCacheCounter(name: "hits" | "misses") {
  return metrics.getMeter("hospitaline").createCounter(`cache.${name}`, {
    description: name === "hits" ? "Cache hits" : "Cache misses"
  });
}

let otelHits: ReturnType<typeof otelCacheCounter> | undefined;
let otelMisses: ReturnType<typeof otelCacheCounter> | undefined;

export function recordCacheHit(backend: string): void {
  cacheHitsTotal.inc({ backend });
  dashboardCacheHits.inc({ service_name: SERVICE_NAME });
  (otelHits ??= otelCacheCounter("hits")).add(1, { service_name: SERVICE_NAME, backend });
}

export function recordCacheMiss(backend: string): void {
  cacheMissesTotal.inc({ backend });
  dashboardCacheMisses.inc({ service_name: SERVICE_NAME });
  (otelMisses ??= otelCacheCounter("misses")).add(1, { service_name: SERVICE_NAME, backend });
}

export function renderMetrics(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
