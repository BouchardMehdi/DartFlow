"use client";

import { useState } from "react";
import { Dartboard } from "@/components/dartboard/Dartboard";
import { createDart } from "@/src/game-engine/score-calculator";
import type { DartThrow } from "@/src/game-engine/types";

interface Props { onThrow: (dart: DartThrow) => void; disabled: boolean; }

export function ScoreInput({ onThrow, disabled }: Props) {
  const [view, setView] = useState<"keypad" | "board">("keypad");
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);

  const score = (segment: number) => {
    onThrow(createDart(segment, multiplier, multiplier === 3 ? "triple" : multiplier === 2 ? "double" : "single-inner"));
    setMultiplier(1);
  };

  return <div className="min-w-0">
    <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Méthode de saisie">
      {([{ id: "keypad", label: "Clavier" }, { id: "board", label: "Cible" }] as const).map(({ id, label }) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`min-h-11 rounded-xl border px-3 font-bold ${view === id ? "border-[var(--lime)] bg-[var(--lime)] text-black" : "border-[var(--line)] bg-[var(--panel)]"}`}>{label}</button>)}
    </div>
    {view === "board" ? <div className="grid place-items-center rounded-[2rem] border border-[var(--line)] bg-[radial-gradient(circle,#222622_0%,#111311_68%)] p-2 sm:p-5"><Dartboard onThrow={onThrow} disabled={disabled} /></div> : <fieldset disabled={disabled} className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 disabled:opacity-50 sm:p-4">
      <legend className="sr-only">Saisir une fléchette</legend>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Multiplicateur">
        {([1, 2, 3] as const).map((value) => <button key={value} type="button" aria-pressed={multiplier === value} onClick={() => setMultiplier(value)} className={`min-h-11 rounded-xl border text-sm font-bold ${multiplier === value ? "border-[var(--lime)] bg-[var(--lime)]/10 text-[var(--lime)]" : "border-[var(--line)]"}`}>{value === 1 ? "Simple" : value === 2 ? "Double" : "Triple"}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <button key={value} type="button" aria-label={`${multiplier === 1 ? "Simple" : multiplier === 2 ? "Double" : "Triple"} ${value}`} onClick={() => score(value)} className="min-h-12 rounded-xl border border-[var(--line)] bg-black/20 text-lg font-black tabular-nums hover:border-[var(--lime)] active:bg-[var(--lime)]/15">{value}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { onThrow(createDart(null, 1, "outer-bull")); setMultiplier(1); }} className="min-h-12 rounded-xl border border-[var(--line)] font-bold">Bull · 25</button>
        <button type="button" onClick={() => { onThrow(createDart(null, 2, "inner-bull")); setMultiplier(1); }} className="min-h-12 rounded-xl border border-[var(--line)] font-bold">Bull · 50</button>
      </div>
    </fieldset>}
  </div>;
}
