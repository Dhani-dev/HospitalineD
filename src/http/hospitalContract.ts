import { Hospital } from "../types/entities";
import { ApiVersion } from "./apiVersion";

export type CapacityBand = "unknown" | "small" | "medium" | "large";

export function capacityBand(beds: number | null | undefined): CapacityBand {
  if (beds === null || beds === undefined) return "unknown";
  if (beds < 100) return "small";
  if (beds < 500) return "medium";
  return "large";
}

export function presentHospital(hospital: Hospital, version: ApiVersion) {
  const { bed_capacity, ...legacy } = hospital;
  if (version !== "v4") {
    return legacy;
  }
  return {
    ...legacy,
    bed_capacity: bed_capacity ?? null,
    capacity_band: capacityBand(bed_capacity)
  };
}
