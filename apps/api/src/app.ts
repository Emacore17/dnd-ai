import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import {
  registerIdentityRoutes,
  type RegisterIdentityRoutesOptions,
} from "./identity/routes.js";
import {
  registerIdentityAccessRoutes,
  type RegisterIdentityAccessRoutesOptions,
} from "./identity/access-routes.js";

export interface ApiAppDependencies {
  readonly identity?: RegisterIdentityRoutesOptions;
  readonly identityAccess?: RegisterIdentityAccessRoutesOptions;
}

export function createApiApp(
  options: FastifyServerOptions = {},
  dependencies: ApiAppDependencies = {},
): FastifyInstance {
  const app = Fastify(options);
  if (dependencies.identity !== undefined) {
    registerIdentityRoutes(app, dependencies.identity);
  }
  if (dependencies.identityAccess !== undefined) {
    registerIdentityAccessRoutes(app, dependencies.identityAccess);
  }
  return app;
}
