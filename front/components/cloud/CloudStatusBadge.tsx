"use client";

import Link from "next/link";
import { useCloud } from "./CloudProvider";

export function CloudStatusBadge() {
  const { user, loading, syncStatus } = useCloud();
  if (loading) return <span className="text-xs text-[var(--muted)]">Compte…</span>;
  if (!user) return null;
  const label = syncStatus === "syncing" ? "Synchronisation…" : syncStatus === "offline" ? "Hors ligne" : syncStatus === "error" ? "À synchroniser" : "Synchronisé";
  return <Link href="/account" className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:border-[var(--lime)]"><span className={`mr-2 inline-block size-2 rounded-full ${syncStatus === "error" ? "bg-[var(--orange)]" : syncStatus === "offline" ? "bg-[#e5bd55]" : "bg-[var(--lime)]"}`} />{label}</Link>;
}
