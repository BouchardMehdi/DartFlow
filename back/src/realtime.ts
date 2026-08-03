import type { RealtimeEvent } from "@dartflow/shared";
import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import { z } from "zod";
import { pool } from "./database.js";

const clients = new Map<string, Set<WebSocket>>();
const clientMessage = z.object({ type: z.literal("ping") });

const send = (socket: WebSocket, event: RealtimeEvent | { type: "ready" } | { type: "pong" }) => {
  if (socket.readyState === 1) socket.send(JSON.stringify(event));
};

export function publishToUser(userId: string, event: RealtimeEvent): void {
  for (const socket of clients.get(userId) ?? []) send(socket, event);
}

export async function publishToClub(clubId: string, event: RealtimeEvent, exceptUserId?: string): Promise<void> {
  const result = await pool.query<{ user_id: string }>("SELECT user_id FROM club_members WHERE club_id=$1 AND status='active'", [clubId]);
  for (const { user_id: userId } of result.rows) if (userId !== exceptUserId) publishToUser(userId, event);
}

export function registerRealtimeRoute(app: FastifyInstance): void {
  app.get("/realtime", { websocket: true, preValidation: app.authenticate }, (socket, request) => {
    const userId = request.user.sub;
    const userClients = clients.get(userId) ?? new Set<WebSocket>();
    userClients.add(socket);
    clients.set(userId, userClients);
    send(socket, { type: "ready" });

    socket.on("message", (raw) => {
      try {
        const parsed = clientMessage.safeParse(JSON.parse(raw.toString()));
        if (parsed.success) send(socket, { type: "pong" });
      } catch {
        // Ignore malformed client frames without terminating the realtime channel.
      }
    });
    socket.on("close", () => {
      userClients.delete(socket);
      if (!userClients.size) clients.delete(userId);
    });
  });
}
