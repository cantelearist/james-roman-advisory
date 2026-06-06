"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

// ─── Spotlight cursor ─────────────────────────────────────────────────────────
// A compact radial-gradient glow follows the mouse with spring inertia.
// mix-blend-mode: screen creates an ambient light spill over the dark background.
// A small gold dot marks the precise pointer position.

export function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const [isClick, setIsClick] = useState(false);

  const mx = useMotionValue(-999);
  const my = useMotionValue(-999);

  // Glow follows lazily (luxury drift)
  const gx = useSpring(mx, { stiffness: 55, damping: 22, mass: 1.0 });
  const gy = useSpring(my, { stiffness: 55, damping: 22, mass: 1.0 });

  // Dot is precise
  const dx = useSpring(mx, { stiffness: 500, damping: 34 });
  const dy = useSpring(my, { stiffness: 500, damping: 34 });

  useEffect(() => {
    const move  = (e: MouseEvent) => { mx.set(e.clientX); my.set(e.clientY); setVisible(true); };
    const leave = () => setVisible(false);
    const down  = () => setIsClick(true);
    const up    = () => setIsClick(false);

    const over = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const interactive = el.tagName === "A" || el.tagName === "BUTTON" ||
        !!el.closest("a") || !!el.closest("button") || !!el.dataset.cursor;
      setIsHover(interactive);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseleave", leave);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    document.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      document.removeEventListener("mouseover", over);
    };
  }, [mx, my]);

  const glowSize = isHover ? 280 : isClick ? 150 : 210;
  const glowAlpha = isHover ? 0.13 : isClick ? 0.2 : 0.09;

  return (
    <>
      <style>{`
        @media (pointer: fine) and (min-width: 768px) {
          * { cursor: none !important; }
        }
        @media (pointer: coarse), (max-width: 767px) {
          .jra-custom-cursor { display: none !important; }
        }
      `}</style>

      {/* Spotlight glow — blend-mode screen, drifts lazily */}
      <motion.div
        className="jra-custom-cursor fixed top-0 left-0 pointer-events-none z-[9990] rounded-full"
        style={{
          x: gx, y: gy,
          translateX: "-50%", translateY: "-50%",
          opacity: visible ? 1 : 0,
          mixBlendMode: "screen",
        }}
        animate={{ width: glowSize, height: glowSize }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-full h-full rounded-full" style={{
          background: `radial-gradient(circle, rgba(201,181,138,${glowAlpha}) 0%, rgba(201,181,138,0.04) 45%, transparent 70%)`,
        }} />
      </motion.div>

      {/* Hard vignette ring — barely visible, sharpens the glow edge */}
      <motion.div
        className="jra-custom-cursor fixed top-0 left-0 pointer-events-none z-[9991] rounded-full"
        style={{
          x: gx, y: gy,
          translateX: "-50%", translateY: "-50%",
          opacity: visible ? 0.35 : 0,
        }}
        animate={{ width: glowSize * 0.68, height: glowSize * 0.68 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-full h-full rounded-full" style={{
          background: `radial-gradient(circle, rgba(201,181,138,0.06) 0%, transparent 60%)`,
        }} />
      </motion.div>

      {/* Gold dot — precise, snappy */}
      <motion.div
        className="jra-custom-cursor fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          x: dx, y: dy,
          translateX: "-50%", translateY: "-50%",
          opacity: visible ? 1 : 0,
        }}
        animate={{ width: isHover ? 18 : isClick ? 9 : 12, height: isHover ? 18 : isClick ? 9 : 12 }}
        transition={{ duration: 0.2 }}
      >
        <div className="w-full h-full rounded-full" style={{ background: "#c9b58a" }} />
      </motion.div>

      {/* Hover ring — thin, expands to embrace interactive elements */}
      <motion.div
        className="jra-custom-cursor fixed top-0 left-0 pointer-events-none z-[9998] rounded-full"
        style={{
          x: dx, y: dy,
          translateX: "-50%", translateY: "-50%",
        }}
        animate={{
          width: isHover ? 58 : 0,
          height: isHover ? 58 : 0,
          opacity: isHover ? 0.5 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-full h-full rounded-full" style={{
          border: "1px solid rgba(201,181,138,0.6)",
        }} />
      </motion.div>
    </>
  );
}
