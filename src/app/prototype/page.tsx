"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import { ArrowRight } from "lucide-react";
import { ConsultationForm } from "@/components/consultation-form";
import { BrandLogo } from "@/components/brand-logo";
import { SmoothProvider } from "./_components/smooth";
import { CustomCursor } from "./_components/cursor";
import { IntroSequence } from "./_components/intro";

// ─── Design tokens ────────────────────────────────────────────────────────────
const TITAN  = "#b2a898";   // warm titanium/bronze — secondary text
const GOLD   = "#c9b58a";   // warm gold — accents, CTAs, key highlights
const CREAM  = "#ece6d6";   // primary text
const BG     = "#0a0b0e";
const EASE   = [0.16, 1, 0.3, 1] as const;

// Origin section is the typographic reference:
// heading: clamp(2.6rem, 4vw, 5rem) | body: 1.08rem | label: 0.8rem

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
  const reduced = useReducedMotion();
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
  const reduced = useReducedMotion();
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
      <p className={`text-[0.8rem] uppercase tracking-[0.38em] mb-7 ${center?"text-center":""}`}
        style={{ color:TITAN, opacity:0.78 }}>{children}</p>
    </Fade>
  );
}

// ─── Multi-color heading ──────────────────────────────────────────────────────
type CW = { text:string; color:string };
function RichH({
  lines, size="clamp(1.8rem,2.8vw,3.5rem)", className="", baseDelay=0, center=false, blur=false,
}: {
  lines:CW[][]; size?:string; className?:string; baseDelay?:number; center?:boolean; blur?:boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-8% 0px" });
  const reduced = useReducedMotion();
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
function ParallaxImg({ src, alt, speed=0.14, className="" }: { src:string; alt:string; speed?:number; className?:string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target:ref, offset:["start end","end start"] });
  const y = useTransform(scrollYProgress, [0,1], [`${-speed*100}%`,`${speed*100}%`]);
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="w-full h-[132%] -mt-[16%]">
        <Image src={src} alt={alt} fill className="object-cover object-center saturate-[0.45] contrast-[0.88] brightness-[0.85]" sizes="100vw" />
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

// ─── Scroll-driven progress bar ───────────────────────────────────────────────
function ScrollBar({ target, label, detail, targetFill, scrollRange }: {
  target: React.RefObject<HTMLDivElement | null>;
  label:string; detail:string; targetFill:number;
  scrollRange:[number,number];
}) {
  const { scrollYProgress } = useScroll({ target, offset:["start center","end center"] });
  const fillW = useTransform(scrollYProgress, scrollRange, [0, targetFill/100]);
  const smoothFill = useSpring(fillW, { stiffness:60, damping:20 });

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.72rem]" style={{ color:TITAN, opacity:0.55 }}>{label}</span>
        <span className="text-[0.7rem]" style={{ color:GOLD, opacity:0.65 }}>{detail}</span>
      </div>
      <div className="h-px relative overflow-hidden" style={{ background:"rgba(201,181,138,0.07)" }}>
        <motion.div className="absolute inset-y-0 left-0 origin-left"
          style={{ scaleX:smoothFill, background:"linear-gradient(to right,rgba(201,181,138,0.25),rgba(201,181,138,0.6))" }} />
      </div>
    </div>
  );
}

// ─── Practice rows ────────────────────────────────────────────────────────────
const ROWS = [
  { n:"01", title:"Contractor Vetting",       body:"License, insurance, bonding, and field performance reviewed before any crew steps on site. Every contract questioned before it is signed." },
  { n:"02", title:"Hazardous Material Audit", body:"Asbestos, lead, heavy metals, and airborne particulate monitoring coordinated from first assessment to final clearance letter." },
  { n:"03", title:"Regulatory Navigation",    body:"City, county, Coastal Commission, and AQMD requirements managed so nothing falls between agencies, deadlines, or interpretations." },
  { n:"04", title:"Concierge Closeout",       body:"Final clearance letters, document vault, and insurance reconciliation handled to full completion — not handed off to the owner alone." },
];

function PracticeSection() {
  return (
    <section id="the-process" className="px-[12%] py-28" style={{ background:"#070a0d" }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-14">
          <Label>The Practice</Label>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-10"
            style={{ borderBottom:"1px solid rgba(178,168,152,0.12)" }}>
            <RichH size="clamp(1.8rem,2.8vw,3.5rem)"
              lines={[[{text:"Advocacy,",color:CREAM}],[{text:"not",color:TITAN},{text:"remediation.",color:CREAM}]]} />
            <p className="text-[1.08rem] leading-[1.88] lg:max-w-sm lg:text-right" style={{ color:TITAN, opacity:0.88 }}>
              We carry no hammers and file no invoices for work. Our only product is judgment
              applied exclusively on behalf of the owner.
            </p>
          </div>
        </div>
        <div>
          {ROWS.map(({ n, title, body }, i) => (
            <motion.div key={n}
              className="group py-9 cursor-default"
              style={{ borderBottom:"1px solid rgba(178,168,152,0.08)" }}
              initial={{ opacity:0, y:18 }}
              whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true, margin:"-8% 0px" }}
              transition={{ duration:1.1, delay:i*0.1, ease:EASE }}>
              {/* Mobile: stacked. Desktop: 3-col */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3.5rem_1fr_1.05fr] lg:items-start lg:gap-14">
                <p className="font-heading text-[0.85rem] tracking-[0.1em]" style={{ color:GOLD, opacity:0.32 }}>{n}</p>
                <h3 className="font-heading font-light leading-[1.04] tracking-[-0.015em]"
                  style={{ fontSize:"clamp(1.4rem,2vw,2.2rem)", color:CREAM }}>{title}</h3>
                <p className="text-[1.08rem] leading-[1.88]" style={{ color:TITAN, opacity:0.88 }}>{body}</p>
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
  const heroRef    = useRef<HTMLDivElement>(null);
  const officeRef  = useRef<HTMLDivElement>(null);
  const dashRef    = useRef<HTMLDivElement>(null);

  const [introComplete, setIntroComplete] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => setMounted(true), []);
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
      {mounted && <IntroSequence onComplete={handleIntroComplete} />}

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
            {[["The Process","#the-process"],["Origin","#origin"],["Private Office","#private-office"]].map(([l,h]) => (
              <a key={l} href={h} className="hover:opacity-100 transition-opacity duration-400">{l}</a>
            ))}
          </nav>
          <a href="#consultation" data-cursor="inquire"
            className="hidden md:flex items-center gap-2 text-[0.86rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity duration-400"
            style={{ color:GOLD, opacity:0.85 }}>
            Book inquiry <ArrowRight className="size-3.5" />
          </a>
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
              {introComplete && mounted && (
                <>
                  {/* Value prop — answers "what do they do" on first viewport */}
                  <motion.p className="mb-3 text-[0.7rem] uppercase tracking-[0.28em]"
                    style={{ color:GOLD, opacity:0 }}
                    animate={{ opacity:0.72 }}
                    transition={{ duration:1.0, delay:0.05, ease:EASE }}>
                    Owner-side advisory · No contractors · No conflicts
                  </motion.p>
                  <motion.p className="mb-9 text-[0.78rem] uppercase tracking-[0.32em]"
                    style={{ color:TITAN, opacity:0 }}
                    animate={{ opacity:0.78 }}
                    transition={{ duration:1.2, delay:0.1, ease:EASE }}>
                    Private advisory · Los Angeles coastal estates
                  </motion.p>

                  {/* Hero h1 — larger than section headings but proportional */}
                  <h1 className="font-heading font-light leading-[0.88] tracking-[-0.025em]"
                    style={{ fontSize:"clamp(3.4rem,5.5vw,6.4rem)", textShadow:"0 3px 18px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.5)" }}>
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
                    <p className="max-w-xl text-[1.08rem] leading-[1.9]" style={{ color:TITAN, opacity:0.8 }}>
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

        {/* ══ MANIFESTO ════════════════════════════════════════════════════ */}
        <section className="relative min-h-screen flex items-center justify-center px-[12%] py-40 overflow-hidden"
          style={{ background:"#070809" }}>
          <div className="absolute inset-0"
            style={{ background:"radial-gradient(ellipse 65% 48% at 50% 50%, rgba(201,181,138,0.04), transparent)" }} />
          <div className="relative max-w-5xl text-center">
            <Label center>The operating principle</Label>
            <RichH center blur size="clamp(1.8rem,2.8vw,3.5rem)" baseDelay={0.05}
              lines={[
                [{text:"We lost our home twice",color:CREAM}],
                [{text:"in thirty years.",color:TITAN},{text:"We don't",color:CREAM}],
                [{text:"just know the risk —",color:TITAN}],
                [{text:"we live it.",color:GOLD}],
              ]} />
            <Fade delay={1.4}>
              <p className="mt-10 text-[0.84rem] uppercase tracking-[0.3em]"
                style={{ color:TITAN, opacity:0.42 }}>— Roman & Stephen · Founders · Malibu</p>
            </Fade>
          </div>
        </section>

        {/* ══ ORIGIN ═══════════════════════════════════════════════════════ */}
        <section id="origin" className="grid lg:grid-cols-2 min-h-screen">
          {/* Founders — single shot on Malibu ridge */}
          <div className="relative order-2 lg:order-1 min-h-[58vh] lg:min-h-full overflow-hidden">
            <ParallaxImg
              src="/images/founders/founders-together.png"
              alt="Roman and Stephen, co-founders of James Roman Advisory, on the Malibu coastline"
              speed={0.1}
              className="absolute inset-0"
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
            <RichH size="clamp(1.8rem,2.8vw,3.5rem)" baseDelay={0.1} className="mb-10"
              lines={[
                [{text:"Twice in thirty years,",color:TITAN}],
                [{text:"the canyon",color:CREAM},{text:"claimed",color:TITAN}],
                [{text:"the ridge.",color:GOLD}],
              ]} />
            <Line delay={0.5} />
            <div className="mt-10 space-y-7"
              style={{ fontSize:"1.08rem", lineHeight:"1.9", color:TITAN, opacity:0.88, maxWidth:"52ch" }}>
              {[
                "Stephen was born in Malibu. He watched his family's home burn in 1993 and again in 2018. Both times, the hardest part wasn't the loss — it was what came after: contractors who couldn't be trusted, advisors who worked for the insurance company.",
                "Roman spent years overseeing construction across Los Angeles and watched, repeatedly, how quickly standards drift when no one is clearly standing for the person paying the bill.",
                "James Roman Advisory exists because both of them needed it, years before they built it.",
              ].map((p,i) => <Fade key={i} delay={0.55 + i*0.2}><p>{p}</p></Fade>)}
            </div>
            {/* Mid-page CTA — after Origin narrative */}
            <Fade delay={0.95} className="mt-10">
              <a href="#consultation" data-cursor="inquire"
                className="inline-flex items-center gap-2 text-[0.76rem] uppercase tracking-[0.24em] hover:opacity-100 transition-opacity duration-400"
                style={{ color:GOLD, opacity:0.6 }}>
                Book a private consultation <ArrowRight className="size-3" />
              </a>
            </Fade>
          </div>
        </section>

        {/* ══ PRACTICE ══════════════════════════════════════════════════════ */}
        <PracticeSection />

        {/* Mid-page CTA — after Practice, before Private Office */}
        <div className="px-[12%] py-10 flex items-center justify-between" style={{ background:"#070a0d", borderTop:"1px solid rgba(178,168,152,0.06)" }}>
          <p className="text-[0.78rem]" style={{ color:TITAN, opacity:0.5 }}>
            Advisory for Malibu, Bel Air, Pacific Palisades, Beverly Hills, and Bel Air estates.
          </p>
          <a href="#consultation" data-cursor="inquire"
            className="flex-shrink-0 flex items-center gap-2 text-[0.76rem] uppercase tracking-[0.24em] hover:opacity-100 transition-opacity duration-400 ml-8"
            style={{ color:GOLD, opacity:0.65 }}>
            Begin an inquiry <ArrowRight className="size-3" />
          </a>
        </div>

        {/* ══ PRIVATE OFFICE — Malibu background ═══════════════════════════ */}
        <section ref={officeRef} id="private-office"
          className="relative min-h-screen flex items-center overflow-hidden">

          {/* Malibu ocean/dusk CSS background */}
          <div className="absolute inset-0" style={{ background:"#060c18" }}>
            {/* Deep Pacific layers */}
            <div className="absolute inset-0" style={{
              background:`
                linear-gradient(180deg,
                  rgba(6,12,24,0.96) 0%,
                  rgba(8,20,40,0.85) 28%,
                  rgba(12,30,55,0.70) 50%,
                  rgba(18,38,58,0.80) 68%,
                  rgba(8,14,22,0.95) 100%
                )
              `,
            }} />
            {/* Warm horizon glow — Malibu sunset */}
            <div className="absolute inset-0" style={{
              background:`radial-gradient(ellipse 80% 35% at 50% 42%, rgba(180,130,60,0.12) 0%, rgba(201,181,138,0.06) 35%, transparent 65%)`,
            }} />
            {/* Left cliff shadow */}
            <div className="absolute inset-0" style={{
              background:`radial-gradient(ellipse 40% 100% at -5% 60%, rgba(4,8,14,0.9) 0%, transparent 55%)`,
            }} />
            {/* Ocean sparkle band */}
            <div className="absolute" style={{
              top:"38%", left:0, right:0, height:"18%",
              background:`linear-gradient(180deg, transparent, rgba(20,60,120,0.18) 40%, rgba(15,45,90,0.22) 60%, transparent)`,
            }} />
            {/* Stars/shimmer dots — pure CSS */}
            {[...Array(18)].map((_,i) => (
              <div key={i} className="absolute rounded-full" style={{
                width: i%3===0?2:1, height: i%3===0?2:1,
                background:`rgba(236,230,214,${0.15+Math.random()*0.25})`,
                left:`${5+Math.random()*90}%`, top:`${2+Math.random()*35}%`,
                boxShadow:`0 0 ${i%2===0?3:2}px rgba(236,230,214,0.3)`,
              }} />
            ))}
            {/* Bottom vignette */}
            <div className="absolute inset-x-0 bottom-0 h-1/3"
              style={{ background:"linear-gradient(to top, rgba(6,12,24,0.95), transparent)" }} />
          </div>

          <div className="relative z-10 w-full max-w-5xl mx-auto px-[12%] py-28 grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <Label>Concierge Experience</Label>
              <RichH size="clamp(1.8rem,2.8vw,3.5rem)" baseDelay={0.1} className="mb-10"
                lines={[
                  [{text:"Your",color:TITAN},{text:"Private",color:CREAM}],
                  [{text:"Office.",color:GOLD}],
                ]} />
              <Fade delay={0.5}>
                <p className="text-[1.08rem] leading-[1.9] max-w-md mb-12" style={{ color:TITAN, opacity:0.88 }}>
                  Every client receives a dedicated digital workspace — real-time transparency on
                  compliance status, document custody, and site activity. Nothing circulates informally.
                </p>
              </Fade>
              <Fade delay={0.65}>
                <a href="/portal" data-cursor="view"
                  className="inline-flex items-center gap-3 border px-8 py-3.5 text-[0.86rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity duration-400"
                  style={{ borderColor:"rgba(201,181,138,0.22)", color:GOLD, opacity:0.78 }}>
                  Access private office <ArrowRight className="size-3" />
                </a>
              </Fade>
            </div>

            {/* Dashboard with scroll-driven progress */}
            <motion.div ref={dashRef} className="hidden lg:block border backdrop-blur-sm p-7"
              style={{ borderColor:"rgba(201,181,138,0.12)", background:"rgba(6,12,24,0.84)" }}
              initial={{ opacity:0, x:50 }}
              whileInView={{ opacity:1, x:0 }}
              viewport={{ once:true }}
              transition={{ duration:1.3, delay:0.35, ease:EASE }}>

              <div className="flex items-start justify-between pb-5 mb-6"
                style={{ borderBottom:"1px solid rgba(201,181,138,0.08)" }}>
                <div>
                  <p className="font-heading text-[1.15rem] font-light" style={{ color:CREAM }}>Engagement file</p>
                  <p className="text-[0.74rem] mt-1" style={{ color:TITAN, opacity:0.48 }}>Broad Beach Rd · Active · Week 7</p>
                </div>
                <span className="text-[0.54rem] uppercase tracking-widest border px-2 py-1"
                  style={{ borderColor:"rgba(201,181,138,0.15)", color:GOLD, opacity:0.6 }}>Restricted</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6 pb-6"
                style={{ borderBottom:"1px solid rgba(201,181,138,0.07)" }}>
                {[{l:"Site visits",v:14,s:""},{l:"Documents",v:28,s:""},{l:"Compliance",v:97,s:"%"}].map(({ l,v,s }) => (
                  <div key={l} className="text-center">
                    <p className="font-heading text-[1.7rem] font-light" style={{ color:GOLD }}>
                      <Counter value={v} suffix={s} />
                    </p>
                    <p className="text-[0.62rem] uppercase tracking-[0.2em] mt-1" style={{ color:TITAN, opacity:0.42 }}>{l}</p>
                  </div>
                ))}
              </div>

              {/* Scroll-driven progress bars */}
              <ScrollBar target={officeRef} label="Asbestos containment" detail="02 of 04 phases"
                targetFill={52} scrollRange={[0.15,0.55]} />
              <ScrollBar target={officeRef} label="Document custody" detail="28 files current"
                targetFill={88} scrollRange={[0.25,0.65]} />
              <ScrollBar target={officeRef} label="Site clearance" detail="In progress"
                targetFill={31} scrollRange={[0.35,0.72]} />

              {/* Charts */}
              <div className="grid grid-cols-2 gap-5 pt-5 pb-5 mb-5"
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

              {/* Status */}
              <div className="space-y-2.5">
                {[
                  {l:"Safety Compliance", v:"All 14 staff cleared",         ok:true },
                  {l:"Permit status",     v:"Active — AQMD #2024-MB-7743",  ok:true },
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

        {/* ══ CORNERSTONES — centered, no ghost letters ════════════════════ */}
        <section style={{ background:"#080a0d" }}>
          {/* Section header */}
          <div className="px-[12%] pt-24 pb-14 text-center"
            style={{ borderBottom:"1px solid rgba(178,168,152,0.07)" }}>
            <Label center>Our Cornerstones</Label>
            <RichH center size="clamp(1.8rem,2.8vw,3.5rem)" baseDelay={0.05}
              lines={[
                [{text:"The terms",color:CREAM},{text:"we",color:TITAN}],
                [{text:"don't",color:GOLD},{text:"negotiate.",color:CREAM}],
              ]} />
          </div>

          {/* Each cornerstone — tight centered chapter */}
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

              {/* Number */}
              <Fade delay={0.05}>
                <p className="text-[0.72rem] uppercase tracking-[0.32em] mb-5"
                  style={{ color:GOLD, opacity:0.4 }}>{n}</p>
              </Fade>

              {/* Title */}
              <motion.h3
                className="font-heading font-light leading-[0.92] tracking-[-0.025em] mb-5"
                style={{ fontSize:"clamp(2rem,3.2vw,3.9rem)", color, textShadow:"0 2px 12px rgba(0,0,0,0.5)" }}
                initial={{ opacity:0, y:22, filter:"blur(8px)" }}
                whileInView={{ opacity:1, y:0, filter:"blur(0px)" }}
                viewport={{ once:true }}
                transition={{ duration:1.15, delay:0.1, ease:EASE }}>
                {title}
              </motion.h3>

              {/* Body — directly under title, no divider in between */}
              <Fade delay={0.22}>
                <p className="text-[1.05rem] leading-[1.88] max-w-md mx-auto text-center"
                  style={{ color:TITAN, opacity:0.88 }}>
                  {body}
                </p>
              </Fade>
            </motion.div>
          ))}
        </section>

        {/* ══ CERTS ═══════════════════════════════════════════════════════ */}
        <section style={{ background:"#0c0e12", borderTop:"1px solid rgba(178,168,152,0.06)", borderBottom:"1px solid rgba(178,168,152,0.06)" }}
          className="py-8">
          <motion.ul className="flex flex-wrap justify-center gap-x-10 gap-y-3 px-[12%]"
            initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }}
            transition={{ duration:1.6, ease:EASE }}>
            {["CSLB Licensed","IICRC Master Fire & Smoke","AIHA Corporate Member","Cal/OSHA Certified","Malibu Chamber of Commerce"].map((c) => (
              <li key={c} className="text-[0.76rem] uppercase tracking-[0.26em]"
                style={{ color:TITAN, opacity:0.38 }}>{c}</li>
            ))}
          </motion.ul>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════ */}
        <section className="relative flex items-center justify-center overflow-hidden py-32 px-[12%] text-center"
          style={{ minHeight:"72vh", background:BG }}>
          <div className="absolute inset-0"
            style={{ background:"radial-gradient(ellipse 58% 52% at 50% 50%, rgba(201,181,138,0.05), transparent)" }} />
          <div className="relative">
            <RichH center size="clamp(2.1rem,3.5vw,4.2rem)" baseDelay={0.1}
              className="max-w-5xl mx-auto"
              lines={[
                [{text:"Your home",color:CREAM},{text:"is",color:TITAN}],
                [{text:"your",color:TITAN},{text:"sanctuary.",color:GOLD}],
                [{text:"Ensure it",color:CREAM},{text:"stays.",color:TITAN}],
              ]} />
            <Fade delay={1.05} className="mt-14">
              <a href="#consultation" data-cursor="inquire"
                className="inline-flex items-center gap-3 px-10 py-4 text-[0.86rem] uppercase tracking-[0.22em] font-medium transition-opacity duration-400 hover:opacity-88"
                style={{ background:GOLD, color:BG }}>
                Book a confidential inquiry <ArrowRight className="size-3.5" />
              </a>
            </Fade>
          </div>
        </section>

        {/* ══ CONSULTATION / LEGAL ════════════════════════════════════════ */}
        <section id="consultation" className="px-[12%] py-28"
          style={{ borderTop:"1px solid rgba(178,168,152,0.07)" }}>
          <div className="max-w-5xl mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-20 items-start">
            <Fade>
              <Label>Get in touch</Label>
              <RichH size="clamp(1.8rem,2.8vw,3.5rem)" baseDelay={0.05} className="mb-8"
                lines={[
                  [{text:"Request a",color:CREAM}],
                  [{text:"confidential",color:TITAN}],
                  [{text:"consultation.",color:CREAM}],
                ]} />
              <p className="text-[1.08rem] leading-[1.9] max-w-sm mb-10" style={{ color:TITAN, opacity:0.88 }}>
                Share only what is necessary. Full document exchange happens after an engagement is
                accepted and secure client access is issued.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {["CCPA/CPRA aware","WCAG 2.2 AA target","No portal trackers"].map((l) => (
                  <span key={l} className="text-[0.72rem] uppercase tracking-widest border px-2.5 py-1"
                    style={{ borderColor:"rgba(178,168,152,0.14)", color:TITAN, opacity:0.55 }}>{l}</span>
                ))}
              </div>
            </Fade>
            <Fade delay={0.22}><ConsultationForm /></Fade>
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
            <div className="flex gap-8 text-[0.82rem] uppercase tracking-[0.18em]"
              style={{ color:TITAN, opacity:0.34 }}>
              {[["Practice","#the-process"],["Consultation","#consultation"],["Client portal","/portal"]].map(([l,h]) => (
                <Link key={l} href={h} className="hover:opacity-70 transition-opacity duration-300">{l}</Link>
              ))}
            </div>
          </div>
        </footer>

      </div>
    </SmoothProvider>
  );
}
