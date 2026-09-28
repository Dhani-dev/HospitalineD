import { describe, expect, it, vi } from "vitest";
import { CachedExternalEntitiesClient } from "../../src/integrations/cachedExternalEntitiesClient";
import { MemoryCacheClient } from "../../src/cache/memoryCacheClient";

describe("CachedExternalEntitiesClient", () => {
  it("caches live peer responses and skips a second HTTP call", async () => {
    const inner = {
      getLastBook: vi.fn().mockResolvedValue({
        live: true,
        entity: "books",
        data: { id: "b1" }
      }),
      getLastEntrenador: vi.fn().mockResolvedValue({
        live: true,
        entity: "entrenador",
        data: { id: "e1" }
      }),
      getPeers: vi.fn()
    };
    const client = new CachedExternalEntitiesClient(
      inner,
      new MemoryCacheClient(),
      60
    );

    const first = await client.getPeers("trace-1");
    const second = await client.getPeers("trace-2");

    expect(first).toEqual(second);
    expect(inner.getLastBook).toHaveBeenCalledTimes(1);
    expect(inner.getLastEntrenador).toHaveBeenCalledTimes(1);
  });

  it("does not cache offline peers so the next request retries", async () => {
    const inner = {
      getLastBook: vi
        .fn()
        .mockResolvedValueOnce({ live: false, entity: "books", data: null })
        .mockResolvedValueOnce({ live: true, entity: "books", data: { id: "b2" } }),
      getLastEntrenador: vi.fn().mockResolvedValue({
        live: false,
        entity: "entrenador",
        data: null
      }),
      getPeers: vi.fn()
    };
    const client = new CachedExternalEntitiesClient(
      inner,
      new MemoryCacheClient(),
      60
    );

    const first = await client.getLastBook("t1");
    const second = await client.getLastBook("t2");

    expect(first.live).toBe(false);
    expect(second).toEqual({ live: true, entity: "books", data: { id: "b2" } });
    expect(inner.getLastBook).toHaveBeenCalledTimes(2);
  });
});
