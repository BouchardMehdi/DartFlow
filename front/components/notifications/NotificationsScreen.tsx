"use client";

import type { NotificationsResponse } from "@dartflow/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { onRealtime } from "@/components/realtime/RealtimeProvider";
import { apiRequest } from "@/src/cloud/api";

export function NotificationsScreen() {
  const [data,setData]=useState<NotificationsResponse|null>(null); const [error,setError]=useState("");
  const refresh=useCallback(async()=>{try{setData(await apiRequest<NotificationsResponse>("/notifications"));setError("");}catch(reason){setError(reason instanceof Error?reason.message:"Notifications indisponibles.");}},[]);
  useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);const unsubscribe=onRealtime((event)=>{if(event.type==="notification.created")void refresh();});return()=>{clearTimeout(timer);unsubscribe();};},[refresh]);
  const readAll=async()=>{await apiRequest("/notifications/read-all",{method:"POST"});await refresh();};
  return <main className="mx-auto min-h-[calc(100vh-4.5rem)] max-w-3xl px-4 py-8 sm:px-7"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Votre activité</p><h1 className="mt-2 text-4xl font-black">Notifications</h1></div>{Boolean(data?.unreadCount)&&<button onClick={()=>void readAll()} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold">Tout marquer comme lu</button>}</div>{error&&<p role="alert" className="mt-5 text-[#ff9b7a]">{error}</p>}<div className="mt-6 grid gap-2">{!data?<p className="text-[var(--muted)]">Chargement…</p>:data.notifications.length===0?<p className="rounded-2xl border border-[var(--line)] p-6 text-[var(--muted)]">Aucune notification pour le moment.</p>:data.notifications.map(item=>{const content=<><span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt?"bg-[var(--line)]":"bg-[var(--lime)]"}`}/><span className="min-w-0"><strong className="block">{item.title}</strong><span className="mt-1 block text-sm leading-6 text-[var(--muted)]">{item.body}</span><time className="mt-2 block text-[10px] text-[var(--muted)]">{new Date(item.createdAt).toLocaleString("fr-FR")}</time></span></>;return item.href?<Link key={item.id} href={item.href} className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--lime)]/50">{content}</Link>:<article key={item.id} className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">{content}</article>;})}</div></main>;
}
