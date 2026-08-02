"use client";

import type { ClubSummary } from "@dartflow/shared";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useCloud } from "@/components/cloud/CloudProvider";
import { SelectField } from "@/components/ui/SelectField";
import { apiRequest } from "@/src/cloud/api";

export function ClubListScreen() {
  const { user, loading: accountLoading } = useCloud();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [discover, setDiscover] = useState<ClubSummary[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await apiRequest<{ clubs: ClubSummary[]; discover: ClubSummary[] }>("/clubs");
    setClubs(result.clubs); setDiscover(result.discover);
  }, []);
  useEffect(() => { if (!user) return; let active = true; void apiRequest<{ clubs: ClubSummary[]; discover: ClubSummary[] }>("/clubs").then((result) => { if (active) { setClubs(result.clubs); setDiscover(result.discover); } }).catch(() => undefined); return () => { active = false; }; }, [user]);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const result = await apiRequest<{ id: string }>("/clubs", { method: "POST", body: JSON.stringify({ name, description, visibility }) }); window.location.href = `/clubs/${result.id}`; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Création impossible."); setBusy(false); }
  };
  const joinCode = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const result = await apiRequest<{ clubId: string }>("/clubs/join-code", { method: "POST", body: JSON.stringify({ code: inviteCode }) }); window.location.href = `/clubs/${result.clubId}`; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Invitation invalide."); setBusy(false); }
  };
  const requestJoin = async (clubId: string) => { await apiRequest(`/clubs/${clubId}/join`, { method: "POST" }); setMessage("Demande d’adhésion envoyée."); await refresh(); };

  if (accountLoading) return <main className="grid min-h-[60vh] place-items-center text-[var(--muted)]">Chargement…</main>;
  if (!user) return <main className="mx-auto min-h-screen max-w-xl px-4 py-8"><section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 text-center"><h1 className="text-3xl font-black">Connecte-toi pour rejoindre un club</h1><p className="mt-2 text-[var(--muted)]">Les clubs utilisent les comptes pour gérer leurs membres et leurs profils.</p><Link href="/login" className="mt-6 grid min-h-12 place-items-center rounded-xl bg-[var(--lime)] font-black text-black">Se connecter</Link></section></main>;

  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-7">
    <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Communauté</p><h1 className="mt-2 text-4xl font-black tracking-[-.05em]">Clubs</h1><p className="mt-3 max-w-2xl text-[var(--muted)]">Jouez avec les profils du club et suivez un classement réservé à ses parties.</p>
    {message&&<p role="status" className="mt-4 rounded-xl border border-[var(--line)] p-3 text-sm text-[var(--muted)]">{message}</p>}
    <section className="mt-8"><h2 className="text-2xl font-black">Mes clubs</h2>{clubs.length?<div className="mt-4 grid gap-3 md:grid-cols-2">{clubs.map((club)=><Link key={club.id} href={`/clubs/${club.id}`} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 hover:border-[var(--lime)]/60"><div className="flex items-start justify-between gap-3"><div><strong className="text-xl">{club.name}</strong><p className="mt-1 text-sm text-[var(--muted)]">{club.description||"Aucune description"}</p></div><span className="rounded-full bg-[var(--lime)]/10 px-3 py-1 text-xs font-bold text-[var(--lime)]">{club.membershipStatus==="pending"?"En attente":club.role}</span></div><p className="mt-4 text-xs text-[var(--muted)]">{club.memberCount} membre{club.memberCount>1?"s":""} · {club.profileCount} profil{club.profileCount>1?"s":""}</p></Link>)}</div>:<p className="mt-4 rounded-2xl border border-[var(--line)] p-5 text-[var(--muted)]">Tu ne fais encore partie d’aucun club.</p>}</section>
    <div className="mt-10 grid gap-5 lg:grid-cols-2"><section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="text-2xl font-black">Créer un club</h2><form onSubmit={create} className="mt-4 space-y-3"><label className="block"><span className="mb-1 block text-sm font-bold">Nom</span><input required maxLength={60} value={name} onChange={(event)=>setName(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-black/20 px-4"/></label><label className="block"><span className="mb-1 block text-sm font-bold">Description</span><textarea maxLength={300} value={description} onChange={(event)=>setDescription(event.target.value)} className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-black/20 p-4"/></label><SelectField value={visibility} ariaLabel="Visibilité du club" options={[{value:"private",label:"Privé · invitation uniquement"},{value:"public",label:"Public · demandes autorisées"}]} onChange={(value)=>setVisibility(value as "private"|"public")}/><button disabled={busy} className="min-h-12 w-full rounded-xl bg-[var(--lime)] font-black text-black disabled:opacity-50">Créer le club</button></form></section>
      <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="text-2xl font-black">Rejoindre sur invitation</h2><p className="mt-2 text-sm text-[var(--muted)]">Saisis le code transmis par un administrateur.</p><form onSubmit={joinCode} className="mt-4 flex gap-2"><input required value={inviteCode} onChange={(event)=>setInviteCode(event.target.value.trim())} placeholder="Code d’invitation" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-black/20 px-4 font-mono uppercase"/><button disabled={busy} className="rounded-xl border border-[var(--lime)] px-5 font-black text-[var(--lime)]">Rejoindre</button></form></section></div>
    {discover.length>0&&<section className="mt-10"><h2 className="text-2xl font-black">Clubs publics</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{discover.map((club)=><article key={club.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4"><strong>{club.name}</strong><p className="mt-1 min-h-10 text-sm text-[var(--muted)]">{club.description}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs text-[var(--muted)]">{club.memberCount} membres</span><button onClick={()=>void requestJoin(club.id)} className="rounded-lg border border-[var(--lime)] px-3 py-2 text-sm font-bold text-[var(--lime)]">Demander à rejoindre</button></div></article>)}</div></section>}
  </main>;
}
