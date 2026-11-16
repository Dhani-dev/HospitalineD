import type { ApiVersion } from "./apiVersion";

export type Track = "stable" | "canary";

export const APP_VERSION = "5.0.2";

export const CURRENT_API: ApiVersion = "v5";

export function appTrack(): Track {
  return process.env.APP_TRACK === "canary" ? "canary" : "stable";
}

export function appVersionHeader(): string {
  return `${APP_VERSION}; track=${appTrack()}`;
}
