"use client";

import Link from "next/link";
import { useCloud } from "@/components/cloud/CloudProvider";

export function AuthMenuActions(){const{user,loading}=useCloud();if(loading)return <div className="h-12"/>;return user?<div className="mt-4 flex flex-wrap gap-2"><Link href="/account" className="rounded-xl bg-[var(--lime)] px-5 py-3 font-black text-black">@{user.username}</Link><Link href="/account#friends" className="rounded-xl border border-[var(--line)] px-5 py-3 font-bold">Mes amis</Link></div>:<div className="mt-4 grid gap-3 sm:grid-cols-2"><Link href="/login" className="grid min-h-13 place-items-center rounded-xl border-2 border-[var(--lime)] px-6 font-black text-[var(--lime)]">Se connecter</Link><Link href="/register" className="grid min-h-13 place-items-center rounded-xl bg-[var(--lime)] px-6 font-black text-black">Créer un compte</Link></div>;}
