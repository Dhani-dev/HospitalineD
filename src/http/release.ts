import type { ApiVersion } from "./apiVersion";

export type Track = "stable" | "canary";

export const APP_VERSION = "4.0.0";

export const CURRENT_API: ApiVersion = "v4";

export function appTrack(): Track {
  return process.env.APP_TRACK === "canary" ? "canary" : "stable";
}

export function appVersionHeader(): string {
  return `${APP_VERSION}; track=${appTrack()}`;
}
