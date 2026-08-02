"use client";

import Link from "next/link";
import { useCloud } from "./CloudProvider";

export function CloudStatusBadge() {
  const { user, loading, syncStatus } = useCloud();
  if (loading) return null;
  if (!user) return null;
  const label = syncStatus === "syncing" ? "Synchronisation…" : syncStatus === "offline" ? "Hors ligne" : syncStatus === "error" ? "À synchroniser" : "Synchronisé";
  return <Link href="/account" aria-label={label} className="rounded-full border border-[var(--line)] px-2.5 py-2 text-xs font-bold hover:border-[var(--lime)] sm:px-3 sm:py-1.5"><span className={`inline-block size-2 rounded-full sm:mr-2 ${syncStatus === "error" ? "bg-[var(--orange)]" : syncStatus === "offline" ? "bg-[#e5bd55]" : "bg-[var(--lime)]"}`} /><span className="hidden sm:inline">{label}</span></Link>;
}
