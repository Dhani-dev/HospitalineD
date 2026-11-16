import { cacheKeys } from "../cache/keys";
import { CacheClient } from "../cache/cacheClient";
import { faultFromEnv } from "../chaos/dependencyFault";
import { dependencyFaultRequested } from "../chaos/requestContext";
import { PeerResponse } from "../types/entities";
import { ExternalEntitiesClient } from "./externalEntitiesClient";

export class CachedExternalEntitiesClient implements ExternalEntitiesClient {
  constructor(
    private readonly inner: ExternalEntitiesClient,
    private readonly cache: CacheClient,
    private readonly ttlSeconds: number,
    private readonly keyPrefix?: string
  ) {}

  getLastUser(traceId: string): Promise<PeerResponse> {
    return this.readPeer(
      cacheKeys.peerLast("biblio-express", "users", this.keyPrefix),
      () => this.inner.getLastUser(traceId)
    );
  }

  getLastEntrenador(traceId: string): Promise<PeerResponse> {
    return this.readPeer(
      cacheKeys.peerLast("pokenetes", "entrenador", this.keyPrefix),
      () => this.inner.getLastEntrenador(traceId)
    );
  }

  async getPeers(traceId: string) {
    const [users, entrenador] = await Promise.all([
      this.getLastUser(traceId),
      this.getLastEntrenador(traceId)
    ]);

    return {
      "biblio-express": users,
      pokenetes: entrenador
    };
  }

  private async readPeer(
    key: string,
    loader: () => Promise<PeerResponse>
  ): Promise<PeerResponse> {
    // Durante el fallo la caché ocultaría el 503 y la ronda mediría el sistema sano.
    if (dependencyFaultRequested() || faultFromEnv()) {
      return loader();
    }

    const cached = await this.cache.get<PeerResponse>(key);
    if (cached.hit) {
      return cached.value;
    }

    const value = await loader();
    if (value.live) {
      await this.cache.set(key, value, this.ttlSeconds);
    }

    return value;
  }
}
