"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { GameState } from "@/src/game-engine/types";

interface Props { game: GameState; onClose: () => void; }
interface RuleContent { title: string; introduction: string; sections: { title: string; items: string[] }[]; }

const entryLabel = { straight: "Straight in : toutes les fléchettes peuvent faire entrer dans la partie.", double: "Double in : le décompte commence uniquement après un double ou un bull intérieur.", master: "Master in : le décompte commence après un double, un triple ou un bull intérieur." } as const;
const exitLabel = { straight: "Straight out : n’importe quelle zone peut terminer la partie.", double: "Double out : la dernière fléchette doit être un double ou un bull intérieur.", master: "Master out : la dernière fléchette doit être un double, un triple ou un bull intérieur." } as const;

function rulesFor(game: GameState): RuleContent {
  const state = game.modeState;
  if (state.kind === "count-up") return {
    title: "Count-Up",
    introduction: `Marquez le plus de points possible en ${state.maxRounds} manches.`,
    sections: [
      { title: "Déroulement", items: ["Chaque joueur lance jusqu’à trois fléchettes par tour.", "Tous les impacts sont ajoutés au score : simple ×1, double ×2, triple ×3, bull extérieur 25 et bull intérieur 50."] },
      { title: "Victoire", items: [`Après la ${state.maxRounds}e manche, le joueur avec le score total le plus élevé gagne.`] },
    ],
  };
  if (state.kind === "x01") return {
    title: `${state.startingScore}`,
    introduction: `Partez de ${state.startingScore} et atteignez exactement zéro.`,
    sections: [
      { title: "Entrée et sortie", items: [entryLabel[state.entryRule], exitLabel[state.exitRule]] },
      { title: "Bust", items: ["Le tour est annulé si le score passe sous zéro, si la sortie ne respecte pas la règle choisie ou s’il reste 1 avec une sortie Double/Master.", "Après un bust, le score revient à sa valeur du début du tour et le joueur suivant prend la main."] },
      { title: "Legs et sets", items: [`Il faut gagner ${state.legsToWin} leg${state.legsToWin > 1 ? "s" : ""} pour remporter un set.`, `Il faut gagner ${state.setsToWin} set${state.setsToWin > 1 ? "s" : ""} pour remporter le match.`, "Le joueur qui commence alterne à chaque nouveau leg."] },
      { title: "Limite", items: [state.maxRounds === null ? "Chaque leg est illimité et se termine uniquement sur un checkout." : `Si aucun checkout n’est réalisé après ${state.maxRounds} manches, le joueur le plus proche de zéro gagne le leg.`] },
    ],
  };
  if (state.kind === "around-the-clock") {
    const direction = state.direction === "ascending" ? "du 1 vers le 20" : "du 20 vers le 1";
    const progression = state.progressionRule === "single-only" ? "Seul un simple sur la cible active permet d’avancer d’un secteur." : state.progressionRule === "any-hit" ? "Un simple, un double ou un triple sur la cible active fait avancer d’un seul secteur." : "Un simple fait avancer de 1 secteur, un double de 2 et un triple de 3.";
    return {
      title: "Around the Clock",
      introduction: `Parcourez la cible dans l’ordre, ${direction}.`,
      sections: [
        { title: "Progression", items: [progression, "Un impact sur un autre numéro ne fait pas avancer."] },
        { title: "Arrivée", items: [state.bullFinish ? "Après le dernier numéro, il faut toucher le bull pour gagner." : "La partie est gagnée dès que le dernier numéro est franchi."] },
        { title: "Limite", items: [state.maxRounds === null ? "La partie continue jusqu’à ce qu’un joueur termine le parcours." : `Après ${state.maxRounds} manches, le joueur le plus avancé remporte la partie.`] },
      ],
    };
  }
  if (state.kind === "shanghai") return {
    title: "Shanghai",
    introduction: `Les secteurs sont joués successivement du ${state.startTarget} au ${state.maxRounds}.`,
    sections: [
      { title: "Score", items: ["Seules les fléchettes qui touchent le numéro de la manche en cours rapportent des points.", "Un simple vaut une fois le numéro, un double deux fois et un triple trois fois."] },
      { title: "Shanghai", items: ["Un Shanghai consiste à toucher un simple, un double et un triple du numéro actif pendant le même tour.", state.instantShanghaiWin ? "Dans cette partie, un Shanghai déclenche une victoire immédiate." : "Dans cette partie, un Shanghai ne déclenche pas de victoire immédiate."] },
      { title: "Victoire", items: [`Après le secteur ${state.maxRounds}, le score cumulé le plus élevé gagne.`] },
    ],
  };
  if (state.kind === "cricket") {
    const variant = state.variant === "standard" ? ["Les marques au-delà de la troisième rapportent des points tant qu’au moins un adversaire n’a pas fermé la cible.", "Pour gagner, fermez toutes les cibles avec un score supérieur ou égal à ceux des adversaires."] : state.variant === "no-score" ? ["Aucun point n’est marqué dans cette variante.", "Le premier joueur qui ferme toutes les cibles gagne immédiatement."] : ["Les marques au-delà de la troisième donnent des points aux adversaires qui n’ont pas encore fermé la cible.", "Pour gagner, fermez toutes les cibles avec le score le plus faible."];
    return {
      title: state.variant === "standard" ? "Cricket standard" : state.variant === "no-score" ? "Cricket sans points" : "Cut-Throat Cricket",
      introduction: "Fermez les secteurs 20, 19, 18, 17, 16, 15 et le bull.",
      sections: [
        { title: "Marques", items: ["Il faut trois marques pour fermer une cible : un simple vaut 1 marque, un double 2 et un triple 3.", "Le bull extérieur vaut 1 marque et le bull intérieur 2 marques."] },
        { title: "Règle de cette variante", items: variant },
        { title: "Limite", items: [state.maxRounds === null ? "La partie continue jusqu’à ce qu’un joueur remplisse la condition de victoire." : `Après ${state.maxRounds} manches, les fermetures départagent d’abord les joueurs, puis leur score.`] },
      ],
    };
  }
  return {
    title: "Killer",
    introduction: "Devenez Killer, attaquez les numéros adverses et restez le dernier joueur en vie.",
    sections: [
      { title: "Devenir Killer", items: ["Chaque joueur reçoit un numéro unique entre 1 et 20.", `Il faut obtenir ${state.marksToKiller} marque${state.marksToKiller > 1 ? "s" : ""} sur son propre numéro pour devenir Killer. Un simple vaut 1 marque, un double 2 et un triple 3.`] },
      { title: "Attaquer", items: ["Une fois Killer, toucher le numéro d’un adversaire lui retire 1, 2 ou 3 vies selon le multiplicateur.", state.selfDamage ? "Les auto-dégâts sont actifs : toucher votre propre numéro lorsque vous êtes Killer vous retire aussi des vies." : "Les auto-dégâts sont désactivés : votre propre numéro ne peut pas vous blesser."] },
      { title: "Élimination", items: [`Chaque joueur commence avec ${state.startingLives} vie${state.startingLives > 1 ? "s" : ""}. À zéro vie, il est éliminé et ses tours sont sautés.`, "Le dernier joueur encore en vie remporte la partie."] },
    ],
  };
}

export function GameRulesPanel({ game, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const content = rulesFor(game);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); previousFocus?.focus(); };
  }, [onClose]);

  return <motion.section role="dialog" aria-modal="true" aria-labelledby="game-rules-title" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 260 }} className="fixed inset-0 z-40 overflow-y-auto bg-[#0d0f0e]">
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[#0b0d0c]/95 px-4 py-4 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Règles du jeu</p><h2 id="game-rules-title" className="mt-1 text-2xl font-black">{content.title}</h2></div><button ref={closeButton} type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--line)] text-2xl font-bold leading-none hover:border-[var(--lime)]" aria-label="Fermer les règles">×</button></div>
    </header>
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="rounded-[1.8rem] border border-[var(--lime)]/40 bg-[var(--lime)]/5 p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--lime)]">Objectif</p><p className="mt-2 text-xl font-bold leading-8 sm:text-2xl">{content.introduction}</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{content.sections.map((section) => <article key={section.title} className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6"><h3 className="text-lg font-black">{section.title}</h3><ul className="mt-4 space-y-3">{section.items.map((item) => <li key={item} className="flex gap-3 leading-6 text-[var(--muted)]"><span className="mt-2 size-2 shrink-0 rounded-full bg-[var(--lime)]" aria-hidden="true" /><span>{item}</span></li>)}</ul></article>)}</div>
      <button type="button" onClick={onClose} className="mt-8 min-h-13 w-full rounded-2xl bg-[var(--lime)] px-5 font-black text-black">Retour à la partie</button>
    </div>
  </motion.section>;
}
