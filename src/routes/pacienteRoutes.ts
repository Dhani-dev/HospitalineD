import { FastifyPluginAsync } from "fastify";
import { ServiceContainer } from "../bootstrap/createServices";
import { PacienteController } from "../controllers/pacienteController";
import { ApiVersion, exposesPeers } from "../http/apiVersion";

export const pacienteRoutes = (
  services: ServiceContainer,
  version: ApiVersion = "v1"
): FastifyPluginAsync => {
  return async (fastify) => {
    const controller = new PacienteController(services.pacienteService, version);

    fastify.get("/pacientes", controller.list);
    if (exposesPeers(version)) {
      fastify.get("/pacientes/last", controller.getLast);
    }
    fastify.get(
      "/pacientes/:id",
      exposesPeers(version) ? controller.getByIdV2 : controller.getById
    );
    fastify.post("/pacientes", controller.create);
    fastify.put("/pacientes/:id", controller.replace);
    fastify.patch("/pacientes/:id", controller.patch);
    fastify.delete("/pacientes/:id", controller.remove);
    fastify.route({ method: "QUERY", url: "/pacientes/query", handler: controller.query });
  };
};
