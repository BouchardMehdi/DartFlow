import Link from "next/link";

export default function OfflinePage() {
  return <main className="grid min-h-screen place-items-center px-6 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--lime)] text-2xl font-black text-black">↗</span><h1 className="mt-5 text-4xl font-black tracking-[-.05em]">Vous êtes hors ligne</h1><p className="mx-auto mt-3 max-w-sm text-[var(--muted)]">DartFlow conserve vos parties sur cet appareil. Les écrans déjà chargés restent disponibles sans connexion.</p><Link href="/" className="mx-auto mt-6 grid min-h-12 max-w-xs place-items-center rounded-xl bg-[var(--lime)] px-5 font-black text-black">Retour à l’accueil</Link></div></main>;
}
