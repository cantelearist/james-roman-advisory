"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ConsultationForm } from "@/components/consultation-form";
import { SmoothProvider } from "./_components/smooth";
import { CustomCursor } from "./_components/cursor";
import { IntroSequence } from "./_components/intro";

// ─── Design tokens ────────────────────────────────────────────────────────────
const TITAN  = "#b2a898";   // warm titanium/bronze — secondary text
const GOLD   = "#c9b58a";   // warm gold — accents, CTAs, key highlights
const CREAM  = "#ece6d6";   // primary text
const BG     = "#0a0b0e";
const EASE   = [0.16, 1, 0.3, 1] as const;
const SECTION_H = "clamp(2.18rem,3.55vw,4.5rem)";
const SUB_H = "clamp(1.25rem,1.8vw,2.05rem)";
const BODY = "1.05rem";

// Origin section is the typographic reference:
// heading: clamp(2.6rem, 4vw, 5rem) | body: 1.08rem | label: 0.8rem

function useHydratedReducedMotion() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return mounted && reduced;
}

// ─── Grain ────────────────────────────────────────────────────────────────────
function Grain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] opacity-[0.03] mix-blend-overlay"
      style={{ backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize:"200px 200px" }}
    />
  );
}

// ─── Line ─────────────────────────────────────────────────────────────────────
function Line({ delay=0 }: { delay?:number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true });
  const reduced = useHydratedReducedMotion();
  return (
    <div ref={ref} className="overflow-hidden w-full">
      <motion.div className="h-px" style={{ background:"rgba(201,181,138,0.15)", originX:0 }}
        initial={reduced ? { scaleX:1 } : { scaleX:0 }}
        animate={inView ? { scaleX:1 } : {}}
        transition={{ duration:1.8, delay, ease:EASE }} />
    </div>
  );
}

// ─── Fade ─────────────────────────────────────────────────────────────────────
function Fade({ children, delay=0, className="" }: { children:React.ReactNode; delay?:number; className?:string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-6% 0px" });
  const reduced = useHydratedReducedMotion();
  return (
    <motion.div ref={ref} className={className}
      initial={reduced ? { opacity:1, y:0 } : { opacity:0, y:28 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:1.3, delay, ease:EASE }}>
      {children}
    </motion.div>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
function Label({ children, delay=0, center=false }: { children:React.ReactNode; delay?:number; center?:boolean }) {
  return (
    <Fade delay={delay}>
      <p className={`text-[0.78rem] uppercase tracking-[0.34em] mb-7 ${center?"text-center":""}`}
        style={{ color:TITAN, opacity:0.82 }}>{children}</p>
    </Fade>
  );
}

// ─── Multi-color heading ──────────────────────────────────────────────────────
type CW = { text:string; color:string };
function RichH({
  lines, size=SECTION_H, className="", baseDelay=0, center=false, blur=false,
}: {
  lines:CW[][]; size?:string; className?:string; baseDelay?:number; center?:boolean; blur?:boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-8% 0px" });
  const reduced = useHydratedReducedMotion();
  let idx = 0;
  const from = reduced ? { opacity:1, y:0, filter:"blur(0px)" }
    : blur ? { opacity:0, y:20, filter:"blur(8px)" }
    : { opacity:0, y:18, filter:"blur(0px)" };
  return (
    <h2 ref={ref} className={`font-heading font-light leading-[0.93] tracking-[-0.025em] ${center?"text-center":""} ${className}`}
      style={{ fontSize:size, textShadow:"0 2px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)" }}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.map((seg) => seg.text.split(" ").filter(Boolean).map((word) => {
            const i = idx++;
            return (
              <motion.span key={i} className="inline-block mr-[0.22em]" style={{ color:seg.color }}
                initial={from}
                animate={inView ? { opacity:1, y:0, filter:"blur(0px)" } : {}}
                transition={{ duration: blur ? 1.15 : 0.9, delay:baseDelay + i*0.08, ease:EASE }}>
                {word}
              </motion.span>
            );
          }))}
        </span>
      ))}
    </h2>
  );
}

// ─── Parallax image ───────────────────────────────────────────────────────────
function ParallaxImg({ src, alt, speed=0.14, className="", imageClassName }: {
  src:string; alt:string; speed?:number; className?:string; imageClassName?:string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target:ref, offset:["start end","end start"] });
  const y = useTransform(scrollYProgress, [0,1], [`${-speed*100}%`,`${speed*100}%`]);
  return (
    <div ref={ref} className={`overflow-hidden ${className || "relative h-full"}`}>
      <motion.div style={{ y }} className="absolute inset-x-0 -top-[16%] bottom-[-16%]">
        <Image
          src={src}
          alt={alt}
          fill
          className={imageClassName ?? "object-cover object-center saturate-[0.45] contrast-[0.88] brightness-[0.85]"}
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      </motion.div>
    </div>
  );
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ value, suffix="" }: { value:number; suffix?:string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once:true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let s = 0;
    const dur = 1400;
    const step = (ts:number) => {
      if (!s) s = ts;
      const p = Math.min((ts-s)/dur,1);
      setN(Math.round((1-Math.pow(1-p,3))*value));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once:true });
  const bars = [55,78,42,95,68,82,51];
  const W=148, H=52, bW=14, g=6;
  return (
    <svg ref={ref} width={W} height={H+16} className="overflow-visible">
      {bars.map((v,i) => {
        const bh=(v/100)*H, x=i*(bW+g);
        return <g key={i}>
          <motion.rect x={x} width={bW} rx={2}
            style={{ fill: i===3 ? GOLD : `rgba(201,181,138,0.25)` }}
            initial={{ height:0, y:H }} animate={inView ? { height:bh, y:H-bh } : {}}
            transition={{ duration:1.0, delay:0.3+i*0.07, ease:EASE }} />
          <text x={x+bW/2} y={H+12} textAnchor="middle"
            style={{ fontSize:7, fill:TITAN, opacity:0.5, fontFamily:"inherit" }}>
            {"MTWTFSS"[i]}
          </text>
        </g>;
      })}
    </svg>
  );
}

// ─── Mini line chart ─────────────────────────────────────────────────────────
function LineChart() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once:true });
  const pts = [0.82,0.65,0.48,0.38,0.30,0.26,0.22,0.20,0.17,0.14,0.12,0.10];
  const W=164, H=44;
  const d = pts.map((v,i) => `${i===0?"M":"L"} ${(i/(pts.length-1))*W} ${v*H}`).join(" ");
  const area = d + ` L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg ref={ref} width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity={0.28}/>
          <stop offset="100%" stopColor={GOLD} stopOpacity={0.02}/>
        </linearGradient>
      </defs>
      <motion.path d={area} fill="url(#lg)" initial={{ opacity:0 }}
        animate={inView ? { opacity:1 } : {}} transition={{ duration:1.2, delay:0.6, ease:EASE }} />
      <motion.path d={d} fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round"
        initial={{ pathLength:0, opacity:0 }}
        animate={inView ? { pathLength:1, opacity:0.75 } : {}}
        transition={{ duration:2.0, delay:0.4, ease:EASE }} />
      <motion.circle cx={W} cy={pts[pts.length-1]*H} r={3.5} fill={GOLD}
        initial={{ scale:0 }} animate={inView ? { scale:1 } : {}}
        transition={{ duration:0.4, delay:2.3, ease:[0.34,1.56,0.64,1] }} />
    </svg>
  );
}

// ─── Portal progress bar ─────────────────────────────────────────────────────
function PortalProgressBar({ label, detail, delay=0 }: {
  label:string; detail:string; delay?:number;
}) {
  const reduced = useHydratedReducedMotion();
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.72rem]" style={{ color:TITAN, opacity:0.55 }}>{label}</span>
        <span className="text-[0.7rem]" style={{ color:GOLD, opacity:0.65 }}>{detail}</span>
      </div>
      <div className="h-px relative overflow-hidden" style={{ background:"rgba(201,181,138,0.07)" }}>
        <motion.div className="absolute inset-y-0 left-0 origin-left"
          style={{ background:"linear-gradient(to right,rgba(201,181,138,0.25),rgba(201,181,138,0.72))" }}
          initial={reduced ? { scaleX:1 } : { scaleX:0 }}
          whileInView={{ scaleX:1 }}
          viewport={{ once:true, margin:"-8% 0px" }}
          transition={{ duration:1.35, delay, ease:EASE }} />
      </div>
    </div>
  );
}

// ─── Practice rows ────────────────────────────────────────────────────────────
const ROWS = [
  { n:"01", title:"Mold and Water Damage", body:"Moisture mapping, containment strategy, clearance standards, and contractor performance reviewed before damage turns into a second problem." },
  { n:"02", title:"Fire and Smoke Residue", body:"Residue testing, odor pathways, cleaning protocols, and documentation tracked so restoration decisions are based on evidence, not pressure." },
  { n:"03", title:"Asbestos and Legacy Materials", body:"Legacy materials identified, sampled, abated, and closed out with the right custody trail before renovation or rebuild work moves forward." },
  { n:"04", title:"Indoor Air Quality and VOCs", body:"Airborne particulate, volatile organic compounds, and post-remediation clearance coordinated with independent testing and readable reporting." },
  { n:"05", title:"Pre-Sale Diligence", body:"Environmental and structural risk reviewed before acquisition, listing, or negotiation so hidden liability does not arrive after the transaction." },
  { n:"06", title:"Contractor Procurement", body:"License, insurance, bonding, scope, and field performance reviewed before any crew steps on site. Every contract questioned before it is signed." },
];

const STAR_POINTS = [
  { left: "8%", top: "7%", opacity: 0.23 },
  { left: "16%", top: "18%", opacity: 0.32 },
  { left: "24%", top: "10%", opacity: 0.18 },
  { left: "31%", top: "27%", opacity: 0.29 },
  { left: "38%", top: "6%", opacity: 0.2 },
  { left: "43%", top: "23%", opacity: 0.36 },
  { left: "49%", top: "13%", opacity: 0.24 },
  { left: "55%", top: "31%", opacity: 0.18 },
  { left: "61%", top: "8%", opacity: 0.33 },
  { left: "67%", top: "21%", opacity: 0.25 },
  { left: "73%", top: "12%", opacity: 0.37 },
  { left: "79%", top: "28%", opacity: 0.2 },
  { left: "84%", top: "5%", opacity: 0.27 },
  { left: "89%", top: "19%", opacity: 0.34 },
  { left: "94%", top: "11%", opacity: 0.22 },
  { left: "12%", top: "32%", opacity: 0.19 },
  { left: "58%", top: "3%", opacity: 0.3 },
  { left: "97%", top: "33%", opacity: 0.24 },
] as const;

function PracticeSection() {
  return (
    <section id="the-process" className="px-[12%] py-28" style={{ background:"#080a0d" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-16 grid gap-8 lg:grid-cols-[0.72fr_0.28fr] lg:items-end"
          style={{ borderBottom:"1px solid rgba(178,168,152,0.09)", paddingBottom:"2.75rem" }}>
          <div>
            <Label>The Practice</Label>
            <RichH
              lines={[[{text:"Advocacy,",color:CREAM}],[{text:"not",color:TITAN},{text:"remediation.",color:CREAM}]]} />
          </div>
          <p className="leading-[1.88] lg:max-w-sm" style={{ color:TITAN, opacity:0.82, fontSize:BODY }}>
              We carry no hammers and file no invoices for work. Our only product is judgment
              applied exclusively on behalf of the owner.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 lg:border-t" style={{ borderColor:"rgba(178,168,152,0.07)" }}>
          {ROWS.map(({ n, title, body }, i) => (
            <motion.div key={n}
              className="group cursor-default py-10 lg:px-8 lg:even:border-l"
              style={{
                borderBottom:"1px solid rgba(178,168,152,0.07)",
                borderLeftColor:"rgba(178,168,152,0.07)",
                background: i%4===1 || i%4===2 ? "rgba(13,15,22,0.38)" : "transparent",
              }}
              initial={{ opacity:0, y:18 }}
              whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true, margin:"-8% 0px" }}
              transition={{ duration:1.1, delay:i*0.1, ease:EASE }}>
              <div className="grid gap-5 md:grid-cols-[4.25rem_1fr] md:items-start">
                <p className="font-heading text-[1.05rem] leading-none tracking-[0.12em]" style={{ color:TITAN, opacity:0.34 }}>{n}</p>
                <div className="max-w-xl">
                  <h3 className="font-heading font-light leading-[1.04] tracking-[-0.015em]"
                    style={{ fontSize:SUB_H, color:CREAM }}>{title}</h3>
                  <p className="mt-4 leading-[1.88]" style={{ color:TITAN, opacity:0.82, fontSize:BODY }}>{body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Prototype() {
  const pathname = usePathname();
  const prototypeBase = pathname.startsWith("/prototype2") ? "/prototype2" : "/prototype";
  const contactPath = `${prototypeBase}/contact`;
  const heroRef    = useRef<HTMLDivElement>(null);
  const officeRef  = useRef<HTMLDivElement>(null);

  const [introComplete, setIntroComplete] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleIntroComplete = useCallback(() => setIntroComplete(true), []);

  // Hide nav on scroll down, reveal on scroll up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) { setNavVisible(true); }
      else if (y > lastScrollY.current + 8) { setNavVisible(false); }
      else if (y < lastScrollY.current - 8) { setNavVisible(true); }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive:true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { scrollYProgress: heroProgress } = useScroll({ target:heroRef, offset:["start start","end start"] });
  const heroY       = useTransform(heroProgress, [0,1], ["0%","22%"]);
  const heroOpacity = useTransform(heroProgress, [0,0.72], [1,0]);
  const heroScale   = useTransform(heroProgress, [0,1], [1,1.06]);

  const cornerstones = [
    { n:"01", title:"Privacy",      color:CREAM,  body:"NDA-protected engagements. No public client list. Your property and family context stay tightly held — not filed, not referenced, not discussed." },
    { n:"02", title:"Transparency", color:TITAN,  body:"Every test result, invoice, and report logged to your Private Office. Decisions are reconstructable. Nothing circulates informally." },
    { n:"03", title:"Concierge",    color:GOLD,   body:"A direct line to the founding partner. We limit engagements to six projects annually — intentionally. Judgment cannot be scaled." },
  ];

  return (
      <SmoothProvider>
        <CustomCursor />
        <Grain />
      <IntroSequence onComplete={handleIntroComplete} />

      <div style={{ background:BG, color:CREAM }}>

        {/* ══ NAV ══════════════════════════════════════════════════════════ */}
        <motion.header
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-[5%] py-5"
          style={{ background:"rgba(10,11,14,0.88)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(178,168,152,0.07)" }}
          initial={{ opacity:0, y:-20 }}
          animate={introComplete ? { opacity:1, y: navVisible ? 0 : -100 } : { opacity:0, y:-20 }}
          transition={{ duration:0.5, ease:EASE }}
        >
          <Link href="/" aria-label="Home">
            {/* 50% bigger than h-11 (2.75rem) → ~4.2rem */}
            <BrandLogo className="opacity-88 h-8 sm:h-10 md:!h-[4.2rem]" />
          </Link>
          <nav className="hidden md:flex items-center gap-10 text-[0.86rem] uppercase tracking-[0.2em]"
            style={{ color:TITAN, opacity:0.7 }}>
            {[["The Practice","#the-process"],["Origin","#origin"],["The Cornerstone","#cornerstones"],["Private Office","#private-office"]].map(([l,h]) => (
              <a key={l} href={h} className="hover:opacity-100 transition-opacity duration-400">{l}</a>
            ))}
          </nav>
          <Link href={contactPath} data-cursor="inquire"
            className="hidden md:flex items-center gap-2 text-[0.86rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity duration-400"
            style={{ color:GOLD, opacity:0.85 }}>
            Book inquiry <ArrowRight className="size-3.5" />
          </Link>
        </motion.header>

        {/* ══ HERO ══════════════════════════════════════════════════════════ */}
        <section ref={heroRef as React.RefObject<HTMLDivElement>} className="relative h-screen min-h-[700px] flex items-end overflow-hidden">
          <motion.div className="absolute inset-0" style={{ y:heroY, scale:heroScale }}>
            <Image src="/images/jra-hero.jpg" alt="Malibu coastal estate" fill priority
              className="object-cover object-center saturate-[0.45] contrast-[0.88] brightness-[0.85]" sizes="100vw" />
            <div className="absolute inset-0"
              style={{ background:"linear-gradient(to top, rgba(10,11,14,1) 0%, rgba(10,11,14,0.38) 55%, rgba(10,11,14,0.12) 100%)" }} />
          </motion.div>

          <motion.div style={{ opacity:heroOpacity }}
            className="relative z-10 w-full px-[12%] pb-16 lg:pb-24">
            <AnimatePresence>
              {introComplete && (
                <>
                  {/* Value prop — answers "what do they do" on first viewport */}
                  <motion.p className="mb-3 text-[0.76rem] uppercase tracking-[0.3em]"
                    style={{ color:CREAM, opacity:0, textShadow:"0 2px 10px rgba(0,0,0,0.72)" }}
                    animate={{ opacity:0.88 }}
                    transition={{ duration:1.0, delay:0.05, ease:EASE }}>
                    Owner-side advisory · No contractors · No conflicts
                  </motion.p>
                  <motion.p className="mb-8 text-[0.76rem] uppercase tracking-[0.3em]"
                    style={{ color:GOLD, opacity:0, textShadow:"0 2px 10px rgba(0,0,0,0.72)" }}
                    animate={{ opacity:0.84 }}
                    transition={{ duration:1.2, delay:0.1, ease:EASE }}>
                    Private advisory · Los Angeles coastal estates
                  </motion.p>

                  {/* Hero h1 — larger than section headings but proportional */}
                  <h1 className="font-heading font-light leading-[0.88] tracking-[-0.025em]"
                    style={{ fontSize:"clamp(2.9rem,4.7vw,5.35rem)", textShadow:"0 3px 18px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.5)" }}>
                    {[
                      { text:"Protecting", color:CREAM,  d:0.2, block:true },
                      { text:"The Coast",  color:TITAN,  d:0.46, block:true },
                      { text:"We Call",    color:CREAM,  d:0.72, block:false },
                      { text:"Home.",      color:GOLD,   d:0.88, block:false },
                    ].map(({ text, color, d, block }, i) => (
                      <motion.span key={i}
                        className={`${block?"block":""} inline-block mr-[0.18em]`}
                        style={{ color, display: block ? "block" : "inline-block" }}
                        initial={{ opacity:0, y:22, filter:"blur(10px)" }}
                        animate={{ opacity:1, y:0, filter:"blur(0px)" }}
                        transition={{ duration:1.2, delay:d, ease:EASE }}>
                        {text}
                      </motion.span>
                    ))}
                  </h1>

                  <Line delay={1.3} />

                  <motion.div className="mt-8 flex flex-col sm:flex-row sm:items-end gap-7"
                    initial={{ opacity:0 }} animate={{ opacity:1 }}
                    transition={{ duration:1.1, delay:1.5, ease:EASE }}>
                    <p className="max-w-xl leading-[1.9]" style={{ color:TITAN, opacity:0.84, fontSize:BODY }}>
                      Ultra-discreet hazardous materials remediation advisory and structural inspection
                      oversight for coastal estate owners where cost, liability, and pressure arrive together.
                    </p>
                    <a href="#the-process" data-cursor="view"
                      className="ml-auto flex-shrink-0 flex items-center gap-3 text-[0.86rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity"
                      style={{ color:GOLD, opacity:0.8 }}>
                      View practice <ArrowRight className="size-3.5" />
                    </a>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div className="absolute bottom-8 right-10 flex flex-col items-center gap-3"
            initial={{ opacity:0 }} animate={introComplete ? { opacity:1 } : {}}
            transition={{ delay:2, duration:1 }}>
            <motion.div className="w-px h-16 origin-top"
              style={{ background:`linear-gradient(to bottom, ${GOLD}55, transparent)` }}
              animate={{ scaleY:[0,1,0] }}
              transition={{ duration:2.6, repeat:Infinity, ease:"easeInOut", repeatDelay:0.6 }} />
          </motion.div>
        </section>

        {/* ══ PRACTICE ══════════════════════════════════════════════════════ */}
        <PracticeSection />

        {/* ══ ORIGIN ═══════════════════════════════════════════════════════ */}
        <section id="origin" className="grid lg:grid-cols-2 min-h-screen">
          {/* Founders — single shot on Malibu beach */}
          <div className="relative order-2 lg:order-1 min-h-[58vh] lg:min-h-full overflow-hidden">
            <ParallaxImg
              src="/images/founders/founders-malibu-beach.png"
              alt="Roman and Stephen, co-founders of James Roman Advisory, on the Malibu coastline"
              speed={0.1}
              className="absolute inset-0"
              imageClassName="object-contain object-center saturate-[0.42] contrast-[0.9] brightness-[0.82]"
            />
            <div className="absolute inset-0"
              style={{ background:"linear-gradient(105deg, rgba(10,11,14,0.55) 0%, rgba(10,11,14,0.05) 50%, rgba(10,11,14,0.45) 100%)" }} />
            <div className="absolute inset-x-0 bottom-0 h-32"
              style={{ background:"linear-gradient(to top, rgba(10,11,14,0.85), transparent)" }} />
            <Fade className="absolute bottom-8 left-8">
              <p className="text-[0.68rem] uppercase tracking-[0.28em] mb-1" style={{ color:TITAN, opacity:0.55 }}>
                Roman & Stephen · Malibu
              </p>
              <p className="font-heading text-[1.1rem] font-light" style={{ color:CREAM }}>
                Co-founders
              </p>
            </Fade>
          </div>

          {/* THE TYPOGRAPHIC REFERENCE SECTION */}
          <div className="order-1 lg:order-2 flex flex-col justify-center px-[12%] py-24 lg:py-32"
            style={{ background:BG }}>
            <Label>The Origin</Label>
            <RichH baseDelay={0.1} className="mb-10"
              lines={[
                [{text:"Twice in thirty years,",color:TITAN}],
                [{text:"the canyon",color:CREAM},{text:"claimed",color:TITAN}],
                [{text:"the ridge.",color:GOLD}],
              ]} />
            <Line delay={0.5} />
            <div className="mt-10 space-y-7"
              style={{ fontSize:BODY, lineHeight:"1.9", color:TITAN, opacity:0.88, maxWidth:"52ch" }}>
              {[
                "Stephen was born in Malibu. He watched his family's home burn in 1993 and again in 2018. Both times, the hardest part wasn't the loss — it was what came after: contractors who couldn't be trusted, advisors who worked for the insurance company.",
                "Roman spent years overseeing construction across Los Angeles and watched, repeatedly, how quickly standards drift when no one is clearly standing for the person paying the bill.",
                "James Roman Advisory exists because both of them needed it, years before they built it.",
              ].map((p,i) => <Fade key={i} delay={0.55 + i*0.2}><p>{p}</p></Fade>)}
            </div>
            {/* Mid-page CTA — after Origin narrative */}
            <Fade delay={0.95} className="mt-10">
              <Link href={contactPath} data-cursor="inquire"
                className="inline-flex items-center gap-2 text-[0.76rem] uppercase tracking-[0.24em] hover:opacity-100 transition-opacity duration-400"
                style={{ color:GOLD, opacity:0.6 }}>
                Book a private consultation <ArrowRight className="size-3" />
              </Link>
            </Fade>
          </div>
        </section>

        {/* ══ CORNERSTONES — centered, no ghost letters ════════════════════ */}
        <section id="cornerstones" style={{ background:"#080a0d" }}>
          <div className="px-[12%] pt-24 pb-14 text-center"
            style={{ borderBottom:"1px solid rgba(178,168,152,0.07)" }}>
            <Label center>The Cornerstone</Label>
            <RichH center baseDelay={0.05}
              lines={[
                [{text:"The terms",color:CREAM},{text:"we",color:TITAN}],
                [{text:"don't",color:GOLD},{text:"negotiate.",color:CREAM}],
              ]} />
          </div>

          {cornerstones.map(({ n, title, color, body }, i) => (
            <motion.div key={title}
              className="flex flex-col items-center justify-center text-center px-[16%] py-16 lg:py-20"
              style={{
                borderBottom:"1px solid rgba(178,168,152,0.07)",
                background: i%2===0 ? "#080a0d" : "#0d0f16",
              }}
              initial={{ opacity:0 }}
              whileInView={{ opacity:1 }}
              viewport={{ once:true, margin:"-6% 0px" }}
              transition={{ duration:1.0, ease:EASE }}>

              <Fade delay={0.05}>
                <p className="text-[0.72rem] uppercase tracking-[0.32em] mb-5"
                  style={{ color:GOLD, opacity:0.4 }}>{n}</p>
              </Fade>

              <motion.h3
                className="font-heading font-light leading-[0.92] tracking-[-0.025em] mb-5"
                style={{ fontSize:SUB_H, color, textShadow:"0 2px 12px rgba(0,0,0,0.5)" }}
                initial={{ opacity:0, y:22, filter:"blur(8px)" }}
                whileInView={{ opacity:1, y:0, filter:"blur(0px)" }}
                viewport={{ once:true }}
                transition={{ duration:1.15, delay:0.1, ease:EASE }}>
                {title}
              </motion.h3>

              <Fade delay={0.22}>
                <p className="leading-[1.88] max-w-md mx-auto text-center"
                  style={{ color:TITAN, opacity:0.88, fontSize:BODY }}>
                  {body}
                </p>
              </Fade>
            </motion.div>
          ))}
        </section>

        {/* ══ PRIVATE OFFICE — Malibu background ═══════════════════════════ */}
        <section ref={officeRef} id="private-office"
          className="relative min-h-screen flex items-center overflow-hidden">

          <motion.div className="absolute inset-0" style={{ y:heroY, scale:heroScale }}>
            {/* CC0: Point Dume, Malibu by Austin Neill, via Wikimedia Commons / Unsplash. */}
            <Image src="/images/malibu-mountains-ocean-sunset.jpg" alt="Point Dume cliffs, Malibu mountains, and the Pacific Ocean at sunset" fill
              priority
              className="object-cover object-center saturate-[0.58] contrast-[1.08] brightness-[0.46] sepia-[0.12]" sizes="100vw" />
            <div className="absolute inset-0"
              style={{ background:"linear-gradient(to top, rgba(6,9,16,0.98) 0%, rgba(6,12,24,0.84) 48%, rgba(24,16,10,0.56) 100%)" }} />
            <div className="absolute inset-0"
              style={{ background:"radial-gradient(ellipse 76% 38% at 58% 42%, rgba(201,181,138,0.16), rgba(201,181,138,0.045) 42%, transparent 70%)" }} />
            {/* Stars/shimmer dots — pure CSS */}
            {STAR_POINTS.map((point,i) => (
              <div key={i} className="absolute rounded-full" style={{
                width: i%3===0?2:1, height: i%3===0?2:1,
                background:`rgba(236,230,214,${point.opacity})`,
                left:point.left, top:point.top,
                boxShadow:`0 0 ${i%2===0?3:2}px rgba(236,230,214,0.3)`,
              }} />
            ))}
            <div className="absolute inset-x-0 bottom-0 h-1/3"
              style={{ background:"linear-gradient(to top, rgba(10,11,14,0.95), transparent)" }} />
          </motion.div>

          <div className="relative z-10 w-full max-w-6xl mx-auto px-[12%] py-28 grid lg:grid-cols-[0.9fr_0.78fr] gap-16 items-center">
            <div>
              <Fade>
                <p className="text-[0.78rem] uppercase tracking-[0.34em] mb-7"
                  style={{ color:TITAN, opacity:0.82 }}>Concierge Experience</p>
              </Fade>
              <RichH baseDelay={0.1} className="mb-10"
                lines={[
                  [{text:"Your",color:CREAM},{text:"Private",color:TITAN}],
                  [{text:"Office.",color:GOLD}],
                ]} />
              <Fade delay={0.5}>
                <p className="leading-[1.9] max-w-md mb-12" style={{ color:TITAN, opacity:0.88, fontSize:BODY }}>
                  Every client receives a dedicated digital workspace — real-time transparency on
                  compliance status, document custody, and site activity. Nothing circulates informally.
                </p>
              </Fade>
              <Fade delay={0.65}>
                <Link href="/portal" data-cursor="view"
                  className="inline-flex items-center gap-3 border px-8 py-3.5 text-[0.86rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity duration-400"
                  style={{ borderColor:"rgba(201,181,138,0.22)", color:GOLD, opacity:0.82 }}>
                  Access private office <ArrowRight className="size-3" />
                </Link>
              </Fade>
            </div>

            <motion.div data-portal-panel className="w-full max-w-[420px] mx-auto border backdrop-blur-sm p-5 aspect-[3/4] min-h-0 overflow-hidden flex flex-col"
              style={{ borderColor:"rgba(201,181,138,0.14)", background:"rgba(6,10,16,0.84)", boxShadow:"0 28px 80px rgba(0,0,0,0.38)" }}
              initial={{ opacity:0, x:50 }}
              whileInView={{ opacity:1, x:0 }}
              viewport={{ once:true }}
              transition={{ duration:1.3, delay:0.35, ease:EASE }}>

              <div className="flex items-start justify-between pb-4 mb-4"
                style={{ borderBottom:"1px solid rgba(201,181,138,0.08)" }}>
                <div>
                  <p className="text-[0.58rem] uppercase tracking-[0.24em] mb-2" style={{ color:GOLD, opacity:0.56 }}>Client portal</p>
                  <p className="font-heading text-[1.1rem] font-light" style={{ color:CREAM }}>Engagement file</p>
                  <p className="text-[0.74rem] mt-1" style={{ color:TITAN, opacity:0.48 }}>Broad Beach Rd · Active · Week 7</p>
                </div>
                <span className="text-[0.54rem] uppercase tracking-widest border px-2 py-1"
                  style={{ borderColor:"rgba(201,181,138,0.15)", color:GOLD, opacity:0.6 }}>Restricted</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4 pb-4"
                style={{ borderBottom:"1px solid rgba(201,181,138,0.07)" }}>
                {[{l:"Progress",v:100,s:"%"},{l:"Documents",v:28,s:""},{l:"Site visits",v:14,s:""}].map(({ l,v,s }) => (
                  <div key={l} className="text-center">
                    <p className="font-heading text-[1.46rem] font-light" style={{ color:GOLD }}>
                      <Counter value={v} suffix={s} />
                    </p>
                    <p className="text-[0.62rem] uppercase tracking-[0.2em] mt-1" style={{ color:TITAN, opacity:0.42 }}>{l}</p>
                  </div>
                ))}
              </div>

              <PortalProgressBar label="Evidence review" detail="100%" delay={0.15} />
              <PortalProgressBar label="Document custody" detail="100%" delay={0.28} />
              <PortalProgressBar label="Client clearance" detail="100%" delay={0.41} />

              <div className="grid grid-cols-2 gap-4 pt-4 pb-4 mt-auto mb-4"
                style={{ borderTop:"1px solid rgba(201,181,138,0.07)", borderBottom:"1px solid rgba(201,181,138,0.07)" }}>
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.2em] mb-3" style={{ color:TITAN, opacity:0.4 }}>Weekly activity</p>
                  <BarChart />
                </div>
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.2em] mb-3" style={{ color:TITAN, opacity:0.4 }}>Air quality mg/m³</p>
                  <LineChart />
                  <p className="text-[0.62rem] mt-2" style={{ color:GOLD, opacity:0.55 }}>0.003 — Below EPA threshold</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {l:"Safety compliance", v:"All staff cleared",         ok:true },
                  {l:"Permit status",     v:"Active · AQMD #2024-MB-7743",  ok:true },
                  {l:"Next inspection",   v:"Jun 8 · Coastal Commission",   ok:false},
                ].map(({ l,v,ok }) => (
                  <div key={l} className="flex items-center gap-3">
                    <span className="size-1.5 rounded-full flex-shrink-0"
                      style={{ background: ok ? "#4ade8072" : `${GOLD}66` }} />
                    <span className="text-[0.72rem]" style={{ color:TITAN, opacity:0.5 }}>{l}</span>
                    <span className="ml-auto text-[0.72rem]" style={{ color:TITAN, opacity:0.66 }}>{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══ CONSULTATION / LEGAL ════════════════════════════════════════ */}
        <section id="consultation" className="px-[12%] py-28"
          style={{ borderTop:"1px solid rgba(178,168,152,0.07)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <Fade>
                <div className="max-w-xl">
                <Label>Get in touch</Label>
                <RichH baseDelay={0.05} className="mb-8"
                  lines={[
                    [{text:"Request a",color:CREAM}],
                    [{text:"confidential",color:TITAN}],
                    [{text:"consultation.",color:CREAM}],
                  ]} />
                <p className="leading-[1.9] max-w-xl mb-10" style={{ color:TITAN, opacity:0.88, fontSize:BODY }}>
                  Share only what is necessary. Full document exchange happens after an engagement is
                  accepted and secure client access is issued.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {["CCPA/CPRA aware","WCAG 2.2 AA target","No portal trackers"].map((l) => (
                    <span key={l} className="text-[0.72rem] uppercase tracking-widest border px-2.5 py-1"
                      style={{ borderColor:"rgba(178,168,152,0.14)", color:TITAN, opacity:0.55 }}>{l}</span>
                  ))}
                </div>
              </div>
              </Fade>
              <Fade delay={0.18}>
                <div
                  className="border-t pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"
                  style={{ borderColor:"rgba(178,168,152,0.13)" }}
                >
                  <ConsultationForm variant="integrated" />
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
        <footer className="px-[12%] py-10"
          style={{ borderTop:"1px solid rgba(178,168,152,0.07)" }}>
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <BrandLogo className="h-9 opacity-55" />
              <div>
                <p className="text-[0.84rem]" style={{ color:TITAN, opacity:0.46 }}>© 2026 James Roman Advisory LLC</p>
                <p className="text-[0.72rem] mt-0.5" style={{ color:TITAN, opacity:0.3 }}>Malibu, California · Fully Certified · Privacy Guaranteed</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-[0.82rem] uppercase tracking-[0.18em]"
              style={{ color:TITAN, opacity:0.34 }}>
              {[["Practice","#the-process"],["Origin","#origin"],["The Cornerstone","#cornerstones"],["Contact",contactPath]].map(([l,h]) => (
                <Link key={l} href={h} className="hover:opacity-70 transition-opacity duration-300">{l}</Link>
              ))}
            </div>
          </div>
        </footer>

      </div>
    </SmoothProvider>
  );
}
