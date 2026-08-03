import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { config } from "../config.js";
import { pool } from "../database.js";

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
    const result = await pool.query<{ session_version: number }>("SELECT session_version FROM users WHERE id=$1", [request.user.sub]);
    if (!result.rows[0] || result.rows[0].session_version !== (request.user.ver ?? 1)) {
      throw Object.assign(new Error("Session invalide."), { statusCode: 401 });
    }
  });
};

export default fp(authPlugin);
