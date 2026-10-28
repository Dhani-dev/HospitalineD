export type Track = "stable" | "canary";

export const APP_VERSION = "3.1.0";

export function appTrack(): Track {
  return process.env.APP_TRACK === "canary" ? "canary" : "stable";
}

export function appVersionHeader(): string {
  return `${APP_VERSION}; track=${appTrack()}`;
}
