import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import { ServiceContainer } from "../../src/bootstrap/createServices";
import { MemoryCacheClient } from "../../src/cache/memoryCacheClient";

describe("metrics service", () => {
  const cache = new MemoryCacheClient();
  const app = buildApp({
    hospitalService: {
      list: async () => [],
      getById: async () => null,
      getLast: async () => ({
        id: "11111111-1111-1111-1111-111111111111",
        name: "Central",
        address: "A",
        city: "Bogota",
        phone: "5551234",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
      getByIdV2: async () => null,
      create: async () => null as never,
      replace: async () => null,
      patch: async () => null,
      remove: async () => false,
      query: async () => ({ data: [], page: 1, pageSize: 20, total: 0 })
    } as ServiceContainer["hospitalService"],
    doctorService: {} as ServiceContainer["doctorService"],
    pacienteService: {} as ServiceContainer["pacienteService"],
    cache
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes Prometheus metrics for the Grafana teammate to scrape", async () => {
    await cache.set("k", 1, 60);
    await cache.get("k");

    await app.inject({ method: "GET", url: "/api/v2/hospitals/last" });
    const res = await app.inject({ method: "GET", url: "/metrics" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.payload).toContain("hospitaline_http_requests_total");
    expect(res.payload).toContain("hospitaline_http_request_duration_seconds");
    expect(res.payload).toMatch(/hospitaline_http_requests_total\{[^}]*track="stable"/);
    expect(res.payload).toContain("hospitaline_cache_hits_total");
    expect(res.payload).toContain('cache_hits_total{service_name="hospitaline-api"}');
  });
});
