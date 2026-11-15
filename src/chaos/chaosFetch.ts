import { trace } from "@opentelemetry/api";
import type { FetchLike } from "../integrations/externalEntitiesClient";
import { recordInjectedFault } from "../observability/metrics";
import { DependencyFaultSwitch, PeerName } from "./dependencyFault";

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
    const peer = fault && peerForUrl(String(input), peers);
    const targeted = peer && (fault.target === "all" || fault.target === peer);

    if (!fault || !targeted || random() >= fault.rate) {
      return base(input, init);
    }

    recordInjectedFault(peer, fault.status);
    trace.getActiveSpan()?.setAttributes({
      "chaos.injected": true,
      "chaos.fault": fault.fault,
      "chaos.target": peer,
      "http.response.status_code": fault.status
    });

    return new Response(
      JSON.stringify({ message: "Injected dependency fault", fault: fault.fault, peer }),
      { status: fault.status, headers: { "content-type": "application/json" } }
    );
  };
}
