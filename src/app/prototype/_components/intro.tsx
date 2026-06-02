"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

export function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 300);   // Logo line
    const t1 = setTimeout(() => setPhase(2), 1000);  // Name reveals
    const t2 = setTimeout(() => setPhase(3), 2000);  // Curtain lifts
    const t3 = setTimeout(() => { setPhase(4); onComplete(); }, 2900); // Done
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase < 4 && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "#070809" }}
          exit={{ y: "-100%" }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          {/* Grain on intro */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "200px 200px",
            }}
          />

          <div className="relative flex flex-col items-center gap-6">
            {/* Horizontal line draws */}
            <div className="w-40 h-px overflow-hidden">
              <motion.div
                className="h-full origin-left"
                style={{ background: "rgba(201,181,138,0.4)" }}
                initial={{ scaleX: 0 }}
                animate={phase >= 1 ? { scaleX: 1 } : {}}
                transition={{ duration: 0.9, ease: EASE }}
              />
            </div>

            {/* JR monogram */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={phase >= 1 ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            >
              <div
                className="size-8 flex items-center justify-center border text-[0.6rem] tracking-widest"
                style={{ borderColor: "rgba(201,181,138,0.35)", color: "#c9b58a" }}
              >
                JR
              </div>
            </motion.div>

            {/* Full name */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={phase >= 2 ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ duration: 0.9, ease: EASE }}
            >
              <p
                className="font-heading text-[1.4rem] tracking-[0.38em] font-light"
                style={{ color: "#ece6d6", letterSpacing: "0.38em" }}
              >
                JAMES ROMAN
              </p>
              <p
                className="text-[0.52rem] tracking-[0.5em] mt-2"
                style={{ color: "#a8b4c0", opacity: 0.55, letterSpacing: "0.5em" }}
              >
                ADVISORY
              </p>
            </motion.div>

            {/* Bottom line */}
            <div className="w-40 h-px overflow-hidden">
              <motion.div
                className="h-full origin-right"
                style={{ background: "rgba(201,181,138,0.4)" }}
                initial={{ scaleX: 0 }}
                animate={phase >= 2 ? { scaleX: 1 } : {}}
                transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              />
            </div>

            {/* Location */}
            <motion.p
              className="text-[0.5rem] tracking-[0.42em] uppercase"
              style={{ color: "#a8b4c0", opacity: 0.35 }}
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 0.35 } : {}}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              Malibu, California
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
