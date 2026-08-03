import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { email: string; username: string; ver: number };
    user: { sub: string; email: string; username: string; ver: number; exp?: number };
  }
}
