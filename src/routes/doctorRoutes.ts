import { FastifyPluginAsync } from "fastify";
import { ServiceContainer } from "../bootstrap/createServices";
import { DoctorController } from "../controllers/doctorController";
import { ApiVersion, exposesPeers } from "../http/apiVersion";

export const doctorRoutes = (
  services: ServiceContainer,
  version: ApiVersion = "v1"
): FastifyPluginAsync => {
  return async (fastify) => {
    const controller = new DoctorController(services.doctorService, version);

    fastify.get("/doctors", controller.list);
    if (exposesPeers(version)) {
      fastify.get("/doctors/last", controller.getLast);
    }
    fastify.get(
      "/doctors/:id",
      exposesPeers(version) ? controller.getByIdV2 : controller.getById
    );
    fastify.post("/doctors", controller.create);
    fastify.put("/doctors/:id", controller.replace);
    fastify.patch("/doctors/:id", controller.patch);
    fastify.delete("/doctors/:id", controller.remove);
    fastify.route({ method: "QUERY", url: "/doctors/query", handler: controller.query });
  };
};
