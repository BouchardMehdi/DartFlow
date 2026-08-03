import { randomUUID } from "node:crypto";
import type { NotificationItem } from "@dartflow/shared";
import { pool } from "./database.js";
import { publishToUser } from "./realtime.js";

export async function createNotification(input: {
  userId: string;
  type: NotificationItem["type"];
  title: string;
  body: string;
  href?: string;
}): Promise<NotificationItem> {
  const id = randomUUID();
  const result = await pool.query<{ created_at: Date }>("INSERT INTO notifications(id,user_id,type,title,body,href) VALUES($1,$2,$3,$4,$5,$6) RETURNING created_at", [id, input.userId, input.type, input.title, input.body, input.href ?? null]);
  const notification: NotificationItem = { id, type: input.type, title: input.title, body: input.body, ...(input.href ? { href: input.href } : {}), createdAt: result.rows[0]?.created_at.toISOString() ?? new Date().toISOString() };
  publishToUser(input.userId, { type: "notification.created", notification });
  return notification;
}

export async function notifyClubMembers(clubId: string, input: Omit<Parameters<typeof createNotification>[0], "userId">, exceptUserId?: string): Promise<void> {
  const result = await pool.query<{ user_id: string }>("SELECT user_id FROM club_members WHERE club_id=$1 AND status='active'", [clubId]);
  await Promise.all(result.rows.filter((row) => row.user_id !== exceptUserId).map((row) => createNotification({ ...input, userId: row.user_id })));
}
