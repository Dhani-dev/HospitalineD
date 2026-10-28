import { describe, expect, it } from "vitest";
import { EntityCache } from "../../src/cache/entityCache";
import { cacheKeys } from "../../src/cache/keys";
import { MemoryCacheClient } from "../../src/cache/memoryCacheClient";
import { capacityBand, presentHospital } from "../../src/http/hospitalContract";
import { Hospital } from "../../src/types/entities";

const hospital: Hospital = {
  id: "h1",
  name: "Central",
  address: "A",
  city: "Bogota",
  phone: "5551234",
  bed_capacity: 40,
  created_at: "2026-10-27T00:00:00.000Z",
  updated_at: "2026-10-27T00:00:00.000Z"
};

describe("expand/contract compatibility", () => {
  it("bands bed capacity, unknown when the column is still null", () => {
    expect(capacityBand(null)).toBe("unknown");
    expect(capacityBand(undefined)).toBe("unknown");
    expect(capacityBand(99)).toBe("small");
    expect(capacityBand(100)).toBe("medium");
    expect(capacityBand(500)).toBe("large");
  });

  it("keeps the v3 contract byte-for-byte while v4 adds fields", () => {
    const { bed_capacity, ...legacy } = hospital;

    expect(presentHospital(hospital, "v3")).toEqual(legacy);
    expect(presentHospital(hospital, "v4")).toEqual({
      ...legacy,
      bed_capacity,
      capacity_band: "small"
    });
  });

  it("reads rows written before the expand migration", () => {
    const { bed_capacity: _omitted, ...legacyRow } = hospital;

    expect(presentHospital(legacyRow, "v4")).toMatchObject({
      bed_capacity: null,
      capacity_band: "unknown"
    });
  });

  it("invalidates the v3 and v4 cache generations on write", async () => {
    const cache = new MemoryCacheClient();
    const entityCache = new EntityCache(cache, 60);
    const v3Key = cacheKeys.local("hospital", "h1", "hospitaline");
    const v4Key = cacheKeys.local("hospital", "h1");

    await cache.set(v3Key, hospital, 60);
    await cache.set(v4Key, hospital, 60);
    await entityCache.invalidateLocal("hospital", "h1");

    expect((await cache.get(v3Key)).hit).toBe(false);
    expect((await cache.get(v4Key)).hit).toBe(false);
    expect(v4Key).not.toBe(v3Key);
  });
});
