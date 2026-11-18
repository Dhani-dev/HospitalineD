import { describe, expect, it, vi } from "vitest";
import {
  HttpExternalEntitiesClient,
  pickLastRecord
} from "../../src/integrations/externalEntitiesClient";

describe("pickLastRecord", () => {
  it("keeps the peer trace ids when unwrapping a last envelope", () => {
    expect(
      pickLastRecord({
        api: "pokenetes",
        "x-trace_id": "0104c82f-e32f-4023-aa54-39a510a42579",
        "trace-id": "43f9e3dc25f1ebd17a890839d5ea9115",
        "span-id": "232e95fd8eeaf375",
        local: { id: "1", nombre: "Ash" }
      })
    ).toEqual({
      id: "1",
      nombre: "Ash",
      "x-trace_id": "0104c82f-e32f-4023-aa54-39a510a42579",
      "trace-id": "43f9e3dc25f1ebd17a890839d5ea9115",
      "span-id": "232e95fd8eeaf375"
    });
  });

  it("takes the last item from a list", () => {
    expect(pickLastRecord([{ id: 1 }, { id: 2 }])).toEqual({ id: 2 });
  });

  it("keeps biblio trace ids when the users arrive in data", () => {
    expect(
      pickLastRecord({
        apiVersion: "5.0.0",
        data: [
          { id: 4, name: "Usuario Sintetico 4" },
          { id: 5, name: "Usuario Sintetico 5" }
        ],
        "x-trace-id": "gd-why-biblio-trace",
        "trace-id": "cd49a378cd20b5e48a1ceba0f3c3e40c",
        "span-id": "648b0488818583a4"
      })
    ).toEqual({
      id: 5,
      name: "Usuario Sintetico 5",
      "x-trace_id": "gd-why-biblio-trace",
      "trace-id": "cd49a378cd20b5e48a1ceba0f3c3e40c",
      "span-id": "648b0488818583a4"
    });
  });
});

describe("HttpExternalEntitiesClient", () => {
  it("propagates x-trace-id and uses last before the list fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        local: { id: "e1", nombre: "Ash" },
        "x-trace_id": "trace-abc",
        "trace-id": "43f9e3dc25f1ebd17a890839d5ea9115",
        "span-id": "232e95fd8eeaf375"
      })
    });
    const client = new HttpExternalEntitiesClient(
      { baseUrl: "", lastPath: "/api/v2/users/last", listPath: "/api/users" },
      {
        baseUrl: "https://pokenetes.example.com",
        lastPath: "/api/v2/entrenador/last",
        listPath: "/entrenador"
      },
      fetcher
    );

    const peers = await client.getPeers("trace-abc");

    expect(peers["biblio-express"]).toEqual({
      live: false,
      entity: "users",
      data: null
    });
    expect(peers.pokenetes).toEqual({
      live: true,
      entity: "entrenador",
      data: {
        id: "e1",
        nombre: "Ash",
        "x-trace_id": "trace-abc",
        "trace-id": "43f9e3dc25f1ebd17a890839d5ea9115",
        "span-id": "232e95fd8eeaf375"
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://pokenetes.example.com/api/v2/entrenador/last",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-trace-id": "trace-abc" })
      })
    );
  });

  it("falls back to the list endpoint when last is missing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "missing" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "u1" }, { id: "u2", name: "Ada" }]
      });
    const client = new HttpExternalEntitiesClient(
      { baseUrl: "https://biblio.example.com", lastPath: "/api/v2/users/last", listPath: "/api/users" },
      { baseUrl: "", lastPath: "/api/v2/entrenador/last", listPath: "/entrenador" },
      fetcher
    );

    const user = await client.getLastUser("trace-1");

    expect(user).toEqual({
      live: true,
      entity: "users",
      data: { id: "u2", name: "Ada" }
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://biblio.example.com/api/users",
      expect.anything()
    );
  });

  it("marks the peer offline when the remote call fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const client = new HttpExternalEntitiesClient(
      { baseUrl: "https://biblio.example.com", lastPath: "/api/v2/users/last", listPath: "/api/users" },
      { baseUrl: "https://pokenetes.example.com", lastPath: "/last", listPath: "/list" },
      fetcher
    );

    const peers = await client.getPeers("trace-1");

    expect(peers["biblio-express"].live).toBe(false);
    expect(peers.pokenetes.live).toBe(false);
    expect(peers["biblio-express"].data).toBeNull();
  });
});
