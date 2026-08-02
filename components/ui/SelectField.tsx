"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption { value: string; label: string; disabled?: boolean; }
interface Props { value: string; options: SelectOption[]; onChange: (value: string) => void; ariaLabel: string; compact?: boolean; }

export function SelectField({ value, options, onChange, ariaLabel, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const wrapper = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const nextEnabled = (start: number, direction: 1 | -1) => {
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (start + direction * offset + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return start;
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value); setActiveIndex(index); setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) { setOpen(true); setActiveIndex(selectedIndex); }
      else setActiveIndex((current) => nextEnabled(current, direction));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (open) choose(activeIndex); else { setOpen(true); setActiveIndex(selectedIndex); }
    } else if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); }
  };

  return <div ref={wrapper} className="relative min-w-0 w-full">
    <button type="button" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined} onClick={() => { setOpen((visible) => !visible); setActiveIndex(selectedIndex); }} onKeyDown={handleKeyDown} className={`${compact ? "min-h-11 px-3 text-sm" : "min-h-12 px-4"} flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#0d0f0e] text-left font-bold hover:border-[var(--muted)]`}>
      <span className="min-w-0 flex-1 truncate">{selected?.label ?? "Sélectionner"}</span><span aria-hidden="true" className={`shrink-0 text-xs text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
    </button>
    {open && <div id={listboxId} role="listbox" aria-label={ariaLabel} className="absolute left-0 right-0 top-[calc(100%+.35rem)] z-50 max-h-64 w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-xl border border-[var(--line)] bg-[#0d0f0e] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.65)]">
      {options.map((option, index) => <button id={`${listboxId}-${index}`} key={option.value} type="button" role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} disabled={option.disabled} onPointerMove={() => { if (!option.disabled) setActiveIndex(index); }} onClick={() => choose(index)} className={`block min-h-10 w-full min-w-0 truncate rounded-lg px-3 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35 ${index === activeIndex ? "bg-[var(--lime)] text-black" : option.value === value ? "bg-[var(--lime)]/10 text-[var(--lime)]" : "hover:bg-white/5"}`} title={option.label}>{option.label}</button>)}
    </div>}
  </div>;
}
