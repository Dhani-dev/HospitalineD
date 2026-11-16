import { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "../errors/httpError";
import { DependencyCascadeError } from "../chaos/dependencyCascade";
import { ExternalApiError } from "../integrations/externalEntitiesClient";

export function handleControllerError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Validation error",
      issues: error.issues
    });
  }

  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  if (error instanceof DependencyCascadeError) {
    return reply.status(503).send({
      message: error.message,
      dependency: error.service
    });
  }

  if (error instanceof ExternalApiError) {
    return reply.status(502).send({ message: error.message });
  }

  return reply.status(500).send({ message: "Internal server error" });
}
