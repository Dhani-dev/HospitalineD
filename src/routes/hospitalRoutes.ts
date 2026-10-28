import { FastifyPluginAsync } from "fastify";
import { ServiceContainer } from "../bootstrap/createServices";
import { HospitalController } from "../controllers/hospitalController";
import { ApiVersion, exposesPeers } from "../http/apiVersion";

export const hospitalRoutes = (
  services: ServiceContainer,
  version: ApiVersion
): FastifyPluginAsync => {
  return async (fastify) => {
    const controller = new HospitalController(services.hospitalService, version);

    fastify.get("/hospitals", controller.list);
    if (exposesPeers(version)) {
      fastify.get("/hospitals/last", controller.getLast);
    }
    fastify.get(
      "/hospitals/:id",
      exposesPeers(version) ? controller.getByIdV2 : controller.getById
    );
    fastify.post("/hospitals", controller.create);
    fastify.put("/hospitals/:id", controller.replace);
    fastify.patch("/hospitals/:id", controller.patch);
    fastify.delete("/hospitals/:id", controller.remove);
    fastify.route({ method: "QUERY", url: "/hospitals/query", handler: controller.query });
  };
};
