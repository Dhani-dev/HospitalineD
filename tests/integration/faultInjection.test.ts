import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import { ServiceContainer } from "../../src/bootstrap/createServices";
import { APP_VERSION } from "../../src/http/release";

function makeServices(): ServiceContainer {
  return {
    hospitalService: {
      getLast: async () => null
    } as unknown as ServiceContainer["hospitalService"],
    doctorService: {} as ServiceContainer["doctorService"],
    pacienteService: {} as ServiceContainer["pacienteService"]
  };
}

async function appFor(track: "stable" | "canary") {
  process.env.APP_TRACK = track;
  const app = buildApp(makeServices());
  await app.ready();
  return app;
}

describe("fault injection", () => {
  afterEach(() => {
    delete process.env.APP_TRACK;
    delete process.env.FAULT_LATENCY_MS;
  });

  it("returns 500 on the canary when x-fault-mode is errors", async () => {
    const app = await appFor("canary");
    const res = await app.inject({
      method: "GET",
      url: "/api/v4/hospitals/last",
      headers: { "x-fault-mode": "errors" }
    });

    expect(res.statusCode).toBe(500);
    expect(res.headers["x-app-version"]).toBe(`${APP_VERSION}; track=canary`);
    expect(JSON.parse(res.payload)).toMatchObject({ track: "canary", message: "Injected fault" });
    await app.close();
  });

  it("delays the canary when x-fault-mode is latency", async () => {
    process.env.FAULT_LATENCY_MS = "50";
    const app = await appFor("canary");
    const started = Date.now();
    const res = await app.inject({
      method: "GET",
      url: "/api/hospitals/last",
      headers: { "x-fault-mode": "latency" }
    });

    expect(res.statusCode).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
    await app.close();
  });

  it("is ignored by the stable track", async () => {
    const app = await appFor("stable");
    const res = await app.inject({
      method: "GET",
      url: "/api/v3/hospitals/last",
      headers: { "x-fault-mode": "errors" }
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).track).toBe("stable");
    await app.close();
  });

  it("never touches routes outside /api", async () => {
    const app = await appFor("canary");
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-fault-mode": "errors" }
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toMatchObject({ version: APP_VERSION, track: "canary" });
    await app.close();
  });
});
