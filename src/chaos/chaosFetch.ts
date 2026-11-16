import { trace } from "@opentelemetry/api";
import type { FetchLike } from "../integrations/externalEntitiesClient";
import { recordInjectedFault } from "../observability/metrics";
import { DependencyFaultSwitch, PeerName } from "./dependencyFault";
import { dependencyFaultRequested } from "./requestContext";

export type PeerBaseUrls = Record<PeerName, string>;

export function peerForUrl(url: string, peers: PeerBaseUrls): PeerName | null {
  for (const [peer, baseUrl] of Object.entries(peers) as Array<[PeerName, string]>) {
    const base = baseUrl.trim().replace(/\/$/, "");
    if (base && url.startsWith(base)) {
      return peer;
    }
  }
  return null;
}

export function chaosFetch(
  base: FetchLike,
  faults: DependencyFaultSwitch,
  peers: PeerBaseUrls,
  random: () => number = Math.random
): FetchLike {
  return async (input, init) => {
    const fault = await faults.current();
    const peer = peerForUrl(String(input), peers);
    const bySwitch = Boolean(
      fault && peer && (fault.target === "all" || fault.target === peer) && random() < fault.rate
    );
    const byHeader = Boolean(peer === "biblio-express" && dependencyFaultRequested());

    if (!peer || (!bySwitch && !byHeader)) {
      return base(input, init);
    }

    const status = fault?.status ?? 503;
    recordInjectedFault(peer, status);
    trace.getActiveSpan()?.setAttributes({
      "chaos.injected": true,
      "chaos.fault": fault?.fault ?? "dependency-5xx",
      "chaos.target": peer,
      "http.response.status_code": status
    });

    return new Response(
      JSON.stringify({ message: "Injected dependency fault", fault: "dependency-5xx", peer }),
      {
        status,
        headers: { "content-type": "application/json", "x-chaos-injected": "true" }
      }
    );
  };
}
