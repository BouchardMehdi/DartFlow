import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: "dartflow_access", signed: false },
  });
  app.decorate("authenticate", async (request: FastifyRequest) => {
    await request.jwtVerify({ onlyCookie: true });
  });
};

export default fp(authPlugin);
