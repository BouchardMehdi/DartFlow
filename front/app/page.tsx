import Link from "next/link";
import { ResumeGameCard } from "@/components/home/ResumeGameCard";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { CloudStatusBadge } from "@/components/cloud/CloudStatusBadge";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center gap-3 border-b border-[var(--line)] pb-5">
        <span className="grid size-10 place-items-center rounded-full bg-[var(--lime)] text-xl font-black text-black">↗</span>
        <div className="min-w-0 flex-1"><p className="text-xl font-black tracking-[-.05em]">DARTFLOW</p><p className="text-[10px] uppercase tracking-[.24em] text-[var(--muted)]">Votre partie. Votre rythme.</p></div><CloudStatusBadge />
      </header>

      <section className="flex flex-1 flex-col justify-center py-14">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--lime)]">Compteur de fléchettes local</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[.92] tracking-[-.065em] sm:text-7xl">La cible est prête.<br /><span className="text-[var(--muted)]">À vous de jouer.</span></h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)]">Créez une partie de 1 à 8 joueurs, choisissez vos règles et saisissez chaque lancer directement sur la cible.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/new-game" className="grid min-h-14 place-items-center rounded-2xl bg-[var(--lime)] px-7 font-black text-black transition-transform hover:scale-[1.02]">Nouvelle partie</Link>
          <Link href="/history" className="grid min-h-14 place-items-center rounded-2xl border border-[var(--line)] px-7 font-bold text-[var(--muted)] hover:text-white">Historique</Link>
          <InstallAppButton />
        </div>
        <nav className="mt-3 flex flex-wrap gap-2"><Link href="/stats" className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--muted)] hover:text-white">Statistiques</Link><Link href="/leaderboard" className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--muted)] hover:text-white">Classement en ligne</Link><Link href="/account" className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--muted)] hover:text-white">Compte et partage</Link></nav>
        <ResumeGameCard />
      </section>

      <footer className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">Fonctionne hors ligne · Synchronisation cloud facultative</footer>
    </main>
  );
}
