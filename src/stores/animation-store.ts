import { create } from "zustand";
import type { GameEvent } from "@/src/game-engine/types";

export interface AnimationNotice { id: string; label: string; detail?: string; priority: number; duration: number; }
interface AnimationStore { queue: AnimationNotice[]; enqueueEvents: (events: GameEvent[]) => void; dismiss: () => void; clear: () => void; }

const noticeFor = (event: GameEvent): AnimationNotice | null => {
  const base = { id: crypto.randomUUID(), duration: 1000 };
  switch (event.type) {
    case "BUST": return { ...base, label: "BUST", detail: "Score du tour annulé", priority: 6, duration: 1500 };
    case "CHECKOUT": return { ...base, label: "CHECKOUT", detail: "Sortie réussie", priority: 9, duration: 1800 };
    case "LEG_WON": return { ...base, label: "LEG !", detail: "Leg remporté", priority: 8, duration: 1600 };
    case "SET_WON": return { ...base, label: "SET !", detail: "Set remporté", priority: 9, duration: 1800 };
    case "SCORE_180": return { ...base, label: "180 !", detail: "ONE HUNDRED AND EIGHTY", priority: 8, duration: 1800 };
    case "SCORE_140_PLUS": return { ...base, label: `${event.score}`, detail: "TON 40+", priority: 5, duration: 1400 };
    case "SCORE_100_PLUS": return { ...base, label: `${event.score}`, detail: "TON", priority: 4, duration: 1300 };
    case "SHANGHAI": return { ...base, label: "SHANGHAI !", detail: `Simple · Double · Triple ${event.target}`, priority: 9, duration: 1900 };
    case "CRICKET_CLOSED": return { ...base, label: "FERMÉ", detail: event.target === "bull" ? "Bull fermé" : `Secteur ${event.target} fermé`, priority: 4, duration: 1300 };
    case "KILLER_ACHIEVED": return { ...base, label: "KILLER !", detail: "Vous pouvez attaquer", priority: 7, duration: 1700 };
    case "PLAYER_ELIMINATED": return { ...base, label: "ÉLIMINÉ", detail: "Un joueur quitte la partie", priority: 8, duration: 1700 };
    case "BULL_HIT": return { ...base, label: event.dart.zone === "inner-bull" ? "DOUBLE BULL" : "BULL", detail: `${event.dart.score} points`, priority: 3 };
    case "TRIPLE_HIT": return { ...base, label: "TRIPLE", detail: `${event.dart.score} points`, priority: 2 };
    case "DOUBLE_HIT": return { ...base, label: "DOUBLE", detail: `${event.dart.score} points`, priority: 1 };
    default: return null;
  }
};

export const useAnimationStore = create<AnimationStore>((set) => ({
  queue: [],
  enqueueEvents: (events) => set((state) => ({ queue: [...state.queue, ...events.map(noticeFor).filter((item): item is AnimationNotice => item !== null).sort((a, b) => b.priority - a.priority)] })),
  dismiss: () => set((state) => ({ queue: state.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
