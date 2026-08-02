import { Suspense } from "react";
import { NewGameForm } from "@/components/setup/NewGameForm";

export default function NewGamePage() {
  return <Suspense fallback={<main className="grid min-h-[60vh] place-items-center text-[var(--muted)]">Chargement…</main>}><NewGameForm /></Suspense>;
}
