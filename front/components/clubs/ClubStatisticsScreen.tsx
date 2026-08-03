"use client";

import type { ClubStatisticRow, ClubStatistics } from "@dartflow/shared";
import Image from "next/image";
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
const PlayerAvatar = ({ row, size = 40 }: { row: ClubStatisticRow; size?: number }) => <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-black/25" style={{ width: size, height: size }}>{row.avatar?<Image src={row.avatar} alt="" fill sizes={`${size}px`} unoptimized className="object-cover"/>:<span className="font-black uppercase text-[var(--lime)]">{row.name.charAt(0)}</span>}</span>;

export function ClubStatisticsScreen({ clubId }: { clubId: string }) {
  const [data, setData] = useState<ClubStatistics | null>(null);
  const [mode, setMode] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [compareId, setCompareId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiRequest<ClubStatistics>(`/clubs/${clubId}/statistics?mode=${encodeURIComponent(mode)}`)
      .then((result) => { if (active) { setData(result); setSelectedId((current) => result.leaderboard.some((row) => row.profileId === current) ? current : result.leaderboard[0]?.profileId ?? ""); setCompareId((current)=>result.leaderboard.some(row=>row.profileId===current)?current:result.leaderboard[1]?.profileId??""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Statistiques indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clubId, mode]);

  const selected = data?.leaderboard.find((row) => row.profileId === selectedId) ?? data?.leaderboard[0];
  const compared = data?.leaderboard.find((row) => row.profileId === compareId);
  const modeOptions = useMemo(() => [{ value: "all", label: "Tous les modes" }, ...(data?.modes.map((item) => ({ value: item.key, label: item.label })) ?? [])], [data?.modes]);
  const selectedModeLabel = modeOptions.find((option) => option.value === mode)?.label ?? "Tous les modes";
  const changeMode = (value: string) => { setLoading(true); setError(""); setMode(value); };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-7">
      <Link href={`/clubs/${clubId}`} className="text-sm font-bold text-[var(--muted)]">← Retour au club</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div className="flex items-center gap-4">
          {data&&<div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--lime)]/40 bg-[var(--panel)]">{data.club.avatar?<Image src={data.club.avatar} alt="" fill sizes="64px" unoptimized className="object-cover"/>:<span className="text-2xl font-black uppercase text-[var(--lime)]">{data.club.name.charAt(0)}</span>}</div>}
          <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Classement interne</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.05em]">{data?.club.name ?? "Statistiques du club"}</h1>
          <p className="mt-2 text-[var(--muted)]">Compare les profils du club et analyse leurs performances.</p>
          </div>
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
              {data.leaderboard.map((row) => <button type="button" key={row.profileId} onClick={() => setSelectedId(row.profileId)} className={`grid grid-cols-[2.5rem_2.5rem_1fr_auto] items-center gap-3 rounded-2xl border p-4 text-left ${selected?.profileId === row.profileId ? "border-[var(--lime)] bg-[var(--lime)]/5" : "border-[var(--line)] bg-[var(--panel)]"}`}>
                <strong className="text-2xl text-[var(--lime)]">#{row.rank}</strong><PlayerAvatar row={row}/><span className="min-w-0"><strong className="block truncate">{row.name}</strong><small className="block truncate text-[var(--muted)]">{ownerLabel(row)}</small></span><span className="text-right"><strong className="block text-lg tabular-nums">{row.wins} V</strong><small className="text-[var(--muted)]">{row.games} partie{row.games > 1 ? "s" : ""}</small></span>
              </button>)}
            </div>
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-[var(--line)] md:block">
              <div className="grid grid-cols-[4rem_minmax(12rem,1fr)_6rem_6rem_7rem_7rem] gap-3 bg-[var(--panel)] px-5 py-3 text-xs font-black uppercase tracking-wide text-[var(--muted)]"><span>Rang</span><span>Joueur</span><span>Parties</span><span>Victoires</span><span>Taux</span><span>Moy./flèche</span></div>
              {data.leaderboard.map((row) => <button type="button" key={row.profileId} onClick={() => setSelectedId(row.profileId)} className={`grid w-full grid-cols-[4rem_minmax(12rem,1fr)_6rem_6rem_7rem_7rem] items-center gap-3 border-t border-[var(--line)] px-5 py-4 text-left ${selected?.profileId === row.profileId ? "bg-[var(--lime)]/5" : "hover:bg-white/[.03]"}`}><strong className="text-xl text-[var(--lime)]">#{row.rank}</strong><span className="flex min-w-0 items-center gap-3"><PlayerAvatar row={row}/><span className="min-w-0"><strong className="block truncate">{row.name}</strong><small className="text-[var(--muted)]">{ownerLabel(row)}</small></span></span><strong>{row.games}</strong><strong>{row.wins}</strong><strong>{row.winRate.toFixed(0)} %</strong><strong>{row.averagePerDart.toFixed(1)}</strong></button>)}
            </div>
          </>}
        </section>

        {selected && <section className="mt-8 rounded-[1.8rem] border border-[var(--lime)]/45 bg-[var(--panel)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><PlayerAvatar row={selected} size={56}/><div><p className="text-xs font-black uppercase tracking-[.15em] text-[var(--lime)]">Statistiques du joueur</p><h2 className="mt-1 text-3xl font-black">{selected.name}</h2><p className="text-sm text-[var(--muted)]">{ownerLabel(selected)} · {selectedModeLabel}</p></div></div><span className="rounded-full border border-[var(--lime)]/40 bg-[var(--lime)]/10 px-4 py-2 text-sm font-black text-[var(--lime)]">#{selected.rank} du club</span></div>
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
            <Metric label="100+" value={selected.scores100Plus} />
            <Metric label="140+" value={selected.scores140Plus} />
            <Metric label="180" value={selected.scores180} />
            <Metric label="Doubles touchés" value={selected.doublesHit} />
            <Metric label="Triples touchés" value={selected.triplesHit} />
            <Metric label="Bulls touchés" value={selected.bullsHit} />
            <Metric label="Meilleur checkout" value={selected.highestCheckout||"—"} />
            <Metric label="Secteur favori" value={selected.favoriteSector??"—"} />
          </dl>
          {selected.recentForm.length>0&&<div className="mt-6 border-t border-[var(--line)] pt-5"><h3 className="font-black">Forme récente</h3><p className="mt-1 text-sm text-[var(--muted)]">Moyenne par fléchette sur les dix dernières parties.</p><div className="mt-4 flex h-28 items-end gap-2">{selected.recentForm.map((point,index)=><div key={`${point.date}-${index}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[9px] font-bold opacity-0 group-hover:opacity-100">{point.averagePerDart.toFixed(1)}</span><span className="w-full rounded-t bg-[var(--lime)]" style={{height:`${Math.max(6,Math.min(100,point.averagePerDart/60*100))}%`}} title={`${new Date(point.date).toLocaleDateString("fr-FR")} · ${point.averagePerDart.toFixed(1)}`}/></div>)}</div></div>}
        </section>}
        {selected&&data.leaderboard.length>1&&<section className="mt-8 rounded-[1.8rem] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[var(--lime)]">Face-à-face</p><h2 className="mt-1 text-2xl font-black">Comparer deux profils</h2></div><div className="w-full sm:w-64"><SelectField compact value={compareId} ariaLabel="Profil à comparer" options={data.leaderboard.filter(row=>row.profileId!==selected.profileId).map(row=>({value:row.profileId,label:row.name}))} onChange={setCompareId}/></div></div>{compared&&<div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)]"><div className="grid grid-cols-[1fr_5rem_5rem] gap-2 bg-black/20 px-4 py-3 text-sm font-black"><span>Indicateur</span><span className="truncate text-right">{selected.name}</span><span className="truncate text-right">{compared.name}</span></div>{[["Victoires",selected.wins,compared.wins],["Taux",`${selected.winRate.toFixed(0)} %`,`${compared.winRate.toFixed(0)} %`],["Moy./flèche",selected.averagePerDart.toFixed(1),compared.averagePerDart.toFixed(1)],["Meilleur tour",selected.bestTurn,compared.bestTurn],["180",selected.scores180,compared.scores180],["Checkout",selected.highestCheckout,compared.highestCheckout]].map(([label,left,right])=><div key={String(label)} className="grid grid-cols-[1fr_5rem_5rem] gap-2 border-t border-[var(--line)] px-4 py-3 text-sm"><span className="text-[var(--muted)]">{label}</span><strong className="text-right">{left}</strong><strong className="text-right">{right}</strong></div>)}</div>}</section>}
      </>}
    </main>
  );
}
