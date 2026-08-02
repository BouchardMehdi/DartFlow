import { CRICKET_TARGETS } from "@/src/game-engine/cricket";
import type { CricketModeState, Player } from "@/src/game-engine/types";

interface Props { state: CricketModeState; players: Player[]; activePlayerId: string | undefined; }
const symbol = (marks: number) => marks <= 0 ? "—" : marks === 1 ? "/" : marks === 2 ? "X" : "⊗";

export function CricketScoreboard({ state, players, activePlayerId }: Props) {
  return <section className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)]" aria-label="Grille Cricket">
    <table className="w-full min-w-[24rem] border-collapse text-center text-sm"><thead><tr className="border-b border-[var(--line)]"><th className="px-3 py-3 text-left text-xs uppercase tracking-wide text-[var(--muted)]">Cible</th>{players.map((player) => <th key={player.id} className={`px-3 py-3 ${player.id === activePlayerId ? "text-[var(--lime)]" : ""}`}>{player.name}<span className="block text-lg tabular-nums">{state.players[player.id]?.score ?? 0}</span></th>)}</tr></thead>
      <tbody>{CRICKET_TARGETS.map((target) => <tr key={target} className="border-b border-[var(--line)] last:border-0"><th className="px-3 py-2.5 text-left text-base font-black">{target === "bull" ? "BULL" : target}</th>{players.map((player) => { const marks = state.players[player.id]?.marks[target] ?? 0; return <td key={player.id} className={`px-3 py-2.5 text-xl font-black ${marks >= 3 ? "text-[var(--lime)]" : ""}`} aria-label={`${player.name}, ${marks} marque${marks > 1 ? "s" : ""} sur ${target}`}>{symbol(marks)}</td>; })}</tr>)}</tbody>
    </table>
  </section>;
}
