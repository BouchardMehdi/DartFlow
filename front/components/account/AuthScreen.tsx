"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useCloud } from "@/components/cloud/CloudProvider";

export function AuthScreen({ initialMode }: { initialMode: "login" | "register" }) {
  const { user, loading, login, register } = useCloud();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      if (mode === "login") await login(email, password);
      else setRecoveryCode(await register(email, password, username));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connexion impossible."); }
    finally { setSubmitting(false); }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(recoveryCode); setCopied(true);
  };

  if (loading) return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:px-7"><p className="text-[var(--muted)]">Chargement…</p></main>;
  if (recoveryCode && user) return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:px-7"><section className="rounded-[1.6rem] border border-[var(--lime)]/60 bg-[var(--panel)] p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Étape importante</p><h1 className="mt-2 text-3xl font-black">Sauvegarde ton code</h1><p className="mt-3 leading-6 text-[var(--muted)]">Il permettra de réinitialiser le mot de passe de <strong className="text-white">@{user.username}</strong> sans email. Il ne sera plus affiché après cette page.</p><code data-testid="recovery-code" className="mt-5 block break-all rounded-2xl border border-[var(--line)] bg-black/30 p-4 text-center text-lg font-black tracking-wider text-[var(--lime)]">{recoveryCode}</code><button type="button" onClick={()=>void copyCode()} className="mt-3 min-h-11 w-full rounded-xl border border-[var(--lime)] font-black text-[var(--lime)]">{copied?"Code copié":"Copier le code"}</button><button type="button" onClick={()=>setRecoveryCode("")} className="mt-3 min-h-12 w-full rounded-xl bg-[var(--lime)] font-black text-black">J’ai sauvegardé mon code</button></section></main>;
  if (user) return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:px-7"><section className="rounded-[1.6rem] border border-[var(--lime)]/50 bg-[var(--panel)] p-6 text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Connecté</p><h1 className="mt-2 text-3xl font-black">@{user.username}</h1><Link href="/account" className="mt-6 grid min-h-12 place-items-center rounded-xl bg-[var(--lime)] font-black text-black">Ouvrir mon compte</Link></section></main>;

  return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:px-7"><section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5"><div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1.5"><button type="button" onClick={()=>{setMode("login");setError("");}} className={`min-h-11 rounded-xl font-black ${mode==="login"?"bg-[var(--lime)] text-black":"text-[var(--muted)]"}`}>Connexion</button><button type="button" onClick={()=>{setMode("register");setError("");}} className={`min-h-11 rounded-xl font-black ${mode==="register"?"bg-[var(--lime)] text-black":"text-[var(--muted)]"}`}>Inscription</button></div><h1 className="mt-6 text-3xl font-black">{mode==="login"?"Bon retour !":"Créer mon compte"}</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{mode==="login"?"Retrouve tes profils et parties sur tous tes appareils.":"Tes données locales seront associées à ton nouveau compte."}</p><form onSubmit={submit} className="mt-5 space-y-3">{mode==="register"&&<label className="block"><span className="mb-1 block text-sm font-bold">Nom d’utilisateur public</span><div className="flex min-h-12 items-center rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4"><span className="text-[var(--muted)]">@</span><input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" className="min-w-0 flex-1 bg-transparent px-1 outline-none" /></div></label>}<label className="block"><span className="mb-1 block text-sm font-bold">Adresse email</span><input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4" /></label><label className="block"><span className="mb-1 block text-sm font-bold">Mot de passe</span><input type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4" /></label>{mode==="login"&&<div className="text-right"><Link href="/forgot-password" className="text-sm font-bold text-[var(--lime)] hover:underline">Mot de passe oublié ?</Link></div>}{error&&<p role="alert" className="text-sm font-bold text-[#ff9b7a]">{error}</p>}<button disabled={submitting} className="min-h-13 w-full rounded-xl bg-[var(--lime)] font-black text-black disabled:opacity-50">{submitting?"Patiente…":mode==="login"?"Se connecter":"Créer mon compte"}</button></form></section></main>;
}
