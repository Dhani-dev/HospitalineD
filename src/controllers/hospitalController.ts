import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiVersion, hasBedCapacity, hidesPeersOnRead, versionFields } from "../http/apiVersion";
import { presentHospital } from "../http/hospitalContract";
import { recordHospitalRegistered } from "../observability/metrics";
import { traceIdentifiers } from "../observability/trace-context";
import { IHospitalService } from "../services/contracts";
import { Hospital } from "../types/entities";
import { handleControllerError } from "./baseController";

const hospitalCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(7)
});

const hospitalV4CreateSchema = hospitalCreateSchema.extend({
  bed_capacity: z.number().int().min(0).max(10000).nullable().optional()
});

const atLeastOneField = (payload: object) => Object.keys(payload).length > 0;

const hospitalPatchSchema = hospitalCreateSchema
  .partial()
  .refine(atLeastOneField, "At least one field is required");

const hospitalV4PatchSchema = hospitalV4CreateSchema
  .partial()
  .refine(atLeastOneField, "At least one field is required");

const hospitalQuerySchema = z.object({
  filters: z
    .object({
      name: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional()
    })
    .optional(),
  sort: z
    .object({
      field: z.string(),
      direction: z.enum(["asc", "desc"]).optional()
    })
    .optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional()
});

export class HospitalController {
  constructor(
    private readonly hospitalService: IHospitalService,
    private readonly version: ApiVersion = "v1"
  ) {}

  private present = (hospital: Hospital) => presentHospital(hospital, this.version);

  private createSchema() {
    return hasBedCapacity(this.version) ? hospitalV4CreateSchema : hospitalCreateSchema;
  }

  private patchSchema() {
    return hasBedCapacity(this.version) ? hospitalV4PatchSchema : hospitalPatchSchema;
  }

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await this.hospitalService.list();
      return reply.status(200).send(data.map(this.present));
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  getLast = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const local = await this.hospitalService.getLast();
      return reply.status(200).send({
        api: "hospitaline",
        ...versionFields(this.version),
        ...traceIdentifiers(request.traceId),
        entity: "hospital",
        local: local && this.present(local)
      });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const hospital = await this.hospitalService.getById(request.params.id);
      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }
      return reply.status(200).send(this.present(hospital));
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  getByIdV2 = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      if (hidesPeersOnRead(this.version)) {
        const local = await this.hospitalService.getById(request.params.id);
        if (!local) {
          return reply.status(404).send({ message: "Hospital not found" });
        }
        return reply.status(200).send({
          api: "hospitaline",
          ...versionFields(this.version),
          ...traceIdentifiers(request.traceId),
          entity: "hospital",
          local: this.present(local)
        });
      }

      const hospital = await this.hospitalService.getByIdV2(
        request.params.id,
        request.traceId
      );
      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }
      return reply.status(200).send({
        ...hospital,
        ...versionFields(this.version),
        local: this.present(hospital.local)
      });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  create = async (
    request: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply
  ) => {
    try {
      const payload = this.createSchema().parse(request.body);
      const created = await this.hospitalService.create(payload);
      recordHospitalRegistered(created.bed_capacity !== undefined && created.bed_capacity !== null);
      return reply.status(201).send(this.present(created));
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  replace = async (
    request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
    reply: FastifyReply
  ) => {
    try {
      const payload = hasBedCapacity(this.version)
        ? { bed_capacity: null, ...hospitalV4CreateSchema.parse(request.body) }
        : hospitalCreateSchema.parse(request.body);
      const updated = await this.hospitalService.replace(request.params.id, payload);
      if (!updated) {
        return reply.status(404).send({ message: "Hospital not found" });
      }
      return reply.status(200).send(this.present(updated));
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  patch = async (
    request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
    reply: FastifyReply
  ) => {
    try {
      const payload = this.patchSchema().parse(request.body);
      const updated = await this.hospitalService.patch(request.params.id, payload);
      if (!updated) {
        return reply.status(404).send({ message: "Hospital not found" });
      }
      return reply.status(200).send(this.present(updated));
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  remove = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const removed = await this.hospitalService.remove(request.params.id);
      if (!removed) {
        return reply.status(404).send({ message: "Hospital not found" });
      }
      return reply.status(204).send();
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };

  query = async (
    request: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply
  ) => {
    try {
      const payload = hospitalQuerySchema.parse(request.body ?? {});
      const result = await this.hospitalService.query(payload);
      return reply.status(200).send({ ...result, data: result.data.map(this.present) });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  };
}
