import client from "prom-client";

export const registry = new client.Registry();

client.collectDefaultMetrics({
  register: registry,
  prefix: "hospitaline_"
});

const httpRequestsTotal = new client.Counter({
  name: "hospitaline_http_requests_total",
  help: "HTTP requests to api/v2 by method, route and status",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "hospitaline_http_request_duration_seconds",
  help: "HTTP latency for api/v2 endpoints (p50/p95 via histogram_quantile)",
  labelNames: ["method", "route"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
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

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number
): void {
  const labels = { method, route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe({ method, route }, durationSeconds);
}

export function recordCacheHit(backend: string): void {
  cacheHitsTotal.inc({ backend });
}

export function recordCacheMiss(backend: string): void {
  cacheMissesTotal.inc({ backend });
}

export function renderMetrics(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
