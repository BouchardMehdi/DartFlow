"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountHeaderAvatar } from "@/components/account/AccountHeaderAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/new-game", label: "Jouer" },
  { href: "/history", label: "Historique" },
  { href: "/stats", label: "Statistiques" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/clubs", label: "Clubs" },
  { href: "/account", label: "Compte" },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/game") return null;

  const active = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[#0d0f0e]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-6xl items-center gap-3 px-4 sm:px-7">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg shadow-black/30">
              <Image
                src="/icons/dartflow-192.png"
                alt=""
                fill
                sizes="44px"
                priority
                className="object-cover"
              />
            </span>
            <span className="min-w-0">
              <strong className="block text-lg leading-none tracking-[-.04em]">
                DARTFLOW
              </strong>
              <span className="mt-1 hidden text-[9px] uppercase tracking-[.22em] text-[var(--muted)] sm:block">
                Votre partie. Votre rythme.
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navigation principale"
            className="ml-auto hidden items-center gap-1 lg:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active(link.href) ? "page" : undefined}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${active(link.href) ? "bg-[var(--lime)] text-black" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <NotificationBell />
            <AccountHeaderAvatar />
          </div>
          <button
            type="button"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="grid size-11 place-items-center rounded-xl border border-[var(--line)] text-xl lg:hidden"
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </header>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
          />
          <nav
            aria-label="Navigation mobile"
            className="fixed right-4 top-20 z-50 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-[var(--line)] bg-[#141715] p-2 shadow-2xl shadow-black/70 lg:hidden"
          >
            <div className="grid grid-cols-3 gap-1.5">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active(link.href) ? "page" : undefined}
                  className={`grid min-h-11 place-items-center rounded-xl px-3 text-sm font-bold ${active(link.href) ? "bg-[var(--lime)] text-black" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
