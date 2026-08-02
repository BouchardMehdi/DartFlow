"use client";

import type { ClubStatisticRow, ClubStatistics } from "@dartflow/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { apiRequest } from "@/src/cloud/api";

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl bg-black/20 p-3">
    <dt className="text-xs text-[var(--muted)]">{label}</dt>
    <dd className="mt-1 text-xl font-black tabular-nums">{value}</dd>
  </div>
);

const ownerLabel = (row: ClubStatisticRow) => row.kind === "guest" ? `Invité · ${row.ownerUsername}` : `@${row.ownerUsername}`;

export function ClubStatisticsScreen({ clubId }: { clubId: string }) {
  const [data, setData] = useState<ClubStatistics | null>(null);
  const [mode, setMode] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiRequest<ClubStatistics>(`/clubs/${clubId}/statistics?mode=${encodeURIComponent(mode)}`)
      .then((result) => { if (active) { setData(result); setSelectedId((current) => result.leaderboard.some((row) => row.profileId === current) ? current : result.leaderboard[0]?.profileId ?? ""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Statistiques indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clubId, mode]);

  const selected = data?.leaderboard.find((row) => row.profileId === selectedId) ?? data?.leaderboard[0];
  const modeOptions = useMemo(() => [{ value: "all", label: "Tous les modes" }, ...(data?.modes.map((item) => ({ value: item.key, label: item.label })) ?? [])], [data?.modes]);
  const selectedModeLabel = modeOptions.find((option) => option.value === mode)?.label ?? "Tous les modes";
  const changeMode = (value: string) => { setLoading(true); setError(""); setMode(value); };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-7">
      <Link href={`/clubs/${clubId}`} className="text-sm font-bold text-[var(--muted)]">← Retour au club</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Classement interne</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.05em]">{data?.club.name ?? "Statistiques du club"}</h1>
          <p className="mt-2 text-[var(--muted)]">Compare les profils du club et analyse leurs performances.</p>
        </div>
        <div className="w-full sm:w-72">
          <label><span className="mb-2 block text-sm font-bold">Mode de jeu</span><SelectField value={mode} ariaLabel="Filtrer par mode de jeu" options={modeOptions} onChange={changeMode} /></label>
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-[#713b32] bg-[#713b32]/15 p-4 font-bold text-[#ff9b7a]">{error}</p>}
      {loading && !data && <p className="mt-8 text-[var(--muted)]">Chargement du classement…</p>}

      {data && <>
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[var(--lime)]">Leaderboard</p><h2 className="mt-1 text-3xl font-black">Tous les joueurs</h2></div><span className="text-sm text-[var(--muted)]">{selectedModeLabel}</span></div>
          {data.leaderboard.length === 0 ? <p className="mt-4 rounded-2xl border border-[var(--line)] p-5 text-[var(--muted)]">Ajoute un profil au club pour créer son classement.</p> : <>
            <div className="mt-4 grid gap-2 md:hidden">
              {data.leaderboard.map((row) => <button type="button" key={row.profileId} onClick={() => setSelectedId(row.profileId)} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-2xl border p-4 text-left ${selected?.profileId === row.profileId ? "border-[var(--lime)] bg-[var(--lime)]/5" : "border-[var(--line)] bg-[var(--panel)]"}`}>
                <strong className="text-2xl text-[var(--lime)]">#{row.rank}</strong><span className="min-w-0"><strong className="block truncate">{row.name}</strong><small className="block truncate text-[var(--muted)]">{ownerLabel(row)}</small></span><span className="text-right"><strong className="block text-lg tabular-nums">{row.wins} V</strong><small className="text-[var(--muted)]">{row.games} partie{row.games > 1 ? "s" : ""}</small></span>
              </button>)}
            </div>
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-[var(--line)] md:block">
              <div className="grid grid-cols-[4rem_minmax(12rem,1fr)_6rem_6rem_7rem_7rem] gap-3 bg-[var(--panel)] px-5 py-3 text-xs font-black uppercase tracking-wide text-[var(--muted)]"><span>Rang</span><span>Joueur</span><span>Parties</span><span>Victoires</span><span>Taux</span><span>Moy./flèche</span></div>
              {data.leaderboard.map((row) => <button type="button" key={row.profileId} onClick={() => setSelectedId(row.profileId)} className={`grid w-full grid-cols-[4rem_minmax(12rem,1fr)_6rem_6rem_7rem_7rem] items-center gap-3 border-t border-[var(--line)] px-5 py-4 text-left ${selected?.profileId === row.profileId ? "bg-[var(--lime)]/5" : "hover:bg-white/[.03]"}`}><strong className="text-xl text-[var(--lime)]">#{row.rank}</strong><span className="min-w-0"><strong className="block truncate">{row.name}</strong><small className="text-[var(--muted)]">{ownerLabel(row)}</small></span><strong>{row.games}</strong><strong>{row.wins}</strong><strong>{row.winRate.toFixed(0)} %</strong><strong>{row.averagePerDart.toFixed(1)}</strong></button>)}
            </div>
          </>}
        </section>

        {selected && <section className="mt-8 rounded-[1.8rem] border border-[var(--lime)]/45 bg-[var(--panel)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[var(--lime)]">Statistiques du joueur</p><h2 className="mt-1 text-3xl font-black">{selected.name}</h2><p className="text-sm text-[var(--muted)]">{ownerLabel(selected)} · {selectedModeLabel}</p></div><span className="rounded-full border border-[var(--lime)]/40 bg-[var(--lime)]/10 px-4 py-2 text-sm font-black text-[var(--lime)]">#{selected.rank} du club</span></div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Parties" value={selected.games} />
            <Metric label="Victoires" value={selected.wins} />
            <Metric label="Défaites" value={selected.losses} />
            <Metric label="Taux de victoire" value={`${selected.winRate.toFixed(0)} %`} />
            <Metric label="Fléchettes" value={selected.dartsThrown} />
            <Metric label="Tours joués" value={selected.turnsPlayed} />
            <Metric label="Points marqués" value={selected.pointsScored} />
            <Metric label="Meilleur tour" value={selected.bestTurn} />
            <Metric label="Moy. / tour" value={selected.averagePerTurn.toFixed(1)} />
            <Metric label="Moy. / flèche" value={selected.averagePerDart.toFixed(1)} />
          </dl>
        </section>}
      </>}
    </main>
  );
}
