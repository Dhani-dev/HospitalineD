import { cacheKeys } from "../cache/keys";
import { CacheClient } from "../cache/cacheClient";
import { PeerResponse } from "../types/entities";
import { ExternalEntitiesClient } from "./externalEntitiesClient";

export class CachedExternalEntitiesClient implements ExternalEntitiesClient {
  constructor(
    private readonly inner: ExternalEntitiesClient,
    private readonly cache: CacheClient,
    private readonly ttlSeconds: number
  ) {}

  getLastBook(traceId: string): Promise<PeerResponse> {
    return this.readPeer(
      cacheKeys.peerLast("biblio-express", "books"),
      () => this.inner.getLastBook(traceId)
    );
  }

  getLastEntrenador(traceId: string): Promise<PeerResponse> {
    return this.readPeer(
      cacheKeys.peerLast("pokenetes", "entrenador"),
      () => this.inner.getLastEntrenador(traceId)
    );
  }

  async getPeers(traceId: string) {
    const [books, entrenador] = await Promise.all([
      this.getLastBook(traceId),
      this.getLastEntrenador(traceId)
    ]);

    return {
      "biblio-express": books,
      pokenetes: entrenador
    };
  }

  private async readPeer(
    key: string,
    loader: () => Promise<PeerResponse>
  ): Promise<PeerResponse> {
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
