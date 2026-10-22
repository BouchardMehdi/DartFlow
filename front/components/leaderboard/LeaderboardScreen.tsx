"use client";

import type { LeaderboardRow } from "@dartflow/shared";
import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { apiRequest } from "@/src/cloud/api";

export function LeaderboardScreen() {
  const [mode, setMode] = useState(""); const [rows, setRows] = useState<LeaderboardRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; void apiRequest<{ rows: LeaderboardRow[] }>(`/leaderboard${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`).then((result) => { if (active) setRows(result.rows); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Classement indisponible."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [mode]);
  return <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Profils publics</p><h1 className="mt-2 text-4xl font-black tracking-[-.05em]">Classement en ligne</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Les résultats proviennent de scores saisis manuellement : ce classement est amical et non certifié.</p><div className="mt-5 max-w-xs"><SelectField value={mode} ariaLabel="Mode du classement" options={[{ value: "", label: "Tous les modes" }, { value: "count-up", label: "Count-Up" }, { value: "301", label: "301" }, { value: "501", label: "501" }, { value: "701", label: "701" }, { value: "around-the-clock", label: "Around the Clock" }, { value: "shanghai", label: "Shanghai" }, { value: "cricket", label: "Cricket" }, { value: "killer", label: "Killer" }]} onChange={(value) => { setLoading(true); setError(""); setMode(value); }} /></div>{loading ? <p className="mt-6 text-[var(--muted)]">Chargement…</p> : error ? <p className="mt-6 text-[#ff9b7a]">{error}</p> : rows.length === 0 ? <p className="mt-6 rounded-2xl border border-[var(--line)] p-5 text-[var(--muted)]">Aucun profil public n’a encore terminé de partie dans ce mode.</p> : <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)]">
    <div className="hidden grid-cols-[3rem_minmax(0,1fr)_6rem_6rem_6rem] gap-2 bg-[var(--panel)] px-4 py-3 text-xs font-black uppercase tracking-wider text-[var(--muted)] md:grid"><span>#</span><span>Joueur</span><span>Victoires</span><span>Moy./dart</span><span>Parties</span></div>
    {rows.map((row) => <article key={row.profileId} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 border-t border-[var(--line)] bg-[var(--panel)] p-4 first:border-t-0 md:grid-cols-[3rem_minmax(0,1fr)_6rem_6rem_6rem] md:gap-2 md:bg-transparent">
      <strong className="text-[var(--lime)]">{row.rank}</strong>
      <div className="min-w-0"><strong className="block break-words">{row.name}</strong><span className="block text-xs text-[var(--muted)]">@{row.ownerUsername} ? {row.winRate.toFixed(0)} %</span></div>
      <dl className="col-span-2 grid grid-cols-3 gap-2 rounded-xl bg-black/20 p-3 text-sm md:contents">
        <div className="min-w-0 md:contents"><dt className="text-[11px] text-[var(--muted)] md:hidden">Victoires</dt><dd className="font-black tabular-nums">{row.wins}</dd></div>
        <div className="min-w-0 md:contents"><dt className="text-[11px] text-[var(--muted)] md:hidden">Moy./flèche</dt><dd className="font-black tabular-nums">{row.averagePerDart.toFixed(1)}</dd></div>
        <div className="min-w-0 md:contents"><dt className="text-[11px] text-[var(--muted)] md:hidden">Parties</dt><dd className="tabular-nums">{row.games}</dd></div>
      </dl>
    </article>)}
  </div>}</main>;
}
