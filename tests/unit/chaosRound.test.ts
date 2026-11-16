import { afterEach, describe, expect, it, vi } from "vitest";
import { peerBreaker } from "../../src/chaos/circuitBreaker";
import { chaosFetch } from "../../src/chaos/chaosFetch";
import { DependencyCascadeError } from "../../src/chaos/dependencyCascade";
import { DependencyFaultSwitch } from "../../src/chaos/dependencyFault";
import {
  degradedPeer,
  enterChaosHeaders,
  resilienceEnabled
} from "../../src/chaos/requestContext";
import { handleControllerError } from "../../src/controllers/baseController";
import { HttpExternalEntitiesClient } from "../../src/integrations/externalEntitiesClient";

const peers = { "biblio-express": "http://azure.test", pokenetes: "http://aws.test" };
const target = { baseUrl: "http://azure.test", lastPath: "/api/v5/users", listPath: "/api/v5/users" };
const other = { baseUrl: "http://aws.test", lastPath: "/last", listPath: "/list" };

function injected503(): Response {
  return new Response("{}", { status: 503, headers: { "x-chaos-injected": "true" } });
}

afterEach(() => {
  enterChaosHeaders({});
  peerBreaker.reset();
});

describe("header fault for the k6 window", () => {
  it("answers 503 only for biblio-express while the fault header is set", async () => {
    enterChaosHeaders({ "x-fault-mode": "dependency-down" });
    const base = vi.fn(async () => new Response("{}", { status: 200 }));
    const fetcher = chaosFetch(base, new DependencyFaultSwitch(), peers);

    const failed = await fetcher("http://azure.test/api/v5/users");
    const passed = await fetcher("http://aws.test/last");

    expect(failed.status).toBe(503);
    expect(failed.headers.get("x-chaos-injected")).toBe("true");
    expect(passed.status).toBe(200);
  });

  it("cascades the injected 503 when resilience is off", async () => {
    enterChaosHeaders({ "x-fault-mode": "dependency-down" });
    const client = new HttpExternalEntitiesClient(target, other, async () => injected503());

    await expect(client.getLastUser("trace")).rejects.toBeInstanceOf(DependencyCascadeError);
  });

  it("degrades the peer and opens the circuit when resilience is on", async () => {
    enterChaosHeaders({ "x-fault-mode": "dependency-down", "x-peer-resilience": "true" });
    const fetcher = vi.fn(async () => injected503());
    const client = new HttpExternalEntitiesClient(target, other, fetcher);

    for (let i = 0; i < 5; i += 1) {
      const peer = await client.getLastUser("trace");
      expect(peer.live).toBe(false);
    }
    expect(degradedPeer()).toBe("biblio-express");
    expect(resilienceEnabled()).toBe(true);

    fetcher.mockClear();
    expect((await client.getLastUser("trace")).live).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps a real 503 as an offline peer", async () => {
    const client = new HttpExternalEntitiesClient(target, other, async () => new Response("", { status: 503 }));
    expect((await client.getLastUser("trace")).live).toBe(false);
  });

  it("maps the cascade to HTTP 503", () => {
    const reply = { statusCode: 0, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, send(body: unknown) { this.body = body; return this; } };
    handleControllerError(new DependencyCascadeError("biblio-express"), reply as never);
    expect(reply.statusCode).toBe(503);
  });
});
