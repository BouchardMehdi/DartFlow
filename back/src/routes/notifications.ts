import type { NotificationItem, NotificationsResponse } from "@dartflow/shared";
import type { FastifyPluginAsync } from "fastify";
import { pool } from "../database.js";

interface NotificationRow { id: string; type: NotificationItem["type"]; title: string; body: string; href: string | null; read_at: Date | null; created_at: Date }

const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: app.authenticate }, async (request) => {
    const result = await pool.query<NotificationRow>("SELECT id,type,title,body,href,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100", [request.user.sub]);
    const notifications: NotificationItem[] = result.rows.map((row) => ({ id: row.id, type: row.type, title: row.title, body: row.body, ...(row.href ? { href: row.href } : {}), ...(row.read_at ? { readAt: row.read_at.toISOString() } : {}), createdAt: row.created_at.toISOString() }));
    const response: NotificationsResponse = { notifications, unreadCount: notifications.filter((item) => !item.readAt).length };
    return response;
  });

  app.post("/read-all", { preHandler: app.authenticate }, async (request) => {
    await pool.query("UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1", [request.user.sub]);
    return { updated: true };
  });
};

export default notificationRoutes;
