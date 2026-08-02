import Link from "next/link";
import { ResumeGameCard } from "@/components/home/ResumeGameCard";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { AuthMenuActions } from "@/components/home/AuthMenuActions";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col px-5 py-9 sm:px-8 sm:py-12">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr] lg:py-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--lime)]">
            Compteur de fléchettes local
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[.92] tracking-[-.065em] sm:text-7xl">
            La cible est prête.
            <br />
            <span className="text-[var(--muted)]">À vous de jouer.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)]">
            Créez une partie de 1 à 8 joueurs, choisissez vos règles et
            saisissez chaque lancer directement sur la cible.
          </p>
        </div>

        <div className="rounded-[1.8rem] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
          <p className="px-1 text-xs font-black uppercase tracking-[.18em] text-[var(--muted)]">
            Prêt à jouer ?
          </p>
          <Link
            href="/new-game"
            className="mt-3 flex min-h-16 items-center justify-between rounded-2xl bg-[var(--lime)] px-6 font-black text-black transition-transform hover:scale-[1.01]"
          >
            <span>Nouvelle partie</span>
            <span className="text-2xl">→</span>
          </Link>
          <ResumeGameCard />
          <div className="mt-3">
            <InstallAppButton />
          </div>
        </div>
      </section>

      <section className="mt-12 border-t border-[var(--line)] pt-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">
          Votre espace
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-black tracking-[-.04em]">
            Suivre vos performances
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Toutes vos données, au même endroit.
          </p>
        </div>
        <nav
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Accès rapides"
        >
          {(
            [
              [
                "/history",
                "Historique",
                "Retrouvez vos dernières parties et leurs résultats.",
              ],
              [
                "/stats",
                "Statistiques",
                "Analysez chaque profil et chaque mode de jeu.",
              ],
              [
                "/leaderboard",
                "Classement",
                "Comparez les profils publics en ligne.",
              ],
              [
                "/account",
                "Compte et amis",
                "Gérez la synchronisation et les profils partagés.",
              ],
            ] as const
          ).map(([href, title, description]) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-40 flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 hover:border-[var(--lime)]/60"
            >
              <span className="text-xs font-black uppercase tracking-[.16em] text-[var(--lime)]">
                DartFlow
              </span>
              <strong className="mt-3 text-xl">{title}</strong>
              <span className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {description}
              </span>
              <span className="mt-auto self-end text-xl text-[var(--lime)] transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="mt-10 rounded-[1.8rem] border border-[var(--line)] bg-black/20 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">
          Synchronisation
        </p>
        <h2 className="mt-2 text-2xl font-black">
          Retrouvez vos profils sur tous vos appareils
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Connectez-vous pour sauvegarder vos parties, ajouter des amis et
          partager vos profils.
        </p>
        <AuthMenuActions />
      </section>

      <footer className="mt-12 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
        Fonctionne hors ligne · Synchronisation cloud facultative
      </footer>
    </main>
  );
}
