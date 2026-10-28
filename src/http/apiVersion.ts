import { APP_VERSION, appTrack, Track } from "./release";

export type ApiVersion = "v1" | "v2" | "v3";

export type VersionFields =
  | { version: "2.0.0" }
  | { version: string; track: Track };

export function versionFields(version: ApiVersion): VersionFields {
  return version === "v1" || version === "v2"
    ? { version: "2.0.0" }
    : { version: APP_VERSION, track: appTrack() };
}

export function exposesPeers(version: ApiVersion): boolean {
  return version !== "v1";
}
