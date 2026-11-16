import { describe, expect, it, vi } from "vitest";
import { MemoryCacheClient } from "../../src/cache/memoryCacheClient";
import { chaosFetch, peerForUrl } from "../../src/chaos/chaosFetch";
import { DependencyFaultSwitch, faultFromEnv, parseRate } from "../../src/chaos/dependencyFault";

const peers = { "biblio-express": "http://azure.test", pokenetes: "http://aws.test" };

describe("dependency 5xx switch", () => {
  it("is off unless the env var or the API turns it on", async () => {
    expect(faultFromEnv({})).toBeNull();
    expect(faultFromEnv({ CHAOS_DEPENDENCY_5XX: "off" })).toBeNull();
    expect(await new DependencyFaultSwitch(new MemoryCacheClient(), null).current()).toBeNull();
  });

  it("reads target and rate from the environment", () => {
    expect(faultFromEnv({ CHAOS_DEPENDENCY_5XX: "pokenetes", CHAOS_DEPENDENCY_5XX_RATE: "0.5" }))
      .toMatchObject({ target: "pokenetes", rate: 0.5, status: 503, source: "env" });
    expect(parseRate("7")).toBe(1);
    expect(parseRate("nope")).toBe(1);
  });

  it("expires on its own after the requested duration", async () => {
    let now = 0;
    const store = new MemoryCacheClient();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const faults = new DependencyFaultSwitch(store, null, () => now);

    await faults.enable({ target: "biblio-express", rate: 1, durationSeconds: 60 });
    expect(await faults.current()).toMatchObject({ target: "biblio-express", source: "api" });

    now = 61_000;
    expect(await faults.current()).toBeNull();
    vi.restoreAllMocks();
  });

  it("turns off immediately on disable", async () => {
    const faults = new DependencyFaultSwitch(new MemoryCacheClient(), null);
    await faults.enable({ target: "all", rate: 1, durationSeconds: 60 });
    await faults.disable();
    expect(await faults.current()).toBeNull();
  });
});

describe("chaosFetch", () => {
  it("maps a URL to the peer that owns it", () => {
    expect(peerForUrl("http://azure.test/api/v2/users/last", peers)).toBe("biblio-express");
    expect(peerForUrl("http://other.test/x", peers)).toBeNull();
    expect(peerForUrl("http://x", { "biblio-express": "", pokenetes: "" })).toBeNull();
  });

  it("answers 503 for the targeted peer and lets the others through", async () => {
    const base = vi.fn(async () => new Response("{}", { status: 200 }));
    const faults = new DependencyFaultSwitch(undefined, {
      fault: "dependency-5xx", target: "biblio-express", rate: 1, status: 503, source: "env"
    });
    const fetcher = chaosFetch(base, faults, peers);

    expect((await fetcher("http://azure.test/api/v2/users/last")).status).toBe(503);
    expect((await fetcher("http://aws.test/api/v2/entrenador/last")).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("injects only the configured share of calls", async () => {
    const base = vi.fn(async () => new Response("{}", { status: 200 }));
    const faults = new DependencyFaultSwitch(undefined, {
      fault: "dependency-5xx", target: "all", rate: 0.5, status: 503, source: "env"
    });
    const rolls = [0.2, 0.8];
    const fetcher = chaosFetch(base, faults, peers, () => rolls.shift()!);

    expect((await fetcher("http://aws.test/a")).status).toBe(503);
    expect((await fetcher("http://aws.test/a")).status).toBe(200);
  });
});
