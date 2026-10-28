import { LocalEntityName } from "../types/entities";
import { CacheClient } from "./cacheClient";
import { CACHE_GENERATIONS, cacheKeys } from "./keys";

export class EntityCache {
  constructor(
    private readonly cache: CacheClient,
    private readonly ttlSeconds: number
  ) {}

  async readThrough<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached.hit) {
      return cached.value;
    }

    const value = await loader();
    if (value !== null && value !== undefined) {
      await this.cache.set(key, value, this.ttlSeconds);
    }

    return value;
  }

  invalidateLocal(entity: LocalEntityName, id?: string): Promise<void> {
    const keys = CACHE_GENERATIONS.flatMap((prefix) =>
      id
        ? [cacheKeys.last(entity, prefix), cacheKeys.local(entity, id, prefix)]
        : [cacheKeys.last(entity, prefix)]
    );
    return this.cache.del(keys);
  }
}
