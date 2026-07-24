"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;
const SESSION_KEY = "jra_intro_seen";

export function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [showSkip, setShowSkip] = useState(false);

  const skip = useCallback(() => {
    setPhase(4);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Skip intro if already seen this session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) {
        setPhase(4);
        onComplete();
        return;
      }
    } catch {
      // sessionStorage unavailable (private browsing edge case) — proceed normally
    }

    // First visit — play intro then mark seen
    const t0 = setTimeout(() => setPhase(1), 200);
    const t1 = setTimeout(() => setPhase(2), 650);
    const t2 = setTimeout(() => setPhase(3), 1300);
    const t3 = setTimeout(() => {
      setPhase(4);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      onComplete();
    }, 1900);
    const ts = setTimeout(() => setShowSkip(true), 500);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t0); clearTimeout(t1); clearTimeout(t2);
      clearTimeout(t3); clearTimeout(ts);
      window.removeEventListener("keydown", onKey);
    };
  }, [onComplete, skip]);

  return (
    <AnimatePresence>
      {phase < 4 && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "#070809" }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.75, ease: EASE }}
          role="status"
          aria-label="Loading James Roman Advisory"
        >
          {/* Grain */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize:"200px 200px" }}
          />

          {/* Skip button */}
          <AnimatePresence>
            {showSkip && (
              <motion.button
                onClick={skip}
                className="absolute top-6 right-8 text-[0.65rem] uppercase tracking-[0.32em] cursor-pointer transition-opacity duration-300 hover:opacity-100"
                style={{ color: "#b2a898", opacity: 0.45 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                aria-label="Skip intro"
              >
                Skip esc
              </motion.button>
            )}
          </AnimatePresence>

          <div className="relative flex flex-col items-center gap-6">
            <div className="w-40 h-px overflow-hidden">
              <motion.div className="h-full origin-left"
                style={{ background: "rgba(201,181,138,0.4)" }}
                initial={{ scaleX: 0 }}
                animate={phase >= 1 ? { scaleX: 1 } : {}}
                transition={{ duration: 0.7, ease: EASE }} />
            </div>

            <motion.div className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={phase >= 1 ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}>
              <div className="size-8 flex items-center justify-center border text-[0.6rem] tracking-widest"
                style={{ borderColor: "rgba(201,181,138,0.35)", color: "#c9b58a" }}>
                JR
              </div>
            </motion.div>

            <motion.div className="text-center"
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={phase >= 2 ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ duration: 0.8, ease: EASE }}>
              <p className="font-heading text-[1.4rem] tracking-[0.38em] font-light"
                style={{ color: "#ece6d6", letterSpacing: "0.38em" }}>
                JAMES ROMAN
              </p>
              <p className="text-[0.52rem] tracking-[0.5em] mt-2"
                style={{ color: "#b2a898", opacity: 0.6, letterSpacing: "0.5em" }}>
                ADVISORY
              </p>
            </motion.div>

            <div className="w-40 h-px overflow-hidden">
              <motion.div className="h-full origin-right"
                style={{ background: "rgba(201,181,138,0.4)" }}
                initial={{ scaleX: 0 }}
                animate={phase >= 2 ? { scaleX: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.1, ease: EASE }} />
            </div>

            <motion.p className="text-[0.5rem] tracking-[0.42em] uppercase"
              style={{ color: "#b2a898", opacity: 0.38 }}
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 0.38 } : {}}
              transition={{ duration: 0.7, delay: 0.4 }}>
              Malibu, California
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
