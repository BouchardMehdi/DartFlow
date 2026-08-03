"use client";

import type { RealtimeEvent } from "@dartflow/shared";
import { useEffect } from "react";
import { useCloud } from "@/components/cloud/CloudProvider";

export const REALTIME_EVENT = "dartflow:realtime";

const websocketUrl = () => {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) return process.env.NEXT_PUBLIC_REALTIME_URL;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return `${protocol}//${window.location.hostname}${local ? ":4000" : ""}/realtime`;
};

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCloud();

  useEffect(() => {
    if (!user || !navigator.onLine) return;
    let socket: WebSocket | null = null; let retry: ReturnType<typeof setTimeout> | undefined; let heartbeat: ReturnType<typeof setInterval> | undefined; let stopped = false; let delay = 1_000;
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(websocketUrl());
      socket.addEventListener("open", () => { delay = 1_000; heartbeat = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" })); }, 25_000); });
      socket.addEventListener("message", (message) => {
        try { const event = JSON.parse(String(message.data)) as RealtimeEvent | { type: "ready" } | { type: "pong" }; if (event.type !== "ready" && event.type !== "pong") window.dispatchEvent(new CustomEvent<RealtimeEvent>(REALTIME_EVENT, { detail: event })); } catch { /* message ignoré */ }
      });
      socket.addEventListener("close", () => { if (heartbeat) clearInterval(heartbeat); if (!stopped && navigator.onLine) { retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 15_000); } });
    };
    connect();
    const online = () => { if (!socket || socket.readyState === WebSocket.CLOSED) connect(); };
    window.addEventListener("online", online);
    return () => { stopped = true; if (retry) clearTimeout(retry); if (heartbeat) clearInterval(heartbeat); window.removeEventListener("online", online); socket?.close(); };
  }, [user]);

  return children;
}

export function onRealtime(handler: (event: RealtimeEvent) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<RealtimeEvent>).detail);
  window.addEventListener(REALTIME_EVENT, listener);
  return () => window.removeEventListener(REALTIME_EVENT, listener);
}
