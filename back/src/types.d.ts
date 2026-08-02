import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { email: string; username: string };
    user: { sub: string; email: string; username: string; exp?: number };
  }
}
