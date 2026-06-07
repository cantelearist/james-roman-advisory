"use client";

import { useEffect, createContext, useContext } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const LenisCtx = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisCtx);

export function SmoothProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Shorter duration on mobile — Lenis inertia fights touch swipe otherwise
    const isMobile = window.innerWidth < 768;
    const lenis = new Lenis({
      duration: isMobile ? 0.85 : 1.35,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
    });

    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <LenisCtx.Provider value={null}>
      {children}
    </LenisCtx.Provider>
  );
}
