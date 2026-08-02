"use client";

import Image from "next/image";
import Link from "next/link";
import { useCloud } from "@/components/cloud/CloudProvider";

export function AccountHeaderAvatar() {
  const { user, loading, syncStatus } = useCloud();
  if (loading || !user) return null;

  const statusColor =
    syncStatus === "error"
      ? "bg-[var(--orange)]"
      : syncStatus === "offline"
        ? "bg-[#e5bd55]"
        : "bg-[var(--lime)]";
  const statusLabel =
    syncStatus === "syncing"
      ? "Synchronisation en cours"
      : syncStatus === "offline"
        ? "Hors ligne"
        : syncStatus === "error"
          ? "À synchroniser"
          : "Synchronisé";

  return (
    <Link
      href="/account"
      aria-label={`Compte de ${user.username} · ${statusLabel}`}
      className="relative grid size-11 shrink-0 place-items-center overflow-visible rounded-full border-2 border-[var(--line)] bg-[var(--panel)] font-black uppercase hover:border-[var(--lime)]"
    >
      <span className="relative grid size-full overflow-hidden rounded-full">
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={`Photo de ${user.username}`}
            fill
            sizes="44px"
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[var(--lime)]">
            {user.username.charAt(0)}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-[#0d0f0e] ${statusColor}`}
      />
    </Link>
  );
}
