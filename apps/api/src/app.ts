import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import {
  registerIdentityRoutes,
  type RegisterIdentityRoutesOptions,
} from "./identity/routes.js";

export interface ApiAppDependencies {
  readonly identity?: RegisterIdentityRoutesOptions;
}

export function createApiApp(
  options: FastifyServerOptions = {},
  dependencies: ApiAppDependencies = {},
): FastifyInstance {
  const app = Fastify(options);
  if (dependencies.identity !== undefined) {
    registerIdentityRoutes(app, dependencies.identity);
  }
  return app;
}
