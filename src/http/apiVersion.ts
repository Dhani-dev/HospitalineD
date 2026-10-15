export type ApiVersion = "v1" | "v2" | "v3";

export type ContractVersion = "2.0.0" | "3.0.0";

export function contractVersion(url: string): ContractVersion {
  return url.split("?")[0].startsWith("/api/v3") ? "3.0.0" : "2.0.0";
}

export function exposesPeers(version: ApiVersion): boolean {
  return version !== "v1";
}
