"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { apiRequest } from "@/src/cloud/api";

const subscribeHydration = () => () => undefined;

export function PasswordResetScreen() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    try {
      await apiRequest("/auth/reset-password", { method: "POST", body: JSON.stringify({ username, email, recoveryCode, newPassword: password }) });
      setCompleted(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Réinitialisation impossible."); }
    finally { setSubmitting(false); }
  };

  return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:px-7">{completed?<section className="rounded-[1.6rem] border border-[var(--lime)]/60 bg-[var(--panel)] p-6 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--lime)] text-2xl font-black text-black">✓</span><h1 className="mt-4 text-3xl font-black">Mot de passe modifié</h1><p className="mt-2 leading-6 text-[var(--muted)]">Toutes les anciennes sessions ont été déconnectées. Ton code de récupération a été consommé : génères-en un nouveau depuis ton compte après connexion.</p><Link href="/login" className="mt-6 grid min-h-12 place-items-center rounded-xl bg-[var(--lime)] font-black text-black">Se connecter</Link></section>:<section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5"><Link href="/login" className="text-sm font-bold text-[var(--muted)]">← Retour à la connexion</Link><p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Récupération sans email</p><h1 className="mt-2 text-3xl font-black">Nouveau mot de passe</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Saisis les informations du compte et le code sauvegardé lors de l’inscription ou généré depuis la page Compte.</p><form onSubmit={submit} className="mt-5 space-y-3"><label className="block"><span className="mb-1 block text-sm font-bold">Nom d’utilisateur</span><div className="flex min-h-12 items-center rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4"><span className="text-[var(--muted)]">@</span><input aria-label="Nom d’utilisateur" required minLength={3} maxLength={24} value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" className="min-w-0 flex-1 bg-transparent px-1 outline-none" /></div></label><label className="block"><span className="mb-1 block text-sm font-bold">Adresse email</span><input required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4" /></label><label className="block"><span className="mb-1 block text-sm font-bold">Code de récupération</span><input required value={recoveryCode} onChange={event=>setRecoveryCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="DF-XXXXXX-XXXXXX-XXXXXX-XXXXXX" className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-mono uppercase" /></label><label className="block"><span className="mb-1 block text-sm font-bold">Nouveau mot de passe</span><input required type="password" minLength={8} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4" /></label><label className="block"><span className="mb-1 block text-sm font-bold">Confirmer le mot de passe</span><input required type="password" minLength={8} maxLength={128} value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="new-password" className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4" /></label>{error&&<p role="alert" className="text-sm font-bold text-[#ff9b7a]">{error}</p>}<button disabled={!hydrated||submitting} className="min-h-13 w-full rounded-xl bg-[var(--lime)] font-black text-black disabled:opacity-50">{submitting?"Réinitialisation…":"Créer le nouveau mot de passe"}</button></form></section>}</main>;
}
