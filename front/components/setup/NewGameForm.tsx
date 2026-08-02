"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { aroundTheClockConfigSchema, countUpConfigSchema, cricketConfigSchema, killerConfigSchema, shanghaiConfigSchema, trainingConfigSchema, x01ConfigSchema } from "@/src/database/schemas";
import type { AroundTheClockProgressionRule, CricketVariant, Player, TrainingType, X01EntryRule, X01ExitRule } from "@/src/game-engine/types";
import { useGameStore } from "@/src/stores/game-store";
import { loadPlayers, normalizePlayerName } from "@/src/database/repositories/player-repository";
import type { SavedPlayer } from "@/src/database/database";
import { SelectField } from "@/components/ui/SelectField";

const COLORS = ["#c8f03d", "#ff6b35", "#57b8ff", "#f25f8b", "#b99cff", "#45d6a8", "#ffd166", "#f28f3b"];
const makePlayer = (index: number): Player => ({ id: crypto.randomUUID(), name: `Joueur ${index + 1}`, color: COLORS[index] ?? "#c8f03d", order: index });
type SetupMode = "count-up" | "301" | "501" | "701" | "around-the-clock" | "shanghai" | "cricket" | "killer" | "training-doubles" | "training-triples" | "training-checkout" | "training-bobs-27" | "training-random-target";
const trainingTypeFor = (mode: SetupMode): TrainingType | null => mode.startsWith("training-") ? mode.replace("training-", "") as TrainingType : null;

function shuffled(players: Player[]): Player[] {
  const result = [...players];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = result[index]; const other = result[target];
    if (current && other) { result[index] = other; result[target] = current; }
  }
  return result.map((player, order) => ({ ...player, order }));
}

export function NewGameForm() {
  const router = useRouter();
  const start = useGameStore((store) => store.start);
  const startX01 = useGameStore((store) => store.startX01);
  const startAroundTheClock = useGameStore((store) => store.startAroundTheClock);
  const startShanghai = useGameStore((store) => store.startShanghai);
  const startCricket = useGameStore((store) => store.startCricket);
  const startKiller = useGameStore((store) => store.startKiller);
  const startTraining = useGameStore((store) => store.startTraining);
  const [mode, setMode] = useState<SetupMode>("count-up");
  const [players, setPlayers] = useState<Player[]>(() => [makePlayer(0), makePlayer(1)]);
  const [rounds, setRounds] = useState<number | null>(8);
  const [randomOrder, setRandomOrder] = useState(false);
  const [entryRule, setEntryRule] = useState<X01EntryRule>("straight");
  const [exitRule, setExitRule] = useState<X01ExitRule>("double");
  const [progressionRule, setProgressionRule] = useState<AroundTheClockProgressionRule>("multiplier");
  const [aroundDirection, setAroundDirection] = useState<"ascending" | "descending">("ascending");
  const [bullFinish, setBullFinish] = useState(true);
  const [instantShanghaiWin, setInstantShanghaiWin] = useState(true);
  const [shanghaiStart, setShanghaiStart] = useState(1);
  const [lives, setLives] = useState(3);
  const [marksToKiller, setMarksToKiller] = useState(3);
  const [selfDamage, setSelfDamage] = useState(false);
  const [legsToWin, setLegsToWin] = useState(1);
  const [setsToWin, setSetsToWin] = useState(1);
  const [cricketVariant, setCricketVariant] = useState<CricketVariant>("standard");
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>([]);
  useEffect(() => { let active = true; void loadPlayers().then((profiles) => { if (active) setSavedPlayers(profiles); }).catch(() => undefined); return () => { active = false; }; }, []);
  const isX01 = mode === "301" || mode === "501" || mode === "701";
  const trainingType = trainingTypeFor(mode); const isTraining = trainingType !== null;
  const validation = useMemo(() => mode === "count-up" ? countUpConfigSchema.safeParse({ players, rounds }) : mode === "around-the-clock" ? aroundTheClockConfigSchema.safeParse({ players, progressionRule, direction: aroundDirection, bullFinish, rounds }) : mode === "shanghai" ? shanghaiConfigSchema.safeParse({ players, rounds, startTarget: shanghaiStart, instantShanghaiWin }) : mode === "cricket" ? cricketConfigSchema.safeParse({ players, rounds, variant: cricketVariant }) : mode === "killer" ? killerConfigSchema.safeParse({ players, lives, marksToKiller, selfDamage }) : trainingType ? trainingConfigSchema.safeParse({ players, trainingType, rounds: rounds ?? 10 }) : x01ConfigSchema.safeParse({ players, startingScore: Number(mode), entryRule, exitRule, rounds, legsToWin, setsToWin }), [players, rounds, mode, trainingType, entryRule, exitRule, progressionRule, aroundDirection, bullFinish, instantShanghaiWin, shanghaiStart, lives, marksToKiller, selfDamage, legsToWin, setsToWin, cricketVariant]);
  const hasDuplicateProfiles = useMemo(() => { const identities = players.map((player) => savedPlayers.some((profile) => profile.id === player.id) ? `profile:${player.id}` : `new:${normalizePlayerName(player.name)}`).filter(Boolean); return new Set(identities).size !== identities.length; }, [players, savedPlayers]);
  const canSubmit = validation.success && !hasDuplicateProfiles;

  const setPlayerCount = (count: number) => {
    setPlayers((current) => count > current.length
      ? [...current, ...Array.from({ length: count - current.length }, (_, index) => makePlayer(current.length + index))]
      : current.slice(0, count));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const profilesByName = new Map(savedPlayers.filter((profile) => !profile.cloudRole || profile.cloudRole === "owner").map((profile) => [normalizePlayerName(profile.name), profile]));
    const resolvedPlayers = players.map((player, order) => {
      const profile = savedPlayers.find((item) => item.id === player.id) ?? profilesByName.get(normalizePlayerName(player.name));
      if (!profile) return { ...player, name: player.name.trim().replace(/\s+/g, " "), order };
      return { id: profile.id, name: profile.name, order, ...(profile.color ? { color: profile.color } : {}), ...(profile.avatar ? { avatar: profile.avatar } : {}), ...(profile.ownerUserId ? { ownerUserId: profile.ownerUserId } : {}), ...(profile.ownerUsername ? { ownerUsername: profile.ownerUsername } : {}) };
    });
    const ordered = randomOrder ? shuffled(resolvedPlayers) : resolvedPlayers;
    if (mode === "count-up") start(ordered, rounds ?? 8);
    else if (mode === "around-the-clock") startAroundTheClock(ordered, progressionRule, bullFinish, rounds, aroundDirection);
    else if (mode === "shanghai") startShanghai(ordered, rounds ?? 7, instantShanghaiWin, shanghaiStart);
    else if (mode === "cricket") startCricket(ordered, rounds, cricketVariant);
    else if (mode === "killer") startKiller(ordered, lives, selfDamage, marksToKiller);
    else if (trainingType) startTraining(ordered, trainingType, rounds ?? 10);
    else startX01(ordered, Number(mode) as 301 | 501 | 701, entryRule, exitRule, rounds, legsToWin, setsToWin);
    router.push("/game");
  };

  const selectProfile = (index: number, profileId: string) => setPlayers((current) => current.map((player, playerIndex) => {
    if (playerIndex !== index) return player;
    if (!profileId) return makePlayer(index);
    const profile = savedPlayers.find((item) => item.id === profileId); if (!profile || current.some((item, itemIndex) => itemIndex !== index && item.id === profile.id)) return player;
    return { id: profile.id, name: profile.name, order: player.order, ...(profile.color ? { color: profile.color } : {}), ...(profile.avatar ? { avatar: profile.avatar } : {}), ...(profile.ownerUserId ? { ownerUserId: profile.ownerUserId } : {}), ...(profile.ownerUsername ? { ownerUsername: profile.ownerUsername } : {}) };
  }));

  const updatePlayerName = (index: number, name: string) => setPlayers((current) => current.map((player, playerIndex) => {
    if (playerIndex !== index) return player;
    const linkedProfile = savedPlayers.find((profile) => profile.id === player.id);
    const id = linkedProfile && normalizePlayerName(name) !== normalizePlayerName(linkedProfile.name) ? crypto.randomUUID() : player.id;
    return { ...player, id, name };
  }));

  const linkExistingProfile = (index: number) => setPlayers((current) => current.map((player, playerIndex) => {
    if (playerIndex !== index) return player;
    const profile = savedPlayers.find((item) => (!item.cloudRole || item.cloudRole === "owner") && normalizePlayerName(item.name) === normalizePlayerName(player.name));
    if (!profile || current.some((item, itemIndex) => itemIndex !== index && item.id === profile.id)) return player;
    return { id: profile.id, name: profile.name, order: player.order, ...(profile.color ? { color: profile.color } : {}), ...(profile.avatar ? { avatar: profile.avatar } : {}), ...(profile.ownerUserId ? { ownerUserId: profile.ownerUserId } : {}), ...(profile.ownerUsername ? { ownerUsername: profile.ownerUsername } : {}) };
  }));

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-5 sm:px-7">
      <header className="mb-8 flex items-center justify-between border-b border-[var(--line)] pb-4">
        <Link href="/" className="font-bold text-[var(--muted)] hover:text-white">← Accueil</Link>
        <span className="text-sm font-black tracking-[.14em]">NOUVELLE PARTIE</span>
      </header>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
            <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">01 · Mode de jeu</span>
            <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Mode</span><SelectField value={mode} ariaLabel="Mode de jeu" options={[{ value: "count-up", label: "Count‑Up" }, { value: "301", label: "301" }, { value: "501", label: "501" }, { value: "701", label: "701" }, { value: "around-the-clock", label: "Around the Clock" }, { value: "shanghai", label: "Shanghai" }, { value: "cricket", label: "Cricket standard" }, { value: "killer", label: "Killer" }, { value: "training-doubles", label: "Entraînement aux doubles" }, { value: "training-triples", label: "Entraînement aux triples" }, { value: "training-checkout", label: "Checkout Challenge" }, { value: "training-bobs-27", label: "Bob’s 27" }, { value: "training-random-target", label: "Cible aléatoire" }]} onChange={(value) => { const nextMode = value as SetupMode; setMode(nextMode); if ((nextMode === "count-up" || nextMode === "shanghai" || nextMode.startsWith("training-")) && rounds === null) setRounds(nextMode === "shanghai" ? 7 : 10); if (nextMode === "killer" && players.length < 2) setPlayerCount(2); if (nextMode.startsWith("training-") && players.length !== 1) setPlayerCount(1); }} /></label>
            <div className="mt-4 rounded-xl bg-black/20 p-4"><p className="font-bold">{mode === "count-up" ? "Le plus gros score gagne" : mode === "around-the-clock" ? "Faites le tour de la cible" : mode === "shanghai" ? "Marquez sur le secteur de la manche" : mode === "cricket" ? "Fermez 20 à 15 et le Bull" : mode === "killer" ? "Devenez Killer et éliminez vos adversaires" : mode === "training-doubles" ? "Travaillez tous les doubles" : mode === "training-triples" ? "Travaillez tous les triples" : mode === "training-checkout" ? "Terminez des scores aléatoires" : mode === "training-bobs-27" ? "Testez votre régularité sur les doubles" : mode === "training-random-target" ? "Visez une nouvelle cible à chaque fléchette" : `Atteignez exactement zéro depuis ${mode}`}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{mode === "count-up" ? "Chaque joueur lance trois fléchettes par manche. Tous les points sont additionnés." : mode === "around-the-clock" ? "Touchez les secteurs dans l’ordre, de 1 à 20, puis éventuellement le bull." : mode === "shanghai" ? "Réalisez un simple, un double et un triple du numéro actif pour faire Shanghai." : mode === "cricket" ? "Trois marques ferment un secteur. Les marques excédentaires rapportent des points tant qu’un adversaire reste ouvert." : mode === "killer" ? "Faites trois marques sur votre numéro, puis retirez les vies des autres joueurs." : mode === "training-doubles" || mode === "training-triples" ? "Trois fléchettes sur chaque cible, du 1 au 20." : mode === "training-checkout" ? "Vous disposez de trois fléchettes par checkout, en Double Out." : mode === "training-bobs-27" ? "Partez de 27 points et jouez successivement D1 à D20." : mode === "training-random-target" ? "Une cible simple, double, triple ou bull est tirée après chaque lancer." : "Un dépassement ou une sortie invalide provoque un bust et annule le tour."}</p></div>
          </section>

          <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
            <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">02 · Règles</span>
            {mode !== "killer" && mode !== "training-doubles" && mode !== "training-triples" && mode !== "training-bobs-27" && <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">{isTraining ? "Nombre de défis" : "Nombre de manches"}</span><SelectField value={String(rounds ?? "infinite")} ariaLabel={isTraining ? "Nombre de défis" : "Nombre de manches"} options={[...[5, 7, 8, 10, 15, 20].map((value) => ({ value: String(value), label: `${value} ${isTraining ? "défis" : "manches"}` })), ...(!isTraining && mode !== "count-up" && mode !== "shanghai" ? [{ value: "infinite", label: "Infini — jusqu’à la victoire" }] : [])]} onChange={(value) => { const nextRounds = value === "infinite" ? null : Number(value); setRounds(nextRounds); if (mode === "shanghai" && nextRounds !== null) setShanghaiStart((current) => Math.min(current, nextRounds)); }} /></label>}
            {isX01 && <><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Entrée</span><SelectField value={entryRule} ariaLabel="Règle d’entrée" options={[{ value: "straight", label: "Straight in" }, { value: "double", label: "Double in" }, { value: "master", label: "Master in" }]} onChange={(value) => setEntryRule(value as X01EntryRule)} /></label><label><span className="mb-2 block text-sm font-bold">Sortie</span><SelectField value={exitRule} ariaLabel="Règle de sortie" options={[{ value: "straight", label: "Straight out" }, { value: "double", label: "Double out" }, { value: "master", label: "Master out" }]} onChange={(value) => setExitRule(value as X01ExitRule)} /></label></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Legs pour gagner un set</span><SelectField value={String(legsToWin)} ariaLabel="Legs pour gagner un set" options={[1, 2, 3, 4, 5, 7, 9].map((value) => ({ value: String(value), label: String(value) }))} onChange={(value) => setLegsToWin(Number(value))} /></label><label><span className="mb-2 block text-sm font-bold">Sets pour gagner</span><SelectField value={String(setsToWin)} ariaLabel="Sets pour gagner" options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) }))} onChange={(value) => setSetsToWin(Number(value))} /></label></div></>}
            {mode === "around-the-clock" && <div className="mt-4 space-y-3"><label className="block"><span className="mb-2 block text-sm font-bold">Progression</span><SelectField value={progressionRule} ariaLabel="Règle de progression" options={[{ value: "single-only", label: "Simple obligatoire · +1" }, { value: "any-hit", label: "Tout multiplicateur · +1" }, { value: "multiplier", label: "Double +2 · Triple +3" }]} onChange={(value) => setProgressionRule(value as AroundTheClockProgressionRule)} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Sens</span><SelectField value={aroundDirection} ariaLabel="Sens de progression" options={[{ value: "ascending", label: "1 vers 20" }, { value: "descending", label: "20 vers 1" }]} onChange={(value) => setAroundDirection(value as "ascending" | "descending")} /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3"><input type="checkbox" checked={bullFinish} onChange={(event) => setBullFinish(event.target.checked)} className="size-5 accent-[var(--lime)]" /><span className="font-bold">Bull final obligatoire</span></label></div>}
            {mode === "shanghai" && <label className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] p-3"><input type="checkbox" checked={instantShanghaiWin} onChange={(event) => setInstantShanghaiWin(event.target.checked)} className="size-5 accent-[var(--lime)]" /><span><strong className="block">Victoire immédiate sur un Shanghai</strong><span className="text-sm text-[var(--muted)]">Simple, double et triple du numéro actif.</span></span></label>}
            {mode === "shanghai" && <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Premier secteur</span><SelectField value={String(shanghaiStart)} ariaLabel="Premier secteur" options={Array.from({ length: Math.max(1, rounds ?? 7) }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} onChange={(value) => setShanghaiStart(Number(value))} /></label>}
            {mode === "killer" && <div className="mt-4 space-y-3"><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Vies par joueur</span><SelectField value={String(lives)} ariaLabel="Vies par joueur" options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} vie${value > 1 ? "s" : ""}` }))} onChange={(value) => setLives(Number(value))} /></label><label><span className="mb-2 block text-sm font-bold">Marques pour devenir Killer</span><SelectField value={String(marksToKiller)} ariaLabel="Marques pour devenir Killer" options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) }))} onChange={(value) => setMarksToKiller(Number(value))} /></label></div><label className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3"><input type="checkbox" checked={selfDamage} onChange={(event) => setSelfDamage(event.target.checked)} className="size-5 accent-[var(--lime)]" /><span><strong className="block">Auto-dégâts activés</strong><span className="text-sm text-[var(--muted)]">Un Killer perd des vies s’il touche son propre numéro.</span></span></label></div>}
            {mode === "cricket" && <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Variante</span><SelectField value={cricketVariant} ariaLabel="Variante du Cricket" options={[{ value: "standard", label: "Cricket standard" }, { value: "no-score", label: "Cricket sans points" }, { value: "cut-throat", label: "Cut‑Throat Cricket" }]} onChange={(value) => setCricketVariant(value as CricketVariant)} /></label>}
          </section>
        </div>

        <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
          <span className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">03 · Joueurs</span>
          {savedPlayers.length > 0 && <div className="mt-4 rounded-xl bg-black/20 p-3"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--muted)]">Profils enregistrés</p><p className="mt-1 text-sm text-[var(--muted)]">Chaque emplacement peut utiliser un profil différent.</p></div>}
          <div className="mt-4 flex items-center justify-between"><div><p className="font-bold">Nombre de joueurs</p><p className="text-sm text-[var(--muted)]">{isTraining ? "Un seul joueur en entraînement" : "De 1 à 8 sur cet appareil"}</p></div><div className="flex items-center gap-3"><button type="button" aria-label="Retirer un joueur" disabled={players.length === 1 || isTraining} onClick={() => setPlayerCount(players.length - 1)} className="grid size-11 place-items-center rounded-xl border border-[var(--line)] text-xl disabled:opacity-30">−</button><strong className="w-5 text-center text-xl">{players.length}</strong><button type="button" aria-label="Ajouter un joueur" disabled={players.length === 8 || isTraining} onClick={() => setPlayerCount(players.length + 1)} className="grid size-11 place-items-center rounded-xl border border-[var(--line)] text-xl disabled:opacity-30">+</button></div></div>

          <div className="mt-5 space-y-4">{players.map((player, index) => { const linkedProfileId = savedPlayers.some((profile) => profile.id === player.id) ? player.id : ""; return <div key={`player-slot-${index}`} className="flex items-start gap-3"><span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full text-sm font-black text-black" style={{ background: player.color }}>{index + 1}</span><div className="grid min-w-0 flex-1 gap-2">{savedPlayers.length > 0 && <SelectField value={linkedProfileId} ariaLabel={`Profil du joueur ${index + 1}`} compact options={[{ value: "", label: "Nouveau profil" }, ...savedPlayers.map((profile) => ({ value: profile.id, label: profile.cloudRole && profile.cloudRole !== "owner" ? `${profile.name} · @${profile.ownerUsername ?? "ami"}` : profile.name, disabled: players.some((item, itemIndex) => itemIndex !== index && item.id === profile.id) }))]} onChange={(value) => selectProfile(index, value)} />}{linkedProfileId === "" && <label><span className="sr-only">Pseudo du joueur {index + 1}</span><input value={player.name} maxLength={40} onChange={(event) => updatePlayerName(index, event.target.value)} onBlur={() => linkExistingProfile(index)} className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-[#0d0f0e] px-4 font-bold" /></label>}</div></div>; })}</div>

          {!isTraining && <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] p-4"><input type="checkbox" checked={randomOrder} onChange={(event) => setRandomOrder(event.target.checked)} className="mt-1 size-5 accent-[var(--lime)]" /><span><strong className="block">Ordre de passage aléatoire</strong><span className="mt-1 block text-sm text-[var(--muted)]">Les joueurs seront mélangés au démarrage de la partie.</span></span></label>}

          {!canSubmit && <p role="alert" className="mt-4 text-sm font-bold text-[#ff8b65]">{mode === "killer" && players.length < 2 ? "Killer nécessite au moins deux joueurs." : hasDuplicateProfiles ? "Un même profil ne peut pas jouer deux fois dans la même partie." : "Chaque joueur doit avoir un pseudo."}</p>}
          <button type="submit" disabled={!canSubmit} className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--lime)] px-6 font-black text-black disabled:cursor-not-allowed disabled:opacity-35">Démarrer la partie →</button>
        </section>
      </form>
    </main>
  );
}
