"use client";

import { memo } from "react";
import { createDart } from "@/src/game-engine/score-calculator";
import type { DartMultiplier, DartThrow, DartZone } from "@/src/game-engine/types";
import { labelPoint, ringPath, segments } from "./geometry";

interface Props { onThrow: (dart: DartThrow) => void; disabled?: boolean; }

const palette = { dark: "#202321", light: "#ddd8c9", red: "#d64232", green: "#25945c" };

export const Dartboard = memo(function Dartboard({ onThrow, disabled = false }: Props) {
  const hit = (segment: number | null, multiplier: DartMultiplier, zone: DartZone) => onThrow(createDart(segment, multiplier, zone));
  return (
    <svg viewBox="0 0 400 400" role="group" aria-label="Cible de fléchettes interactive" className="w-full max-w-[31rem] drop-shadow-[0_24px_45px_rgba(0,0,0,.55)]">
      <circle cx="200" cy="200" r="198" fill="#080908" stroke="#303330" strokeWidth="4" onPointerDown={() => !disabled && hit(null, 0, "miss")} aria-label="Lancer manqué" />
      {segments.map(({ value, index }) => {
        const base = index % 2 === 0 ? palette.dark : palette.light;
        const accent = index % 2 === 0 ? palette.red : palette.green;
        const zones: Array<{ inner: number; outer: number; multiplier: DartMultiplier; zone: DartZone; fill: string; label: string }> = [
          { inner: 24, outer: 93, multiplier: 1, zone: "single-inner", fill: base, label: `Simple ${value}` },
          { inner: 93, outer: 105, multiplier: 3, zone: "triple", fill: accent, label: `Triple ${value}` },
          { inner: 105, outer: 150, multiplier: 1, zone: "single-outer", fill: base, label: `Simple ${value}` },
          { inner: 150, outer: 164, multiplier: 2, zone: "double", fill: accent, label: `Double ${value}` },
        ];
        return zones.map((item) => (
          <path key={`${value}-${item.zone}`} d={ringPath(item.inner, item.outer, index)} fill={item.fill} stroke="#0b0c0b" strokeWidth="1.5"
            className="dart-segment" tabIndex={disabled ? -1 : 0} role="button" aria-label={`${item.label}, ${value * item.multiplier} points`}
            data-segment={value} data-multiplier={item.multiplier} data-score={value * item.multiplier}
            onPointerDown={(event) => { event.stopPropagation(); if (!disabled) hit(value, item.multiplier, item.zone); }}
            onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); hit(value, item.multiplier, item.zone); } }} />
        ));
      })}
      <circle cx="200" cy="200" r="24" fill={palette.green} stroke="#111" strokeWidth="1.5" className="dart-segment" role="button" tabIndex={disabled ? -1 : 0} aria-label="Bull extérieur, 25 points" onPointerDown={(event) => { event.stopPropagation(); if (!disabled) hit(null, 1, "outer-bull"); }} />
      <circle cx="200" cy="200" r="10" fill={palette.red} stroke="#111" strokeWidth="1.5" className="dart-segment" role="button" tabIndex={disabled ? -1 : 0} aria-label="Double bull, 50 points" onPointerDown={(event) => { event.stopPropagation(); if (!disabled) hit(null, 2, "inner-bull"); }} />
      {segments.map(({ value, index }) => { const p = labelPoint(index); return <text key={value} x={p.x} y={p.y} fill="#f4f1e8" fontSize="12" fontWeight="700" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{value}</text>; })}
    </svg>
  );
});
