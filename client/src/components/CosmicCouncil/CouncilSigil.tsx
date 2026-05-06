import React, { FC, useMemo } from 'react';
import { ThemeId } from '../../data/councilCatalog';

/**
 * Generative SVG sigils for council cards.
 * Each theme has a distinct pattern type. Each card gets a unique
 * variation seeded by its sortOrder. Pure SVG, no external deps.
 */

interface CouncilSigilProps {
  theme: ThemeId;
  seed: number;
  color: string;
}

function seededRandom(seed: number) {
  let s = Math.abs(seed * 137 + 12345) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Loss & Grief: fracture lines (cracks, breaks)
function Fracture({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  for (let i = 0; i < 6; i++) {
    const x1 = r() * 200, y1 = r() * 200;
    const x2 = x1 + (r() - 0.5) * 140, y2 = y1 + (r() - 0.5) * 140;
    const cx = (x1 + x2) / 2 + (r() - 0.5) * 50;
    const cy = (y1 + y2) / 2 + (r() - 0.5) * 50;
    els.push(<path key={i} d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} stroke={color} strokeWidth={0.6 + r()} fill="none" opacity={0.12 + r() * 0.15} />);
  }
  for (let i = 0; i < 3; i++) {
    els.push(<circle key={`d${i}`} cx={r() * 200} cy={r() * 200} r={1 + r() * 2} fill={color} opacity={0.15 + r() * 0.1} />);
  }
  return <>{els}</>;
}

// Love & Connection: flowing waves
function Wave({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  for (let i = 0; i < 4; i++) {
    const yBase = 25 + i * 45 + (r() - 0.5) * 20;
    const amp = 10 + r() * 22, freq = 0.7 + r() * 1.2;
    let d = `M0 ${yBase}`;
    for (let x = 0; x <= 200; x += 5) {
      d += ` L${x} ${yBase + Math.sin((x * freq * Math.PI) / 100 + i * 1.2) * amp}`;
    }
    els.push(<path key={i} d={d} stroke={color} strokeWidth={0.5 + r() * 0.7} fill="none" opacity={0.1 + r() * 0.12} />);
  }
  return <>{els}</>;
}

// Who Am I?: concentric echoes (ripples of self)
function Echo({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  const cx = 85 + r() * 30, cy = 85 + r() * 30;
  for (let i = 0; i < 5; i++) {
    const radius = 12 + i * 20 + r() * 10;
    els.push(<ellipse key={i} cx={cx + (r() - 0.5) * 6} cy={cy + (r() - 0.5) * 6} rx={radius} ry={radius * (0.6 + r() * 0.5)} transform={`rotate(${r() * 360} ${cx} ${cy})`} stroke={color} strokeWidth={0.4 + r() * 0.7} fill="none" opacity={0.08 + r() * 0.12} />);
  }
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2, d = 15 + r() * 50;
    els.push(<circle key={`p${i}`} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d} r={0.8 + r() * 1.5} fill={color} opacity={0.15 + r() * 0.1} />);
  }
  return <>{els}</>;
}

// Meaning & Purpose: constellation (dots and connecting lines)
function Constellation({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  const points: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    points.push([20 + r() * 160, 20 + r() * 160]);
  }
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    els.push(<circle key={`s${i}`} cx={x} cy={y} r={1 + r() * 2.5} fill={color} opacity={0.15 + r() * 0.15} />);
    if (i > 0 && r() > 0.3) {
      const j = Math.floor(r() * i);
      els.push(<line key={`l${i}`} x1={x} y1={y} x2={points[j][0]} y2={points[j][1]} stroke={color} strokeWidth={0.3 + r() * 0.5} opacity={0.08 + r() * 0.08} />);
    }
  }
  return <>{els}</>;
}

// Freedom & Justice: burst (radiating lines)
function Burst({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  const cx = 90 + (r() - 0.5) * 40, cy = 90 + (r() - 0.5) * 40;
  const count = 9 + Math.floor(r() * 6);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + r() * 0.3;
    const len = 25 + r() * 75;
    els.push(<line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * len} y2={cy + Math.sin(angle) * len} stroke={color} strokeWidth={0.3 + r() * 0.6} opacity={0.08 + r() * 0.14} />);
  }
  els.push(<circle key="c" cx={cx} cy={cy} r={2 + r() * 3} fill="none" stroke={color} strokeWidth={0.6} opacity={0.2} />);
  return <>{els}</>;
}

// Faith, Death & Mystery: spiral
function Spiral({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  const cx = 90 + r() * 20, cy = 90 + r() * 20;
  for (let s = 0; s < 2; s++) {
    let d = `M${cx} ${cy}`;
    const dir = s === 0 ? 1 : -1;
    for (let i = 0; i < 80; i++) {
      const angle = (i / 12) * Math.PI * dir + r() * 0.1;
      const dist = 3 + i * (1.2 + r() * 0.3);
      d += ` L${cx + Math.cos(angle) * dist} ${cy + Math.sin(angle) * dist}`;
    }
    els.push(<path key={`sp${s}`} d={d} stroke={color} strokeWidth={0.4 + r() * 0.5} fill="none" opacity={0.08 + r() * 0.1} />);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2, d = 20 + r() * 60;
    els.push(<circle key={`d${i}`} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d} r={0.6 + r()} fill={color} opacity={0.12 + r() * 0.1} />);
  }
  return <>{els}</>;
}

// The Moral Life: lattice (intersecting lines, web of obligations)
function Lattice({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  for (let i = 0; i < 6; i++) {
    const x1 = r() * 200, y1 = r() * 30;
    const x2 = r() * 200, y2 = 170 + r() * 30;
    els.push(<line key={`v${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.3 + r() * 0.4} opacity={0.06 + r() * 0.08} />);
  }
  for (let i = 0; i < 4; i++) {
    const y = 30 + i * 45 + (r() - 0.5) * 20;
    els.push(<line key={`h${i}`} x1={0} y1={y} x2={200} y2={y + (r() - 0.5) * 30} stroke={color} strokeWidth={0.3 + r() * 0.4} opacity={0.06 + r() * 0.08} />);
  }
  for (let i = 0; i < 4; i++) {
    els.push(<circle key={`n${i}`} cx={30 + r() * 140} cy={30 + r() * 140} r={1.5 + r() * 2} fill={color} opacity={0.12 + r() * 0.1} />);
  }
  return <>{els}</>;
}

// Mind & Creativity: orbits (circles and arcs, thought patterns)
function Orbit({ seed, color }: { seed: number; color: string }) {
  const r = seededRandom(seed);
  const els: React.ReactElement[] = [];
  const cx = 100 + (r() - 0.5) * 30, cy = 100 + (r() - 0.5) * 30;
  for (let i = 0; i < 4; i++) {
    const radius = 20 + i * 22 + r() * 15;
    const startAngle = r() * Math.PI * 2;
    const arcLen = Math.PI * (0.8 + r() * 1.2);
    const x1 = cx + Math.cos(startAngle) * radius;
    const y1 = cy + Math.sin(startAngle) * radius;
    const x2 = cx + Math.cos(startAngle + arcLen) * radius;
    const y2 = cy + Math.sin(startAngle + arcLen) * radius;
    els.push(<path key={`a${i}`} d={`M${x1} ${y1} A${radius} ${radius} 0 ${arcLen > Math.PI ? 1 : 0} 1 ${x2} ${y2}`} stroke={color} strokeWidth={0.4 + r() * 0.5} fill="none" opacity={0.08 + r() * 0.1} />);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2, d = 15 + r() * 60;
    els.push(<circle key={`p${i}`} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d} r={1 + r() * 2} fill={color} opacity={0.15 + r() * 0.1} />);
  }
  return <>{els}</>;
}

const SIGIL_MAP: Record<ThemeId, FC<{ seed: number; color: string }>> = {
  'loss-grief': Fracture,
  'love-connection': Wave,
  'who-am-i': Echo,
  'meaning-purpose': Constellation,
  'freedom-justice': Burst,
  'faith-death-mystery': Spiral,
  'moral-life': Lattice,
  'mind-creativity': Orbit,
};

const CouncilSigil: FC<CouncilSigilProps> = ({ theme, seed, color }) => {
  const SigilComponent = SIGIL_MAP[theme];

  const content = useMemo(() => {
    if (!SigilComponent) return null;
    return <SigilComponent seed={seed} color={color} />;
  }, [SigilComponent, seed, color]);

  if (!content) return null;

  return (
    <svg
      viewBox="0 0 200 200"
      className="council-card__sigil"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
};

export default CouncilSigil;
