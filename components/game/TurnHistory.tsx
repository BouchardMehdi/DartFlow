import type { Player, Turn } from "@/src/game-engine/types";

interface Props { turns: Turn[]; players: Player[]; }

const dartLabel = (turn: Turn, index: number) => {
  const dart = turn.darts[index];
  if (!dart) return "—";
  if (dart.zone === "miss") return "MISS";
  if (dart.zone === "inner-bull") return "BULL 50";
  if (dart.zone === "outer-bull") return "BULL 25";
  const prefix = dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S";
  return `${prefix}${dart.segment}`;
};

export function TurnHistory({ turns, players }: Props) {
  const turn = turns.at(-1);
  const player = turn ? players.find((item) => item.id === turn.playerId) : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]" aria-labelledby="turn-history-title">
      <div className="flex items-center justify-between px-4 py-3">
        <div><h2 id="turn-history-title" className="text-sm font-black uppercase tracking-[.14em]">Dernier tour</h2><p className="mt-0.5 text-xs text-[var(--muted)]">Le joueur précédent</p></div>
      </div>
      {!turn ? <p className="border-t border-[var(--line)] px-4 py-5 text-center text-sm text-[var(--muted)]">Le premier tour apparaîtra ici.</p> : <div className="border-t border-[var(--line)] px-4 py-3">
            <div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: player?.color ?? "var(--muted)" }} /><strong className="truncate text-sm">{player?.name ?? "Joueur"}</strong><span className="text-xs text-[var(--muted)]">M{turn.roundNumber}</span></span><span className={`text-sm font-black ${turn.isBust ? "text-[#ff8b65]" : "text-[var(--lime)]"}`}>{turn.isBust ? "BUST" : `+${turn.turnScore}`}</span></div>
            <div className="mt-2 grid grid-cols-3 gap-2">{[0, 1, 2].map((dartIndex) => <span key={dartIndex} className="rounded-lg bg-black/25 px-2 py-1.5 text-center text-xs font-bold text-[var(--muted)]">{dartLabel(turn, dartIndex)}</span>)}</div>
          </div>}
    </section>
  );
}
