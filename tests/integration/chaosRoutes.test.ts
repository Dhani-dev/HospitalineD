import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryCacheClient } from "../../src/cache/memoryCacheClient";
import { registerChaosRoutes } from "../../src/chaos/chaosRoutes";
import { DependencyFaultSwitch } from "../../src/chaos/dependencyFault";

describe("chaos routes", () => {
  const faults = new DependencyFaultSwitch(new MemoryCacheClient(), null);
  const app = Fastify();
  const headers = { "x-chaos-token": "secret-token" };

  beforeAll(async () => {
    registerChaosRoutes(app, faults, "secret-token");
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects calls without the token", async () => {
    const res = await app.inject({ method: "GET", url: "/chaos/dependency-5xx" });
    expect(res.statusCode).toBe(401);
  });

  it("enables the fault for a bounded duration and reports it", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/chaos/dependency-5xx",
      headers,
      payload: { target: "biblio-express", rate: 1, durationSeconds: 120 }
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).fault).toMatchObject({ status: 503, source: "api" });

    const current = await app.inject({ method: "GET", url: "/chaos/dependency-5xx", headers });
    expect(JSON.parse(current.payload).fault.target).toBe("biblio-express");
  });

  it("refuses durations beyond the blast-radius limit", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/chaos/dependency-5xx",
      headers,
      payload: { durationSeconds: 3600 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("reverts on DELETE", async () => {
    const res = await app.inject({ method: "DELETE", url: "/chaos/dependency-5xx", headers });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).fault).toBeNull();
  });

  it("stays unregistered without a token", async () => {
    const bare = Fastify();
    registerChaosRoutes(bare, faults, undefined);
    const res = await bare.inject({ method: "GET", url: "/chaos/dependency-5xx" });
    expect(res.statusCode).toBe(404);
    await bare.close();
  });
});
