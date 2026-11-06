import { LocalEntityName } from "../types/entities";

// Desde v4 las filas traen bed_capacity y v3 nunca debe leerlas: cada generación
// de esquema tiene su prefijo y las escrituras invalidan todas.
export const CACHE_GENERATIONS = ["hospitaline:v4", "hospitaline"] as const;

const CURRENT = CACHE_GENERATIONS[0];

export const cacheKeys = {
  local: (entity: LocalEntityName, id: string, prefix: string = CURRENT) =>
    `${prefix}:local:${entity}:${id}`,
  last: (entity: LocalEntityName, prefix: string = CURRENT) =>
    `${prefix}:local:${entity}:last`,
  peerLast: (api: "biblio-express" | "pokenetes", entity: "users" | "entrenador") =>
    `hospitaline:peer:${api}:${entity}:last`
};
