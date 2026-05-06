/**
 * ParadisoTransition — Doré's Celestial Rose
 *
 * V1  "Rosa Celeste"  — 24 thin rings, classic starburst
 * V4  "Nebula Sacra"  — 4 rings, golden cloud nebulae
 * V9  "Paradiso"      — 18 dense bands, steady core, clean circles
 * V10 "Rosa Spirale"  — 3 golden spiral arms
 *
 * Wisp presets (angels):
 *   original — default luminous particles
 *   beate    — "Anime Beate" large slow blessed souls
 *   coro     — "Coro Angelico" fast-flickering choir
 *   ali      — "Ali di Luce" extreme elongated wing-streaks
 *
 * Adapted from paradiso-three-act.jsx Act 3.
 */
import React, { useState, useEffect, useMemo, useRef, FC } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import './ParadisoTransition.css';

// ============ SEEDED RNG ============

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============ TYPES ============

interface RingData {
  id: number; size: number; dur: number; dir: number;
  op: number; blur: number; dots: number; wDur: number; th: number;
}
interface WispData {
  id: number; dist: number; isOuter: boolean; size: number; elong: number;
  orbDur: number; dir: number; op: number; fDur: number; glow: number; delay: number;
}
interface RayData {
  id: number; angle: number; len: number; w: number;
  op: number; fDur: number; delay: number;
}

// ============ CONFIG ============

interface DataConfig {
  style: 'classic' | 'dore';
  ringCount: number; wispCount: number; rayCount: number; seed: number;
  maxRingSize: number; sizePower: number;
  ringSpeedBase: number; ringSpeedPerRing: number;
  rayWidthBase: number; rayWidthRange: number;
  wobbleDurBase: number; wobbleDurRange: number;
  // Doré-specific (thick bands)
  ringThMin: number; ringThMax: number;
  ringOpMin: number; ringOpMax: number;
  dotsPerBand: number; dotsGrowth: number;
  dotSizeMin: number; dotSizeRange: number;
  dotRadialJitter: number;
  wispDistMax?: number; // max wisp distance from center (default 46)
  sameDirection?: boolean; // all rings spin same way (no crossing)
  spiral?: boolean; // dots trace spiral paths instead of circles
  spiralTurns?: number; // number of spiral windings (default 3)
  spiralRings?: number[]; // additional clean circle rings at these sizes (vmin)
  spiralStreaks?: boolean; // elongate dots tangent to spiral curve
  spiralGolden?: boolean; // use golden/logarithmic spiral instead of sqrt
  spiralFadeOut?: boolean; // dots fade from center to edge
  spiralTaper?: boolean; // jitter increases toward edge (arms dissolve)
}

const DATA_CONFIGS: Record<number, DataConfig> = {
  // V1 — Rosa Celeste: 24 thin rings, classic
  1: {
    style: 'classic',
    ringCount: 24, wispCount: 160, rayCount: 36, seed: 77,
    maxRingSize: 50, sizePower: 0.85,
    ringSpeedBase: 55, ringSpeedPerRing: 5,
    rayWidthBase: 0.2, rayWidthRange: 0.7,
    wobbleDurBase: 7, wobbleDurRange: 7,
    ringThMin: 0, ringThMax: 0, ringOpMin: 0, ringOpMax: 0,
    dotsPerBand: 0, dotsGrowth: 0,
    dotSizeMin: 1, dotSizeRange: 2, dotRadialJitter: 0,
    wispDistMax: 30,
  },
  // V9 — Paradiso: V5 refined — steady core, clean circles, minimal rays
  9: {
    style: 'dore',
    ringCount: 18, wispCount: 160, rayCount: 6, seed: 331,
    maxRingSize: 44, sizePower: 0.4,
    ringSpeedBase: 50, ringSpeedPerRing: 3,
    rayWidthBase: 0.1, rayWidthRange: 0.3,
    wobbleDurBase: 9, wobbleDurRange: 4,
    ringThMin: 1.0, ringThMax: 2.8,
    ringOpMin: 0.05, ringOpMax: 0.16,
    dotsPerBand: 45, dotsGrowth: 4,
    dotSizeMin: 1.0, dotSizeRange: 2.5, dotRadialJitter: 16,
    wispDistMax: 30,
    sameDirection: true,
  },
  // V10 — Rosa Spirale: 5 spiral arms, wider spread
  10: {
    style: 'dore',
    ringCount: 5, wispCount: 160, rayCount: 6, seed: 421,
    maxRingSize: 56, sizePower: 1.0,
    ringSpeedBase: 100, ringSpeedPerRing: 1,
    rayWidthBase: 0.1, rayWidthRange: 0.3,
    wobbleDurBase: 9999, wobbleDurRange: 0,
    ringThMin: 0, ringThMax: 0,
    ringOpMin: 0, ringOpMax: 0,
    dotsPerBand: 120, dotsGrowth: 0,
    dotSizeMin: 2.5, dotSizeRange: 4.5, dotRadialJitter: 1.5,
    wispDistMax: 30,
    sameDirection: true,
    spiral: true,
    spiralTurns: 2.5,
  },
  // V12 — Nove Cieli: 10 rings (innermost hidden by core = 9 visible spheres)
  12: {
    style: 'dore',
    ringCount: 10, wispCount: 160, rayCount: 6, seed: 331,
    maxRingSize: 46, sizePower: 0.45,
    ringSpeedBase: 55, ringSpeedPerRing: 5,
    rayWidthBase: 0.1, rayWidthRange: 0.3,
    wobbleDurBase: 9, wobbleDurRange: 4,
    ringThMin: 0.8, ringThMax: 2.2,
    ringOpMin: 0.06, ringOpMax: 0.16,
    dotsPerBand: 55, dotsGrowth: 5,
    dotSizeMin: 1.2, dotSizeRange: 2.8, dotRadialJitter: 14,
    wispDistMax: 30,
    sameDirection: true,
  },
};

// ============ VARIANT VISUAL STYLES ============

interface VariantStyle {
  ring: [number, number, number];
  dot: [number, number, number];
  wispOuter: [number, number, number];
  wispInner: [number, number, number];
  ray: [number, number, number];
  rayFade: [number, number, number];
  coreInner: string;
  coreOuter: string;
  coreShadow: string;
  coreInnerSize: string;
  coreOuterSize: string;
  quote: { line: string; sub: string; subDe: string; ref: string };
}

const VARIANT_STYLES: Record<number, VariantStyle> = {
  1: {
    ring: [255, 220, 100], dot: [255, 225, 110],
    wispOuter: [255, 228, 120], wispInner: [255, 245, 180],
    ray: [255, 235, 130], rayFade: [255, 220, 100],
    coreInner: 'radial-gradient(ellipse, rgba(255,255,250,1) 0%, rgba(255,248,200,0.95) 20%, rgba(255,235,130,0.45) 50%, transparent 100%)',
    coreOuter: 'radial-gradient(ellipse, rgba(255,242,170,0.3) 0%, rgba(255,228,110,0.1) 35%, rgba(255,215,80,0.03) 55%, transparent 75%)',
    coreShadow: '0 0 30px rgba(255,240,130,0.5), 0 0 80px rgba(255,225,90,0.25), 0 0 150px rgba(240,200,60,0.1)',
    coreInnerSize: '12vmin', coreOuterSize: '28vmin',
    quote: { line: "L\u2019amor che move il sole e l\u2019altre stelle", sub: 'The love that moves the sun and the other stars', subDe: 'Die Liebe, die kreisen macht die Sonne wie die Sterne', ref: 'Dante, Paradiso XXXIII' },
  },
  // V9 — Paradiso: V5 refined — smaller steady core, thinner bands
  9: {
    ring: [255, 210, 70], dot: [255, 225, 100],
    wispOuter: [255, 215, 85], wispInner: [255, 248, 195],
    ray: [255, 232, 120], rayFade: [255, 205, 60],
    coreInner: 'radial-gradient(ellipse, rgba(255,255,250,1) 0%, rgba(255,248,200,0.95) 20%, rgba(255,235,130,0.45) 50%, transparent 100%)',
    coreOuter: 'radial-gradient(ellipse, rgba(255,242,170,0.3) 0%, rgba(255,228,110,0.1) 35%, rgba(255,215,80,0.03) 55%, transparent 75%)',
    coreShadow: '0 0 30px rgba(255,240,130,0.5), 0 0 80px rgba(255,225,90,0.25), 0 0 150px rgba(240,200,60,0.1)',
    coreInnerSize: '12vmin', coreOuterSize: '28vmin',
    quote: { line: "Luce intellettual, piena d\u2019amore", sub: 'Light intellectual, full of love', subDe: 'Licht des Verstandes, voller Liebe', ref: 'Dante, Paradiso XXX' },
  },
  // V10 — Rosa Spirale: golden spirals
  10: {
    ring: [255, 210, 70], dot: [255, 228, 110],
    wispOuter: [255, 215, 85], wispInner: [255, 248, 195],
    ray: [255, 232, 120], rayFade: [255, 205, 60],
    coreInner: 'radial-gradient(ellipse, rgba(255,255,250,1) 0%, rgba(255,248,200,0.95) 20%, rgba(255,235,130,0.45) 50%, transparent 100%)',
    coreOuter: 'radial-gradient(ellipse, rgba(255,242,170,0.3) 0%, rgba(255,228,110,0.1) 35%, rgba(255,215,80,0.03) 55%, transparent 75%)',
    coreShadow: '0 0 30px rgba(255,240,130,0.5), 0 0 80px rgba(255,225,90,0.25), 0 0 150px rgba(240,200,60,0.1)',
    coreInnerSize: '12vmin', coreOuterSize: '28vmin',
    quote: { line: "Nel mezzo del cammin di nostra vita", sub: 'In the middle of the journey of our life', subDe: 'In der Mitte unseres Lebensweges', ref: 'Dante, Inferno I' },
  },
  // V12 — Nove Cieli: same palette as V9
  12: {
    ring: [255, 210, 70], dot: [255, 225, 100],
    wispOuter: [255, 215, 85], wispInner: [255, 248, 195],
    ray: [255, 232, 120], rayFade: [255, 205, 60],
    coreInner: 'radial-gradient(ellipse, rgba(255,255,250,1) 0%, rgba(255,248,200,0.95) 20%, rgba(255,235,130,0.45) 50%, transparent 100%)',
    coreOuter: 'radial-gradient(ellipse, rgba(255,242,170,0.3) 0%, rgba(255,228,110,0.1) 35%, rgba(255,215,80,0.03) 55%, transparent 75%)',
    coreShadow: '0 0 30px rgba(255,240,130,0.5), 0 0 80px rgba(255,225,90,0.25), 0 0 150px rgba(240,200,60,0.1)',
    coreInnerSize: '12vmin', coreOuterSize: '28vmin',
    quote: { line: 'Da quel punto depende il cielo e tutta la natura', sub: 'From that point depends the heavens and all of nature', subDe: 'Von jenem Punkt h\u00e4ngt der Himmel ab und die ganze Natur', ref: 'Dante, Paradiso XXVIII' },
  },
};


// ============ DATA GENERATION ============

interface StaticData {
  rings: RingData[];
  rays: RayData[];
  cfg: DataConfig;
}

function generateStatic(cfg: DataConfig): StaticData {
  const r = seededRandom(cfg.seed);

  const rings: RingData[] = Array.from({ length: cfg.ringCount }, (_, i) => {
    const t = i / cfg.ringCount;
    const dir = cfg.sameDirection ? 1 : (i % 2 === 0 ? 1 : -1);

    if (cfg.style === 'dore') {
      const innerFrac = Math.ceil(cfg.ringCount * 0.3);
      return {
        id: i,
        size: cfg.spiral ? cfg.maxRingSize : 4 + Math.pow(t, cfg.sizePower) * cfg.maxRingSize,
        dur: cfg.ringSpeedBase + i * cfg.ringSpeedPerRing + r() * 18,
        dir,
        op: cfg.ringOpMin + Math.sin(t * Math.PI) * (cfg.ringOpMax - cfg.ringOpMin),
        blur: cfg.spiral ? 0 : (i < innerFrac ? 1 + (1 - i / innerFrac) * 0.5 : 0),
        dots: cfg.dotsPerBand + Math.floor(i * cfg.dotsGrowth),
        wDur: cfg.wobbleDurBase + r() * cfg.wobbleDurRange,
        th: cfg.ringThMin + t * (cfg.ringThMax - cfg.ringThMin),
      };
    }

    return {
      id: i,
      size: 4 + Math.pow(t, 0.85) * cfg.maxRingSize,
      dur: cfg.ringSpeedBase + i * cfg.ringSpeedPerRing + r() * 18,
      dir,
      op: i < 5 ? 0.02 + (1 - i / 5) * 0.03 : 0.025 + Math.sin(t * Math.PI) * 0.065,
      blur: i < 3 ? 1.2 : Math.max(0, (i - cfg.ringCount * 0.75) * 0.15),
      dots: i < 4 ? 2 : 3 + Math.floor(i * 1.4),
      wDur: cfg.wobbleDurBase + r() * cfg.wobbleDurRange,
      th: i < 7 ? 0.7 : 0.9 + (t - 0.25) * 0.8,
    };
  });

  // Consume the same RNG calls that wisps would use, to keep ray seed stable
  for (let i = 0; i < cfg.wispCount; i++) {
    r(); // raw
    for (let j = 0; j < 8; j++) r(); // size, elong, orbDur, dir-calc, op, fDur, glow, delay
  }

  const rays: RayData[] = Array.from({ length: cfg.rayCount }, (_, i) => ({
    id: i,
    angle: (i / cfg.rayCount) * 360 + (r() - 0.5) * 4,
    len: 24 + r() * 28,
    w: cfg.rayWidthBase + r() * cfg.rayWidthRange,
    op: 0.01 + r() * 0.03,
    fDur: 4 + r() * 5,
    delay: r() * -8,
  }));

  return { rings, rays, cfg };
}

function generateWisps(cfg: DataConfig): WispData[] {
  const r = seededRandom(cfg.seed + 50000);
  const distMax = cfg.wispDistMax ?? 46;

  return Array.from({ length: cfg.wispCount }, (_, i) => {
    const raw = r();
    const biased = raw < 0.3 ? raw * 2 : 0.6 + (raw - 0.3) * 0.57;
    const dist = 4 + biased * distMax;
    const isOuter = biased > 0.55;
    return {
      id: i, dist, isOuter,
      size: isOuter ? 4 + r() * 7 : 1.5 + r() * 3.5,
      elong: isOuter ? 2.5 + r() * 2.5 : 1.5 + r() * 1.2,
      orbDur: 40 + dist * 0.7 + r() * 20,
      dir: Math.floor(dist) % 2 === 0 ? 1 : -1,
      op: isOuter ? 0.08 + r() * 0.22 : 0.03 + r() * 0.07,
      fDur: 3 + r() * 6,
      glow: 1.2 + r() * 1.5,
      delay: r() * -55,
    };
  });
}

// Pre-generate static data (rings + rays)
const ALL_STATIC: Record<number, StaticData> = {
  1: generateStatic(DATA_CONFIGS[1]),
  9: generateStatic(DATA_CONFIGS[9]),
  10: generateStatic(DATA_CONFIGS[10]),
  12: generateStatic(DATA_CONFIGS[12]),
};

// ============ COMPONENT ============

interface ParadisoTransitionProps {
  isActive: boolean;
  variant?: number;
  onAnimationComplete?: () => void;
  autoCompleteMs?: number;
}

const ParadisoTransition: FC<ParadisoTransitionProps> = ({ isActive, variant = 1, onAnimationComplete, autoCompleteMs = 10000 }) => {
  const [portalReady, setPortalReady] = useState(false);
  const { language } = useTranslation();
  const completeFiredRef = useRef(false);

  const validVariants = [1, 9, 10, 12] as const;
  const v = (validVariants.includes(variant as typeof validVariants[number]) ? variant : 1) as keyof typeof ALL_STATIC;
  const { rings, rays, cfg } = ALL_STATIC[v];
  const style = VARIANT_STYLES[v];

  const wisps = useMemo(() => generateWisps(cfg), [cfg]);

  useEffect(() => {
    if (!isActive) {
      setPortalReady(false);
      completeFiredRef.current = false;
      return;
    }
    const timer = setTimeout(() => setPortalReady(true), 400);
    return () => clearTimeout(timer);
  }, [isActive]);

  // Auto-complete: fire callback after autoCompleteMs
  useEffect(() => {
    if (!isActive || !onAnimationComplete) return;
    const timer = setTimeout(() => {
      if (!completeFiredRef.current) {
        completeFiredRef.current = true;
        onAnimationComplete();
      }
    }, autoCompleteMs);
    return () => clearTimeout(timer);
  }, [isActive, onAnimationComplete, autoCompleteMs]);

  if (!isActive) return null;

  const rgb = (c: [number, number, number], a: number) =>
    `rgba(${c[0]},${c[1]},${c[2]},${a})`;


  // Dot position + size helper — supports radial jitter and spiral paths
  const renderDot = (ringId: number, dotIndex: number, dotCount: number) => {
    // Deterministic per-dot RNG
    const dr = seededRandom(ringId * 100 + dotIndex);
    const dotSize = cfg.dotSizeMin + dr() * cfg.dotSizeRange;
    const pDur = 1.5 + dr() * 3;
    const pDelay = -dr() * 5;

    let top: number;
    let left: number;

    if (cfg.spiral) {
      const turns = cfg.spiralTurns ?? 1.5;
      const t = dotIndex / dotCount;
      const spiralAngle = t * 360 * turns;
      const spiralRad = (spiralAngle * Math.PI) / 180;

      // Golden spiral: radius grows exponentially (like galaxies/flowers)
      // Regular: sqrt(t) distributes dots evenly by area
      const maxR = cfg.maxRingSize * 0.85;
      const baseRadius = cfg.spiralGolden
        ? 3 + (Math.pow(Math.E, t * 3.5) - 1) / (Math.pow(Math.E, 3.5) - 1) * maxR
        : 5 + Math.sqrt(t) * 42;

      // Taper: jitter increases toward edge, arms dissolve
      const jitterAmount = cfg.spiralTaper
        ? cfg.dotRadialJitter * (0.3 + t * 3.5)
        : cfg.dotRadialJitter;
      const jitter = jitterAmount > 0 ? (dr() - 0.5) * jitterAmount : 0;
      const radius = baseRadius + jitter;

      top = 50 + radius * Math.sin(spiralRad);
      left = 50 + radius * Math.cos(spiralRad);

      // Streaks: elongate dot along spiral tangent direction
      if (cfg.spiralStreaks) {
        const tangentAngle = spiralRad + Math.PI / 2; // perpendicular to radial = along curve
        const streakLen = dotSize * (1.5 + t * 3); // longer streaks at edge
        const streakW = dotSize * 0.6;
        const fadedOp = cfg.spiralFadeOut ? (1 - t * 0.75) : 1; // bright center, fading edge
        const rotation = (tangentAngle * 180) / Math.PI;

        return (
          <div
            key={dotIndex}
            className="pt-ring-dot"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${streakLen}px`,
              height: `${streakW}px`,
              marginTop: `${-streakW / 2}px`,
              marginLeft: `${-streakLen / 2}px`,
              borderRadius: '40%',
              transform: `rotate(${rotation}deg)`,
              background: `radial-gradient(ellipse, ${rgb(style.dot, 0.9 * fadedOp)} 0%, ${rgb(style.dot, 0.3 * fadedOp)} 40%, ${rgb(style.dot, 0)} 80%)`,
              animation: `pt-dot-pulse ${pDur}s ease-in-out infinite`,
              animationDelay: `${pDelay}s`,
            }}
          />
        );
      }

      // Fade-out only (no streaks)
      if (cfg.spiralFadeOut) {
        const fadedOp = 1 - t * 0.75;
        return (
          <div
            key={dotIndex}
            className="pt-ring-dot"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              marginTop: `${-dotSize / 2}px`,
              marginLeft: `${-dotSize / 2}px`,
              background: `radial-gradient(circle, ${rgb(style.dot, 0.9 * fadedOp)} 0%, ${rgb(style.dot, 0)} 70%)`,
              animation: `pt-dot-pulse ${pDur}s ease-in-out infinite`,
              animationDelay: `${pDelay}s`,
            }}
          />
        );
      }
    } else {
      // Circular: dots around the ring circumference
      const angle = (dotIndex / dotCount) * 360;
      const rad = (angle * Math.PI) / 180;
      const baseRadius = 47;
      const jitter = cfg.dotRadialJitter > 0 ? (dr() - 0.5) * cfg.dotRadialJitter : 0;
      const radius = baseRadius + jitter;
      top = 50 + radius * Math.sin(rad);
      left = 50 + radius * Math.cos(rad);
    }

    return (
      <div
        key={dotIndex}
        className="pt-ring-dot"
        style={{
          top: `${top}%`,
          left: `${left}%`,
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          marginTop: `${-dotSize / 2}px`,
          marginLeft: `${-dotSize / 2}px`,
          background: `radial-gradient(circle, ${rgb(style.dot, cfg.spiral ? 0.9 : 0.6)} 0%, ${rgb(style.dot, 0)} 70%)`,
          animation: `pt-dot-pulse ${pDur}s ease-in-out infinite`,
          animationDelay: `${pDelay}s`,
        }}
      />
    );
  };

  return (
    <>
    <div className="paradiso-transition" data-variant={v}>
      {/* Background — transparent, keeps the cosmic blue behind */}
      <div className={`pt-background ${portalReady ? 'pt-visible' : ''}`} />

      {/* Light rays */}
      <div className="pt-center-anchor" style={{ zIndex: 1 }}>
        {portalReady &&
          rays.map((r) => (
            <div
              key={r.id}
              className="pt-ray"
              style={{
                transform: `rotate(${r.angle}deg)`,
                width: `${r.len}vmin`,
                height: `${r.w}px`,
                clipPath: 'polygon(0% 15%, 100% 42%, 100% 58%, 0% 85%)',
                background: `linear-gradient(90deg, ${rgb(style.ray, r.op * 2.5)} 0%, ${rgb(style.rayFade, r.op)} 35%, transparent 100%)`,
                animation: `pt-ray-flicker ${r.fDur}s ease-in-out infinite`,
                animationDelay: `${r.delay}s`,
              }}
            />
          ))}
      </div>

      {/* Concentric rings / bands */}
      <div className="pt-center-anchor" style={{ zIndex: 3 }}>
        {portalReady && (
          <div className="pt-rings-burst">
            {rings.map((ring) => (
              <div
                key={ring.id}
                className="pt-ring-wrapper"
                style={{
                  width: `${ring.size}vmin`,
                  height: `${ring.size }vmin`,
                  animation: `${ring.dir > 0 ? 'pt-spin' : 'pt-spin-reverse'} ${ring.dur}s linear infinite`,
                  animationDelay: cfg.spiral ? `${-(ring.dur * ring.id / rings.length)}s` : undefined,
                  filter: ring.blur > 0 ? `blur(${ring.blur}px)` : undefined,
                }}
              >
                <div
                  className="pt-ring-inner"
                  style={{
                    border: `${ring.th}px solid ${rgb(style.ring, ring.op)}`,
                    boxShadow: `0 0 ${2 + ring.id * 0.3}px ${rgb(style.ring, ring.op * 0.3)}`,
                    animation: `pt-wobble ${ring.wDur}s ease-in-out infinite`,
                    animationDelay: `${-ring.id * 0.5}s`,
                  }}
                >
                  {Array.from({ length: ring.dots }, (_, j) => renderDot(ring.id, j, ring.dots))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wisps */}
      <div className="pt-center-anchor" style={{ zIndex: 4 }}>
        {portalReady && (
          <div className="pt-wisps-burst">
            {wisps.map((w) => (
              <div
                key={w.id}
                className="pt-wisp-orbit"
                style={{
                  width: `${w.dist * 2}vmin`,
                  height: `${w.dist * 2 }vmin`,
                  animation: `${w.dir > 0 ? 'pt-spin' : 'pt-spin-reverse'} ${w.orbDur}s linear infinite`,
                  animationDelay: `${w.delay}s`,
                }}
              >
                <div
                  className="pt-wisp-glow"
                  style={{
                    opacity: w.op,
                    width: `${w.size * w.glow * 2.5}px`,
                    height: `${w.size * w.elong * w.glow * 2}px`,
                    animation: `pt-wisp-flicker ${w.fDur}s ease-in-out infinite`,
                    animationDelay: `${-w.id * 0.5}s`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '42%',
                      background: `radial-gradient(ellipse at 50% 35%, ${rgb(w.isOuter ? style.wispOuter : style.wispInner, w.isOuter ? 0.1 : 0.05)} 0%, transparent 65%)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                      width: `${w.size * 0.5}px`, height: `${w.size * w.elong}px`, borderRadius: '38%',
                      background: `radial-gradient(ellipse at 50% 30%, ${rgb(w.isOuter ? style.wispInner : style.wispOuter, w.isOuter ? 0.4 : 0.2)} 0%, transparent 60%)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Core glow */}
      <div className="pt-center-anchor" style={{ zIndex: 5 }}>
        {portalReady && (
          <>
            <div
              className="pt-core-inner"
              style={{
                width: style.coreInnerSize, height: style.coreInnerSize,
                background: style.coreInner, boxShadow: style.coreShadow,
              }}
            />
            <div
              className="pt-core-outer"
              style={{
                width: style.coreOuterSize, height: style.coreOuterSize,
                background: style.coreOuter,
              }}
            />
          </>
        )}
      </div>

      {/* Vignette */}
      <div className="pt-vignette" />

      {/* Film grain */}
      <div className="pt-grain" />
    </div>

    {/* Quote — rendered outside paradiso-transition to avoid mobile scale(1.6) */}
    {portalReady && (
      <div className="pt-welcome">
        <p className="pt-welcome-sub">{language === 'de' ? style.quote.subDe : style.quote.sub}</p>
        <p className="pt-welcome-ref">{style.quote.ref}</p>
      </div>
    )}
    </>
  );
};

export default ParadisoTransition;
