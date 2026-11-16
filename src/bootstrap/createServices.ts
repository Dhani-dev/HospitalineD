import pool from "../db/pool";
import { DoctorRepository } from "../repositories/doctorRepository";
import { HospitalRepository } from "../repositories/hospitalRepository";
import { PacienteRepository } from "../repositories/pacienteRepository";
import { DoctorService } from "../services/doctorService";
import { HospitalService } from "../services/hospitalService";
import { PacienteService } from "../services/pacienteService";
import { IDoctorService, IHospitalService, IPacienteService } from "../services/contracts";
import { EnvConfig, getEnvConfig } from "../config/env";
import {
  ExternalEntitiesClient,
  FetchLike,
  HttpExternalEntitiesClient
} from "../integrations/externalEntitiesClient";
import { CachedExternalEntitiesClient } from "../integrations/cachedExternalEntitiesClient";
import { createCacheClient } from "../cache/createCacheClient";
import { EntityCache } from "../cache/entityCache";
import { CacheClient } from "../cache/cacheClient";
import { chaosFetch } from "../chaos/chaosFetch";
import { DependencyFaultSwitch } from "../chaos/dependencyFault";

export type ServiceContainer = {
  hospitalService: IHospitalService;
  doctorService: IDoctorService;
  pacienteService: IPacienteService;
  cache?: CacheClient;
  v5?: ServiceContainer;
  chaos?: DependencyFaultSwitch;
};

function peerClient(
  env: EnvConfig,
  cache: CacheClient,
  fetcher: FetchLike = fetch,
  keyPrefix?: string
): ExternalEntitiesClient {
  return new CachedExternalEntitiesClient(
    new HttpExternalEntitiesClient(
      { baseUrl: env.usersApiUrl, lastPath: env.usersLastPath, listPath: env.usersListPath },
      {
        baseUrl: env.entrenadorApiUrl,
        lastPath: env.entrenadorLastPath,
        listPath: env.entrenadorListPath
      },
      fetcher
    ),
    cache,
    env.peerCacheTtlSeconds,
    keyPrefix
  );
}

function entityServices(
  externalEntitiesClient: ExternalEntitiesClient,
  entityCache: EntityCache
) {
  const hospitalRepository = new HospitalRepository(pool);
  const doctorRepository = new DoctorRepository(pool);
  const pacienteRepository = new PacienteRepository(pool);

  return {
    hospitalService: new HospitalService(hospitalRepository, externalEntitiesClient, entityCache),
    doctorService: new DoctorService(
      doctorRepository,
      hospitalRepository,
      externalEntitiesClient,
      entityCache
    ),
    pacienteService: new PacienteService(
      pacienteRepository,
      hospitalRepository,
      doctorRepository,
      externalEntitiesClient,
      entityCache
    )
  };
}

export function createDefaultServices(): ServiceContainer {
  const env = getEnvConfig();
  const cache = createCacheClient(env);
  const entityCache = new EntityCache(cache, env.cacheTtlSeconds);
  const chaos = new DependencyFaultSwitch(cache);

  // Solo v5 pasa por el interruptor; su caché de peers no se mezcla con la de v2/v3.
  const v5Fetch = chaosFetch(fetch, chaos, {
    "biblio-express": env.usersApiUrl,
    pokenetes: env.entrenadorApiUrl
  });
  const v5 = {
    ...entityServices(peerClient(env, cache, v5Fetch, "hospitaline:v5"), entityCache),
    cache
  };

  return {
    ...entityServices(peerClient(env, cache), entityCache),
    cache,
    v5,
    chaos
  };
}
