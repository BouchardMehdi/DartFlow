"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useAnimationStore } from "@/src/stores/animation-store";

export function AnimationOverlay() {
  const notice = useAnimationStore((state) => state.queue[0]);
  const dismiss = useAnimationStore((state) => state.dismiss);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismiss, notice.duration);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);
  return <AnimatePresence>{notice && <motion.div key={notice.id} className="pointer-events-none fixed inset-0 z-10 grid place-items-center p-6" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}><div className="rounded-[2rem] border border-[var(--lime)] bg-black/85 px-10 py-7 text-center shadow-[0_0_70px_rgba(200,240,61,.2)] backdrop-blur-md"><strong className="block text-4xl font-black tracking-[-.05em] text-[var(--lime)] sm:text-6xl">{notice.label}</strong>{notice.detail && <span className="mt-2 block text-sm font-bold uppercase tracking-[.18em] text-white">{notice.detail}</span>}</div></motion.div>}</AnimatePresence>;
}
