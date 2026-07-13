import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions
} from "fastify";

export function createApiApp(
  options: FastifyServerOptions = {}
): FastifyInstance {
  return Fastify(options);
}
