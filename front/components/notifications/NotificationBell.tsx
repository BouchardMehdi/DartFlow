"use client";

import type { NotificationsResponse } from "@dartflow/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCloud } from "@/components/cloud/CloudProvider";
import { onRealtime } from "@/components/realtime/RealtimeProvider";
import { apiRequest } from "@/src/cloud/api";

export function NotificationBell() {
  const { user } = useCloud(); const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true; void apiRequest<NotificationsResponse>("/notifications").then((result) => { if (active) setCount(result.unreadCount); }).catch(() => undefined);
    const unsubscribe = onRealtime((event) => { if (event.type === "notification.created") setCount((current) => current + 1); });
    return () => { active = false; unsubscribe(); };
  }, [user]);
  if (!user) return null;
  return <Link href="/notifications" aria-label={`${count} notification${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`} className="relative grid size-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--lime)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>{count>0&&<span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--orange)] px-1 text-[10px] font-black text-white">{count>99?"99+":count}</span>}</Link>;
}
