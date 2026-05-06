// @ts-nocheck
/* eslint-disable */
/**
 * 55 unique SVG artworks for council cards.
 * Source: docs/svg mockups/councilArt.jsx
 * Each takes a color prop (CSS variable string).
 */
import React, { FC } from "react";

/*
 * COSMIC COUNCIL — 55 Unique SVG Artworks
 * Each council gets a hand-crafted abstract composition
 * that embodies its central question.
 *
 * Usage: import { councilArt } from './councilArt';
 *        const ArtComponent = councilArt['the-empty-room'];
 *        <ArtComponent color="#e85d75" />
 */

/* ═══════════════════════════════════════════════
   LOSS & GRIEF — Fracture palette
   ═══════════════════════════════════════════════ */

/* 1. The Empty Room ★ HERO — Dissolving doorframe, afterimage of presence */
function TheEmptyRoom({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="er1" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="transparent"/>
          <stop offset="50%" stopColor={color} stopOpacity="0.07"/>
          <stop offset="100%" stopColor="transparent"/>
        </linearGradient>
        <filter id="er2"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <rect width="400" height="300" fill="url(#er1)"/>
      {/* Floor perspective */}
      {[...Array(9)].map((_,i) => (
        <line key={`f${i}`} x1={200} y1={135} x2={40+i*44} y2={300} stroke={color} strokeWidth="0.3" opacity={0.06+i*0.008}/>
      ))}
      {/* Doorframe — solid left, dissolving right */}
      <path d="M155 45 L155 245" stroke={color} strokeWidth="1.6" opacity="0.35"/>
      <path d="M245 45 L245 245" stroke={color} strokeWidth="1.4" opacity="0.18" strokeDasharray="6 14"/>
      <path d="M155 45 L245 45" stroke={color} strokeWidth="1.4" opacity="0.25" strokeDasharray="4 8"/>
      {/* Ghost doorframe */}
      <path d="M150 50 L150 240" stroke={color} strokeWidth="0.4" opacity="0.08" strokeDasharray="2 12"/>
      {/* Chair suggestion — absent presence */}
      <path d="M185 195 L185 215 M215 195 L215 215 M183 195 L217 195" stroke={color} strokeWidth="0.6" opacity="0.1" strokeDasharray="2 4"/>
      {/* Warm glow where person was */}
      <ellipse cx="200" cy="180" rx="25" ry="15" fill={color} opacity="0.04" filter="url(#er2)"/>
      <ellipse cx="200" cy="140" rx="15" ry="35" fill={color} opacity="0.03" filter="url(#er2)"/>
      {/* Dissolving particles from right side of frame */}
      {[...Array(28)].map((_,i) => {
        const x = 245 + Math.sin(i*1.4)*(8+i*1.5);
        const y = 50 + i*7.2;
        return <rect key={i} x={x} y={y} width={1+Math.random()*2.2} height={1+Math.random()*1.8} fill={color} opacity={0.1-i*0.003} transform={`rotate(${i*12} ${x} ${y})`}/>;
      })}
    </svg>
  );
}

/* 2. Becoming the Parent — Inverted shelter, inheriting the arch */
function BecomingTheParent({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <radialGradient id="bp1g" cx="50%" cy="35%" r="50%"><stop offset="0%" stopColor={color} stopOpacity="0.12"/><stop offset="100%" stopColor="transparent"/></radialGradient>
        <filter id="bp1f"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <rect width="400" height="300" fill="url(#bp1g)"/>
      {/* Large dissolving arch — the one who sheltered you */}
      <path d="M80 270 Q90 60 200 30 Q310 60 320 270" stroke={color} strokeWidth="2.5" fill="none" opacity="0.12" strokeDasharray="6 10"/>
      <path d="M90 265 Q100 70 200 42 Q300 70 310 265" stroke={color} strokeWidth="1.5" fill="none" opacity="0.08" strokeDasharray="4 14"/>
      {/* Dissolving particles from old arch */}
      {[...Array(18)].map((_,i) => {
        const a = (i/18)*Math.PI; const r = 110+i*3;
        const x = 200+Math.cos(a)*r; const y = 30+Math.sin(a)*r*0.6;
        return <rect key={`d${i}`} x={x} y={y} width={2+i%3} height={1.5+i%2} fill={color} opacity={0.04+i*0.003} transform={`rotate(${i*20} ${x} ${y})`}/>;
      })}
      {/* New solid arch — you, becoming the shelter */}
      <path d="M130 270 Q140 120 200 95 Q260 120 270 270" stroke={color} strokeWidth="2" fill="none" opacity="0.4"/>
      <path d="M138 268 Q147 128 200 104 Q253 128 262 268" stroke={color} strokeWidth="1" fill="none" opacity="0.2"/>
      {/* Hands reaching between arches */}
      <path d="M165 140 Q180 110 195 90" stroke={color} strokeWidth="0.8" fill="none" opacity="0.2"/>
      <path d="M235 140 Q220 110 205 90" stroke={color} strokeWidth="0.8" fill="none" opacity="0.2"/>
      {/* Keystone where arches meet */}
      <circle cx="200" cy="62" r="6" fill={color} opacity="0.08" filter="url(#bp1f)"/>
      <circle cx="200" cy="62" r="2" fill={color} opacity="0.3"/>
      {/* Grounding figure below */}
      <line x1="200" y1="180" x2="200" y2="220" stroke={color} strokeWidth="1" opacity="0.15"/>
      <circle cx="200" cy="174" r="5" fill="none" stroke={color} strokeWidth="0.7" opacity="0.15"/>
      {/* Warmth transfer particles */}
      {[...Array(10)].map((_,i) => {
        const t=i/10; const x=200+Math.sin(t*6)*25; const y=80+t*100;
        return <circle key={i} cx={x} cy={y} r={0.8+t} fill={color} opacity={0.08+t*0.06}/>;
      })}
    </svg>
  );
}

/* 3. The Uninvited Guest — Body invaded by foreign geometry */
function TheUninvitedGuest({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ug1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Organic body silhouette */}
      <path d="M170 50 Q160 80 155 120 Q150 170 160 210 Q170 250 185 270" stroke={color} strokeWidth="1.2" fill="none" opacity="0.28"/>
      <path d="M230 50 Q240 80 245 120 Q250 170 240 210 Q230 250 215 270" stroke={color} strokeWidth="1.2" fill="none" opacity="0.28"/>
      {/* Foreign geometric intrusions from the right */}
      <polygon points="260,100 235,115 240,140 270,130" fill="none" stroke={color} strokeWidth="0.9" opacity="0.2"/>
      <polygon points="275,140 245,150 250,175 280,168" fill="none" stroke={color} strokeWidth="0.7" opacity="0.16"/>
      <polygon points="265,170 240,182 242,200 268,195" fill="none" stroke={color} strokeWidth="0.6" opacity="0.12"/>
      {/* Intrusion penetrating the body outline */}
      <line x1="260" y1="100" x2="225" y2="112" stroke={color} strokeWidth="0.8" opacity="0.18"/>
      <line x1="275" y1="140" x2="235" y2="148" stroke={color} strokeWidth="0.6" opacity="0.14"/>
      {/* Deformation in body outline where intrusions enter */}
      <path d="M245 110 Q255 115 248 125" stroke={color} strokeWidth="0.8" fill="none" opacity="0.2"/>
      {/* Spore particles at breach points */}
      {[...Array(15)].map((_,i) => {
        const x = 230+Math.sin(i*2)*25+i*2;
        const y = 100+i*8+Math.cos(i*1.5)*10;
        return <circle key={i} cx={x} cy={y} r={0.5+Math.random()*1.5} fill={color} opacity={0.08+Math.random()*0.08}/>;
      })}
      {/* Inner glow of distress */}
      <ellipse cx="200" cy="150" rx="30" ry="60" fill={color} opacity="0.03" filter="url(#ug1)"/>
    </svg>
  );
}

/* 4. What Carried You Through — Single thread through chaos */
function WhatCarriedYouThrough({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="wc1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {/* Chaotic broken lines field */}
      {[...Array(40)].map((_,i) => {
        const x = 50+Math.random()*300; const y = 20+Math.random()*260;
        const dx = (Math.random()-0.5)*50; const dy = (Math.random()-0.5)*30;
        return <line key={i} x1={x} y1={y} x2={x+dx} y2={y+dy} stroke={color} strokeWidth={0.3+Math.random()*0.5} opacity={0.05+Math.random()*0.07}/>;
      })}
      {/* The single unbroken thread */}
      <path d="M180 285 Q175 260 185 235 Q200 210 190 185 Q175 165 185 140 Q198 120 192 95 Q185 75 195 50 Q205 30 200 15"
        stroke={color} strokeWidth="1.4" fill="none" opacity="0.35" filter="url(#wc1)"/>
      <path d="M180 285 Q175 260 185 235 Q200 210 190 185 Q175 165 185 140 Q198 120 192 95 Q185 75 195 50 Q205 30 200 15"
        stroke={color} strokeWidth="0.7" fill="none" opacity="0.5"/>
      {/* Nodes along the thread — things that held */}
      {[[185,235],[190,185],[185,140],[192,95],[195,50]].map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3} fill={color} opacity="0.08" filter="url(#wc1)"/>
          <circle cx={x} cy={y} r={1.2} fill={color} opacity="0.2"/>
        </g>
      ))}
    </svg>
  );
}

/* 5. The Meaning of Pain — Fissure with crystal on one side, ash on the other */
function TheMeaningOfPain({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="mp1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff4444" stopOpacity="0.3"/>
          <stop offset="50%" stopColor={color} stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#440000" stopOpacity="0.15"/>
        </linearGradient>
        <filter id="mp2"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      {/* Central fissure */}
      <path d="M200 10 L196 45 L204 80 L193 115 L207 150 L195 185 L205 220 L198 255 L200 290" stroke="url(#mp1)" strokeWidth="2.5" fill="none" filter="url(#mp2)"/>
      <path d="M200 10 L196 45 L204 80 L193 115 L207 150 L195 185 L205 220 L198 255 L200 290" stroke={color} strokeWidth="1" fill="none" opacity="0.7"/>
      {/* Left side: crystalline forms (meaning emerges) */}
      <polygon points="140,80 160,65 175,85 165,100 145,95" fill="none" stroke={color} strokeWidth="0.7" opacity="0.2"/>
      <polygon points="125,120 148,108 165,125 150,140 128,135" fill="none" stroke={color} strokeWidth="0.6" opacity="0.18"/>
      <polygon points="135,165 155,155 168,172 155,185 138,178" fill="none" stroke={color} strokeWidth="0.5" opacity="0.15"/>
      {/* Right side: dissolving ash */}
      {[...Array(20)].map((_,i) => {
        const x = 215+Math.random()*80; const y = 60+i*11;
        return <circle key={i} cx={x} cy={y} r={0.5+Math.random()*2} fill={color} opacity={0.06+Math.random()*0.06}/>;
      })}
      {/* Ember glow at core */}
      <ellipse cx="200" cy="150" rx="15" ry="80" fill={color} opacity="0.05" filter="url(#mp2)"/>
    </svg>
  );
}

/* 6. The Public Wreckage — Shattered mirror cascade */
function ThePublicWreckage({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="pw1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {[
        [140,35,180,28,178,85,135,82],[195,22,248,30,244,78,192,72],[175,85,218,80,225,145,168,142],
        [115,95,162,90,158,148,110,145],[232,75,288,68,284,128,238,130],[168,148,212,142,220,205,162,210],
        [95,155,148,152,145,215,90,212],[222,140,278,135,274,198,228,192],[155,215,208,210,204,272,150,268],
        [218,200,272,195,268,258,222,255],[90,220,145,218,142,275,85,272],[268,195,328,190,324,255,262,248]
      ].map((pts,i) => (
        <g key={i}>
          <polygon points={pts.join(',')} fill="none" stroke={color} strokeWidth={0.5} opacity={0.18-i*0.01}/>
          <polygon points={pts.join(',')} fill={color} opacity={0.015+Math.sin(i)*0.01}/>
        </g>
      ))}
      {/* Bright edge highlights */}
      <line x1="180" y1="28" x2="178" y2="85" stroke={color} strokeWidth="0.7" opacity="0.25" filter="url(#pw1)"/>
      <line x1="218" y1="80" x2="225" y2="145" stroke={color} strokeWidth="0.5" opacity="0.18"/>
      {/* Falling debris */}
      {[...Array(12)].map((_,i) => (
        <circle key={`d${i}`} cx={75+Math.sin(i*2.1)*160+i*15} cy={25+i*20} r={0.5+Math.random()*1.2} fill={color} opacity={0.12+Math.random()*0.08}/>
      ))}
    </svg>
  );
}

/* 7. Laughing at the Abyss — Grin over the void */
function LaughingAtTheAbyss({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <radialGradient id="la1" cx="50%" cy="48%" r="25%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <filter id="la2"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      {/* The void */}
      <circle cx="200" cy="142" r="55" fill="url(#la1)"/>
      <circle cx="200" cy="142" r="55" fill="none" stroke={color} strokeWidth="0.4" opacity="0.08"/>
      {/* The grin — wide, trembling, defiant */}
      <path d="M140 155 Q155 185 200 192 Q245 185 260 155" stroke={color} strokeWidth="1.8" fill="none" opacity="0.35" filter="url(#la2)"/>
      <path d="M142 155 Q157 183 200 190 Q243 183 258 155" stroke={color} strokeWidth="0.8" fill="none" opacity="0.45"/>
      {/* Sparks from the smile */}
      {[...Array(10)].map((_,i) => {
        const side = i < 5 ? -1 : 1;
        const x = (side < 0 ? 140 : 260) + side*(5+i*3);
        const y = 155 - i*4 + Math.sin(i*2)*8;
        return <circle key={i} cx={x} cy={y} r={0.6+Math.random()*1.2} fill={color} opacity={0.15+Math.random()*0.1}/>;
      })}
      {/* Eye-sparks above — two bright points */}
      <circle cx="180" cy="118" r="2" fill={color} opacity="0.18" filter="url(#la2)"/>
      <circle cx="220" cy="118" r="2" fill={color} opacity="0.18" filter="url(#la2)"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   LOVE & CONNECTION — Wave palette
   ═══════════════════════════════════════════════ */

/* 8. Alone in the Room Full of People — Dense crowd, hollow center */
function AloneInTheRoomFullOfPeople({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><radialGradient id="ar1" cx="50%" cy="50%" r="28%"><stop offset="0%" stopColor="transparent"/><stop offset="100%" stopColor={color} stopOpacity="0.05"/></radialGradient></defs>
      <rect width="400" height="300" fill="url(#ar1)"/>
      {[...Array(65)].map((_,i) => {
        const x = (i%13)*32+8+Math.sin(i*1.3)*6;
        const y = Math.floor(i/13)*56+18+Math.sin(i*0.8)*8;
        const dx = x-200, dy = y-150;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < 50) return null;
        const h = 22+Math.random()*14;
        return <line key={i} x1={x} y1={y} x2={x+Math.sin(i)*1.5} y2={y+h} stroke={color} strokeWidth={0.5+Math.random()*0.7} opacity={Math.min(0.22,0.06+(dist/200)*0.14)} strokeLinecap="round"/>;
      })}
      <circle cx="200" cy="150" r="45" fill="none" stroke={color} strokeWidth="0.25" opacity="0.1" strokeDasharray="1 5"/>
      <line x1="200" y1="138" x2="200" y2="162" stroke={color} strokeWidth="0.7" opacity="0.13"/>
      <circle cx="200" cy="133" r="3" fill="none" stroke={color} strokeWidth="0.4" opacity="0.1"/>
    </svg>
  );
}

/* 9. The Undoing of Two — Splitting double helix */
function TheUndoingOfTwo({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ut1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Two intertwined paths — woven below, splitting above */}
      <path d="M185 280 Q210 255 190 230 Q170 210 195 185 Q215 165 190 145 Q170 130 185 110 Q200 90 175 65 Q155 45 160 20" stroke={color} strokeWidth="1.2" fill="none" opacity="0.3" filter="url(#ut1)"/>
      <path d="M215 280 Q190 255 210 230 Q230 210 205 185 Q185 165 210 145 Q230 130 215 110 Q200 90 225 65 Q245 45 240 20" stroke={color} strokeWidth="1.2" fill="none" opacity="0.3" filter="url(#ut1)"/>
      {/* Connecting filaments between the splitting strands */}
      {[[192,110,208,110],[180,90,220,90],[172,72,228,68],[165,55,235,50],[162,38,238,32]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.3} opacity={0.15-i*0.025} strokeDasharray="2 3"/>
      ))}
      {/* Particles where strands separate */}
      {[...Array(8)].map((_,i) => (
        <circle key={i} cx={185+Math.sin(i*1.8)*30} cy={60+i*8} r={0.5+Math.random()*1} fill={color} opacity={0.1+Math.random()*0.06}/>
      ))}
    </svg>
  );
}

/* 10. Choosing to Be Alone — Single perfect circle, vast space */
function ChoosingToBeAlone({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="ca1"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="ca2"><feGaussianBlur stdDeviation="2"/></filter>
        <radialGradient id="ca3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.06"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Inner glow field */}
      <circle cx="190" cy="145" r="60" fill="url(#ca3)"/>
      {/* Core circle — clean and defined */}
      <circle cx="190" cy="145" r="32" fill="none" stroke={color} strokeWidth="1.2" opacity="0.32"/>
      {/* Gentle inner glow */}
      <circle cx="190" cy="145" r="25" fill={color} opacity="0.04" filter="url(#ca1)"/>
      {/* Concentric ripples emanating outward */}
      <circle cx="190" cy="145" r="48" fill="none" stroke={color} strokeWidth="0.5" opacity="0.14"/>
      <circle cx="190" cy="145" r="66" fill="none" stroke={color} strokeWidth="0.4" opacity="0.1"/>
      <circle cx="190" cy="145" r="86" fill="none" stroke={color} strokeWidth="0.3" opacity="0.07"/>
      <circle cx="190" cy="145" r="108" fill="none" stroke={color} strokeWidth="0.25" opacity="0.045"/>
      <circle cx="190" cy="145" r="132" fill="none" stroke={color} strokeWidth="0.2" opacity="0.025"/>
      {/* Floating motes — solitary particles in the space */}
      {[[142,98,1.2],[248,112,0.9],[120,188,1.0],[255,192,0.8],[170,58,0.7],[222,228,1.1],[98,145,0.6]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.06+i*0.008} filter="url(#ca2)"/>
      ))}
    </svg>
  );
}

/* 11. Where Do You Belong? — Compass dissolving into roots */
function WhereDoYouBelong({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="wb1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Bold center point */}
      <circle cx="200" cy="150" r="4" fill={color} opacity="0.25"/>
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.06" filter="url(#wb1)"/>
      {/* North — straight, structural */}
      <line x1="200" y1="146" x2="200" y2="42" stroke={color} strokeWidth="1.2" opacity="0.22"/>
      <path d="M200 42 Q196 35 190 30" stroke={color} strokeWidth="0.6" fill="none" opacity="0.12"/>
      <path d="M200 42 Q204 36 208 32" stroke={color} strokeWidth="0.5" fill="none" opacity="0.1"/>
      {/* South — dissolving into roots */}
      <path d="M200 154 L200 260 Q195 270 188 275 Q178 280 170 282" stroke={color} strokeWidth="1.2" fill="none" opacity="0.2"/>
      <path d="M188 275 Q182 278 175 276" stroke={color} strokeWidth="0.5" fill="none" opacity="0.1"/>
      <path d="M170 282 Q165 285 158 283" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08"/>
      <path d="M200 260 Q206 268 214 272 Q222 275 228 280" stroke={color} strokeWidth="0.5" fill="none" opacity="0.1"/>
      {/* East — organic curve with root branches */}
      <path d="M204 150 L310 150 Q320 155 325 165 Q328 178 330 188" stroke={color} strokeWidth="1.2" fill="none" opacity="0.18"/>
      <path d="M330 188 Q332 196 328 202" stroke={color} strokeWidth="0.5" fill="none" opacity="0.1"/>
      <path d="M325 165 Q332 162 338 165" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08"/>
      {/* West — organic curve with root branches */}
      <path d="M196 150 L90 150 Q80 148 72 142 Q65 135 58 132" stroke={color} strokeWidth="1.2" fill="none" opacity="0.18"/>
      <path d="M58 132 Q52 128 48 132" stroke={color} strokeWidth="0.5" fill="none" opacity="0.1"/>
      <path d="M72 142 Q66 146 60 148" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08"/>
      {/* Diagonal root-lines */}
      <path d="M200 150 L265 85 Q275 78 282 72 Q290 62 295 58" stroke={color} strokeWidth="0.7" fill="none" opacity="0.14"/>
      <path d="M295 58 Q300 52 298 45" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08"/>
      <path d="M200 150 L135 215 Q125 228 118 235 Q108 242 100 245" stroke={color} strokeWidth="0.7" fill="none" opacity="0.14"/>
      <path d="M100 245 Q94 248 88 246" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08"/>
      {/* One brighter direction — suggestion of home */}
      <path d="M200 150 L280 110 Q295 105 305 98" stroke={color} strokeWidth="1.4" fill="none" opacity="0.4"/>
      <circle cx="305" cy="98" r="3.5" fill={color} opacity="0.2"/>
      <circle cx="305" cy="98" r="8" fill={color} opacity="0.06" filter="url(#wb1)"/>
      <path d="M305 98 Q312 92 318 90" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
    </svg>
  );
}

/* 12. The Trouble with Desire — Reaching tendrils toward unreachable light */
function TheTroubleWithDesire({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="td1"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="td2"><feGaussianBlur stdDeviation="12"/></filter>
      </defs>
      {/* Luminous point — always out of reach, larger glow */}
      <circle cx="200" cy="55" r="18" fill={color} opacity="0.06" filter="url(#td2)"/>
      <circle cx="200" cy="55" r="10" fill={color} opacity="0.1" filter="url(#td1)"/>
      <circle cx="200" cy="55" r="3" fill={color} opacity="0.3"/>
      {/* Five reaching tendrils from below — thicker, more presence */}
      <path d="M165 285 Q158 240 165 195 Q175 160 170 130 Q165 105 178 85" stroke={color} strokeWidth="1.5" fill="none" opacity="0.25"/>
      <path d="M190 285 Q185 235 190 190 Q196 155 192 125 Q188 100 195 80" stroke={color} strokeWidth="1.5" fill="none" opacity="0.28"/>
      <path d="M200 285 Q198 230 200 180 Q202 145 200 115 Q198 90 200 72" stroke={color} strokeWidth="1.5" fill="none" opacity="0.3"/>
      <path d="M215 285 Q220 235 215 190 Q208 155 212 125 Q216 100 208 80" stroke={color} strokeWidth="1.5" fill="none" opacity="0.28"/>
      <path d="M240 285 Q248 240 240 195 Q230 160 235 130 Q240 105 225 85" stroke={color} strokeWidth="1.5" fill="none" opacity="0.25"/>
      {/* Fragments breaking off near the light — showing tension */}
      {[[182,82,1.8],[195,75,1.5],[208,72,1.6],[220,78,1.4],[200,68,1.2],[188,70,1.0],[215,74,0.9],[175,88,1.3],[228,86,1.1],[200,64,0.8]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.15-i*0.01}/>
      ))}
      {/* Tension lines — fragments reaching toward the unreachable */}
      <line x1="178" y1="85" x2="190" y2="68" stroke={color} strokeWidth="0.5" opacity="0.12" strokeDasharray="1.5 3"/>
      <line x1="195" y1="80" x2="198" y2="65" stroke={color} strokeWidth="0.5" opacity="0.12" strokeDasharray="1.5 3"/>
      <line x1="208" y1="80" x2="204" y2="65" stroke={color} strokeWidth="0.5" opacity="0.12" strokeDasharray="1.5 3"/>
      <line x1="225" y1="85" x2="212" y2="68" stroke={color} strokeWidth="0.5" opacity="0.12" strokeDasharray="1.5 3"/>
      {/* Larger break-off fragments near light showing tension */}
      <path d="M192 74 L188 70 L194 68" stroke={color} strokeWidth="0.6" fill="none" opacity="0.1"/>
      <path d="M210 76 L214 72 L208 69" stroke={color} strokeWidth="0.6" fill="none" opacity="0.1"/>
    </svg>
  );
}

/* 13. The Mask Behind the Face — Peeling profiles revealing void */
function TheMaskBehindTheFace({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="mb1"><feGaussianBlur stdDeviation="5"/></filter></defs>
      {/* Profile layers peeling away */}
      <path d="M150 65 Q135 95 132 135 Q130 175 142 205 Q156 232 180 242" stroke={color} strokeWidth="1.5" fill="none" opacity="0.32"/>
      <path d="M168 60 Q155 90 152 130 Q150 170 160 200 Q174 228 195 238" stroke={color} strokeWidth="1.1" fill="none" opacity="0.22"/>
      <path d="M188 58 Q177 88 175 128 Q173 168 180 198 Q192 225 210 234" stroke={color} strokeWidth="0.8" fill="none" opacity="0.15"/>
      <path d="M210 60 Q202 90 200 128 Q198 165 203 195 Q212 222 228 230" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08" strokeDasharray="3 6"/>
      {/* Peeling connections */}
      <path d="M150 65 C158 62 164 60 168 60" stroke={color} strokeWidth="0.4" fill="none" opacity="0.15"/>
      <path d="M168 60 C177 56 184 56 188 58" stroke={color} strokeWidth="0.3" fill="none" opacity="0.1"/>
      {/* Eyes in first two layers */}
      <circle cx="152" cy="118" r="3.5" fill="none" stroke={color} strokeWidth="0.6" opacity="0.22"/>
      <circle cx="170" cy="115" r="3" fill="none" stroke={color} strokeWidth="0.4" opacity="0.14"/>
      {/* Void behind last layer */}
      {[...Array(15)].map((_,i) => (
        <circle key={i} cx={225+i*5+Math.sin(i*2)*8} cy={75+i*10} r={0.4+Math.random()*1.2} fill={color} opacity={0.04+Math.random()*0.04}/>
      ))}
      <ellipse cx="195" cy="148" rx="40" ry="55" fill={color} opacity="0.025" filter="url(#mb1)"/>
    </svg>
  );
}

/* 14. The Green-Eyed God — Possessive inward spiral */
function TheGreenEyedGod({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ge1"><feGaussianBlur stdDeviation="4"/></filter></defs>
      {/* Tightening spiral — possessive pull */}
      {[...Array(6)].map((_,i) => {
        const r = 110-i*18;
        const startAngle = i*40;
        const cx = 200, cy = 150;
        const x1 = cx+Math.cos(startAngle*Math.PI/180)*r;
        const y1 = cy+Math.sin(startAngle*Math.PI/180)*r;
        const x2 = cx+Math.cos((startAngle+300)*Math.PI/180)*r;
        const y2 = cy+Math.sin((startAngle+300)*Math.PI/180)*r;
        return <path key={i} d={`M${x1} ${y1} A${r} ${r} 0 1 1 ${x2} ${y2}`} stroke={color} strokeWidth={0.5+i*0.15} fill="none" opacity={0.08+i*0.035}/>;
      })}
      {/* Bright clutching center */}
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.08" filter="url(#ge1)"/>
      <circle cx="200" cy="150" r="3" fill={color} opacity="0.2"/>
      {/* Trapped particles within */}
      {[...Array(10)].map((_,i) => {
        const a = (i/10)*Math.PI*2;
        const d = 15+i*4;
        return <circle key={i} cx={200+Math.cos(a)*d} cy={150+Math.sin(a)*d*0.7} r={0.5+Math.random()*1} fill={color} opacity={0.1+Math.random()*0.08}/>;
      })}
      {/* Grasping finger-like curves */}
      {[0,72,144,216,288].map((angle,i) => {
        const rad = angle*Math.PI/180;
        const x1 = 200+Math.cos(rad)*90;
        const y1 = 150+Math.sin(rad)*65;
        const x2 = 200+Math.cos(rad)*45;
        const y2 = 150+Math.sin(rad)*32;
        return <path key={i} d={`M${x1} ${y1} Q${200+Math.cos(rad+0.3)*65} ${150+Math.sin(rad+0.3)*48} ${x2} ${y2}`} stroke={color} strokeWidth="0.5" fill="none" opacity={0.1+i*0.02}/>;
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   WHO AM I? — Echo palette
   ═══════════════════════════════════════════════ */

/* 15. The Self That Isn't There — Dissolving fingerprint */
function TheSelfThatIsntThere({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {[...Array(9)].map((_,i) => {
        const r = 110-i*12;
        const dash = Math.max(2,18-i*2.5);
        const gap = 3+i*4;
        return r > 0 ? <circle key={i} cx="200" cy="150" r={r} fill="none" stroke={color} strokeWidth={0.3+i*0.07} opacity={0.05+i*0.022} strokeDasharray={`${dash} ${gap}`} transform={`rotate(${i*13} 200 150)`}/> : null;
      })}
      <path d="M186 132 Q178 142 180 156 Q184 170 196 172" stroke={color} strokeWidth="0.55" fill="none" opacity="0.18"/>
      <path d="M212 128 Q224 138 221 155 Q217 172 206 176" stroke={color} strokeWidth="0.45" fill="none" opacity="0.13"/>
      <circle cx="200" cy="150" r="2" fill="none" stroke={color} strokeWidth="0.35" opacity="0.2" strokeDasharray="1 2"/>
      {[...Array(18)].map((_,i) => {
        const a=(i/18)*Math.PI*2; const d=12+i*5;
        return <circle key={i} cx={200+Math.cos(a)*d} cy={150+Math.sin(a)*d*0.7} r={0.3+Math.random()*1.1} fill={color} opacity={0.08+i*0.006}/>;
      })}
    </svg>
  );
}

/* 16. The Mask That Speaks — Theatrical arcs with puppet strings */
function TheMaskThatSpeaks({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ms1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Bold theatrical brow arcs */}
      <path d="M120 80 Q200 35 280 80" stroke={color} strokeWidth="2" fill="none" opacity="0.25"/>
      <path d="M132 92 Q200 52 268 92" stroke={color} strokeWidth="1.5" fill="none" opacity="0.18"/>
      <path d="M145 102 Q200 68 255 102" stroke={color} strokeWidth="1" fill="none" opacity="0.12"/>
      {/* Prominent mouth curve */}
      <path d="M150 172 Q200 210 250 172" stroke={color} strokeWidth="2" fill="none" opacity="0.32" filter="url(#ms1)"/>
      <path d="M162 186 Q202 215 242 186" stroke={color} strokeWidth="1" fill="none" opacity="0.15"/>
      {/* Eyes — almond shapes */}
      <path d="M155 128 Q175 115 195 128 Q175 141 155 128Z" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2"/>
      <path d="M205 128 Q225 115 245 128 Q225 141 205 128Z" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2"/>
      {/* Three thick puppet strings from above */}
      <line x1="170" y1="0" x2="172" y2="80" stroke={color} strokeWidth="0.7" opacity="0.12"/>
      <line x1="200" y1="0" x2="200" y2="75" stroke={color} strokeWidth="0.8" opacity="0.15"/>
      <line x1="230" y1="0" x2="228" y2="80" stroke={color} strokeWidth="0.7" opacity="0.12"/>
      {/* Larger word-particles falling from the mouth */}
      {[[172,215,2.5],[188,225,2.2],[205,220,2.8],[220,230,2.0],[195,238,1.8],[210,242,2.3],[180,248,1.6],[200,255,1.4]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.14-i*0.012}/>
      ))}
    </svg>
  );
}

/* 17. The Stain That Stays — Expanding ink blot */
function TheStainThatStays({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="ss1"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="ss2"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <ellipse cx="200" cy="150" rx="55" ry="45" fill={color} opacity="0.05" filter="url(#ss1)"/>
      <path d="M172 132 Q182 112 200 118 Q218 124 226 138 Q234 156 230 174 Q222 192 206 188 Q188 184 180 168 Q172 152 172 132Z" fill={color} opacity="0.08" filter="url(#ss2)"/>
      <path d="M182 138 Q190 122 202 128 Q216 134 220 146 Q224 160 220 172 Q214 182 204 180 Q192 176 186 164 Q180 152 182 138Z" fill={color} opacity="0.1"/>
      {/* Tendrils */}
      <path d="M172 132 Q142 112 112 118" stroke={color} strokeWidth="0.7" fill="none" opacity="0.13"/>
      <path d="M226 138 Q258 122 288 132" stroke={color} strokeWidth="0.6" fill="none" opacity="0.1"/>
      <path d="M180 168 Q155 190 125 195" stroke={color} strokeWidth="0.5" fill="none" opacity="0.08"/>
      <path d="M230 174 Q258 195 292 190" stroke={color} strokeWidth="0.45" fill="none" opacity="0.07"/>
      <path d="M200 118 Q196 82 200 52" stroke={color} strokeWidth="0.45" fill="none" opacity="0.08"/>
      <path d="M206 188 Q210 228 202 258" stroke={color} strokeWidth="0.4" fill="none" opacity="0.06"/>
      {[...Array(10)].map((_,i) => {
        const a=(i/10)*Math.PI*2; const d=65+i*7;
        return <circle key={i} cx={200+Math.cos(a)*d} cy={150+Math.sin(a)*d*0.7} r={0.6+Math.random()*1.3} fill={color} opacity={0.06+Math.random()*0.05}/>;
      })}
    </svg>
  );
}

/* 18. The Gilded Cage — Ornate bars with vine breaking through */
function TheGildedCageYouBuiltYourself({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="gc1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {[...Array(7)].map((_,i) => <line key={i} x1={132+i*22} y1={52} x2={132+i*22} y2={248} stroke={color} strokeWidth="0.7" opacity={0.1+Math.sin(i)*0.04}/>)}
      {[...Array(5)].map((_,i) => <line key={`h${i}`} x1={128} y1={72+i*40} x2={282} y2={72+i*40} stroke={color} strokeWidth="0.4" opacity={0.07+i*0.008}/>)}
      <path d="M132 52 Q200 18 268 52" stroke={color} strokeWidth="0.7" fill="none" opacity="0.13"/>
      <path d="M200 248 Q196 218 198 188 Q202 158 192 138 Q180 124 186 98 Q196 74 200 48" stroke={color} strokeWidth="1.1" fill="none" opacity="0.28" filter="url(#gc1)"/>
      <path d="M192 138 Q172 132 158 138" stroke={color} strokeWidth="0.5" fill="none" opacity="0.18"/>
      <path d="M198 188 Q218 182 232 188" stroke={color} strokeWidth="0.45" fill="none" opacity="0.14"/>
      {[[158,136],[232,186],[152,96],[200,44]].map(([x,y],i) => (
        <ellipse key={i} cx={x} cy={y} rx={3.5} ry={1.8} fill={color} opacity={0.1+i*0.02} transform={`rotate(${-28+i*22} ${x} ${y})`}/>
      ))}
    </svg>
  );
}

/* 19. The Weight of Things — Objects pulling down, threads cutting */
function TheWeightOfThings({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="wt1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {/* Convergence point — the burden holder */}
      <circle cx="200" cy="55" r="3" fill={color} opacity="0.2"/>
      <circle cx="200" cy="55" r="6" fill={color} opacity="0.06" filter="url(#wt1)"/>
      {/* Hanging weighted objects — larger, more defined */}
      {[[130,145,26,20],[168,172,22,18],[232,162,24,19],[272,138,20,16],[195,195,28,22]].map(([x,y,w,h],i) => (
        <g key={i}>
          <line x1={200} y1={55} x2={x} y2={y-h/2} stroke={color} strokeWidth="0.7" opacity={0.15+i*0.02}/>
          <rect x={x-w/2} y={y-h/2} width={w} height={h} fill={color} fillOpacity="0.03" stroke={color} strokeWidth="0.8" opacity={0.18+i*0.025} rx="2"/>
        </g>
      ))}
      {/* One shape mid-fall — thread just cut, springing upward */}
      <g>
        {/* The cut thread — dashed, broken */}
        <line x1={200} y1={55} x2={310} y2={115} stroke={color} strokeWidth="0.4" opacity="0.08" strokeDasharray="2 5"/>
        {/* Freed thread end springing up — whip curve */}
        <path d="M310 115 Q308 95 312 75 Q318 55 310 38" stroke={color} strokeWidth="0.6" fill="none" opacity="0.18"/>
        {/* Falling shape — rotated, tumbling */}
        <rect x={300} y={175} width={18} height={14} fill="none" stroke={color} strokeWidth="0.7" opacity="0.15" rx="2" transform="rotate(25 309 182)"/>
        {/* Fall trail */}
        <line x1={310} y1={130} x2={309} y2={170} stroke={color} strokeWidth="0.3" opacity="0.08" strokeDasharray="1 4"/>
      </g>
      {/* Second fallen object */}
      <rect x={88} y={230} width={16} height={12} fill="none" stroke={color} strokeWidth="0.5" opacity="0.1" rx="2" transform="rotate(-18 96 236)"/>
      <line x1={200} y1={55} x2={96} y2={200} stroke={color} strokeWidth="0.3" opacity="0.06" strokeDasharray="2 5"/>
    </svg>
  );
}

/* 20. The Story You Keep Telling — Loop that doesn't expand */
function TheStoryYouKeepTelling({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Circular path worn deep */}
      {[...Array(4)].map((_,i) => (
        <circle key={i} cx="195" cy="150" r={48+i*2} fill="none" stroke={color} strokeWidth={0.4+i*0.2} opacity={0.06+i*0.04}/>
      ))}
      {/* Tally marks along the path */}
      {[...Array(16)].map((_,i) => {
        const a = (i/16)*Math.PI*2;
        const x = 195+Math.cos(a)*48; const y = 150+Math.sin(a)*48;
        return <line key={i} x1={x-2} y1={y-3} x2={x+2} y2={y+3} stroke={color} strokeWidth="0.4" opacity="0.1" transform={`rotate(${a*180/Math.PI+90} ${x} ${y})`}/>;
      })}
      {/* Escape tangent — barely visible */}
      <path d="M243 148 Q260 140 280 138 Q305 136 330 140" stroke={color} strokeWidth="0.4" fill="none" opacity="0.12" strokeDasharray="3 5"/>
    </svg>
  );
}

/* 21. The Body That Carried You — Body topography shifting over time */
function TheBodyThatCarriedYou({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="bc1"><feGaussianBlur stdDeviation="4"/></filter></defs>
      {/* First body-landscape silhouette — solid, the body as it was */}
      <path d="M0 175 Q45 142 90 148 Q130 155 160 140 Q190 125 215 132 Q245 140 275 130 Q310 118 345 128 Q375 135 400 125" stroke={color} strokeWidth="1.4" fill="none" opacity="0.28"/>
      {/* Second body-landscape — shifted contours, the body as it became */}
      <path d="M0 185 Q50 155 95 160 Q135 168 165 150 Q195 135 220 142 Q250 152 280 140 Q315 128 350 138 Q380 145 400 135" stroke={color} strokeWidth="1.2" fill="none" opacity="0.22" strokeDasharray="6 4"/>
      {/* Topographic contour lines between the two silhouettes */}
      <path d="M0 178 Q48 148 92 153 Q132 160 162 144 Q192 129 218 136 Q248 145 278 134 Q312 122 348 132 Q378 139 400 129" stroke={color} strokeWidth="0.4" fill="none" opacity="0.1"/>
      <path d="M0 182 Q49 152 93 157 Q133 164 163 148 Q193 133 219 139 Q249 148 279 138 Q313 126 349 135 Q379 142 400 132" stroke={color} strokeWidth="0.35" fill="none" opacity="0.08"/>
      <path d="M0 172 Q46 144 91 149 Q131 156 161 141 Q191 127 216 133 Q246 141 276 131 Q311 120 346 129 Q376 136 400 127" stroke={color} strokeWidth="0.35" fill="none" opacity="0.08"/>
      {/* Lower body-landscape — hips, legs suggestion */}
      <path d="M0 215 Q55 195 100 205 Q140 215 175 200 Q210 188 240 198 Q275 210 310 200 Q350 190 400 195" stroke={color} strokeWidth="1.2" fill="none" opacity="0.22"/>
      <path d="M0 225 Q60 200 105 212 Q145 222 180 208 Q215 195 245 205 Q280 218 315 208 Q355 196 400 202" stroke={color} strokeWidth="1" fill="none" opacity="0.18" strokeDasharray="6 4"/>
      {/* Contour lines between lower pair */}
      <path d="M0 219 Q58 197 102 208 Q142 218 177 203 Q212 191 242 201 Q278 214 312 204 Q352 193 400 198" stroke={color} strokeWidth="0.35" fill="none" opacity="0.08"/>
      {/* Glow between the shifting contours — area of change */}
      <ellipse cx="200" cy="138" rx="100" ry="18" fill={color} opacity="0.04" filter="url(#bc1)"/>
      <ellipse cx="200" cy="208" rx="90" ry="14" fill={color} opacity="0.03" filter="url(#bc1)"/>
      {/* Topographic elevation markers */}
      {[[80,152,0.12],[140,146,0.1],[200,132,0.14],[260,136,0.1],[320,126,0.12],[100,210,0.1],[180,198,0.12],[260,204,0.1],[340,198,0.1]].map(([x,y,o],i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill={color} opacity={o}/>
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   MEANING & PURPOSE — Constellation palette
   ═══════════════════════════════════════════════ */

/* 22. The Question Behind Every Question — Nested question curves */
function TheQuestionBehindEveryQuestion({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="qq1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {[...Array(5)].map((_,i) => {
        const s = 1-i*0.18; const ox = i*3;
        return <path key={i} d={`M${175*s+200*(1-s)+ox} ${80*s+120*(1-s)} Q${230*s+200*(1-s)+ox} ${60*s+110*(1-s)} ${230*s+200*(1-s)+ox} ${110*s+140*(1-s)} Q${230*s+200*(1-s)+ox} ${150*s+165*(1-s)} ${200*s+200*(1-s)+ox} ${155*s+168*(1-s)}`} stroke={color} strokeWidth={0.4+i*0.15} fill="none" opacity={0.06+i*0.04}/>;
      })}
      {/* Innermost opens to light */}
      <circle cx="200" cy="168" r="2.5" fill={color} opacity="0.15" filter="url(#qq1)"/>
      <circle cx="200" cy="168" r="1" fill={color} opacity="0.3"/>
      {/* Dots of inquiry */}
      {[200,198,201,199,200].map((x,i) => (
        <circle key={i} cx={x} cy={178+i*3*(1-i*0.15)} r={1.5-i*0.25} fill={color} opacity={0.15-i*0.025}/>
      ))}
    </svg>
  );
}

/* 23. The Life You Think You Want ★ HERO — Net with wrong catch */
function TheLifeYouThinkYouWant({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Net mesh */}
      {[...Array(8)].map((_,i) => <line key={`v${i}`} x1={120+i*25} y1={60} x2={115+i*26} y2={240} stroke={color} strokeWidth="0.35" opacity="0.1"/>)}
      {[...Array(6)].map((_,i) => <line key={`h${i}`} x1={115} y1={80+i*30} x2={300} y2={78+i*31} stroke={color} strokeWidth="0.3" opacity="0.08"/>)}
      {/* Captured form — distorted, wrong */}
      <path d="M170 110 Q185 95 210 100 Q235 108 240 130 Q242 155 230 175 Q215 192 195 190 Q172 185 165 165 Q160 145 170 110Z" fill={color} opacity="0.05" stroke={color} strokeWidth="0.8" strokeOpacity="0.2"/>
      {/* Tension lines where net strains */}
      {[[160,130,-20],[245,140,18],[165,175,-15],[235,180,20]].map(([x,y,d],i) => (
        <line key={i} x1={x} y1={y} x2={x+d} y2={y+d*0.3} stroke={color} strokeWidth="0.5" opacity="0.15"/>
      ))}
      {/* Distortion inside the catch */}
      <path d="M190 130 Q200 120 210 132 Q215 145 205 152" stroke={color} strokeWidth="0.4" fill="none" opacity="0.12"/>
    </svg>
  );
}

/* 24. The Calling That Won't Shut Up — Persistent signal pulse */
function TheCallingThatWontShutUp({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="cc1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {/* Flatline */}
      <line x1="20" y1="150" x2="380" y2="150" stroke={color} strokeWidth="0.4" opacity="0.1"/>
      {/* Recurring pulses — irregular but persistent */}
      {[60,115,155,210,255,305,350].map((x,i) => {
        const h = 20+Math.sin(i*1.7)*15+Math.random()*10;
        return <g key={i}>
          <line x1={x} y1={150} x2={x} y2={150-h} stroke={color} strokeWidth={0.6+i*0.05} opacity={0.15+i*0.02}/>
          <line x1={x} y1={150-h} x2={x} y2={150-h} stroke={color} strokeWidth="3" opacity="0.08" filter="url(#cc1)" strokeLinecap="round"/>
        </g>;
      })}
      {/* Latest pulse is brightest */}
      <line x1="350" y1="150" x2="350" y2="110" stroke={color} strokeWidth="1.2" opacity="0.35" filter="url(#cc1)"/>
    </svg>
  );
}

/* 25. The Blank Page — Near-empty, one brave first mark */
function TheBlankPage({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="bp1"><feGaussianBlur stdDeviation="8"/></filter>
        <radialGradient id="bp2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.08"/>
          <stop offset="60%" stopColor={color} stopOpacity="0.02"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Faint grid — barely visible, suggesting latent structure */}
      {[...Array(7)].map((_,i) => <line key={`v${i}`} x1={100+i*36} y1={30} x2={100+i*36} y2={270} stroke={color} strokeWidth="0.15" opacity="0.025"/>)}
      {[...Array(6)].map((_,i) => <line key={`h${i}`} x1={70} y1={50+i*42} x2={330} y2={50+i*42} stroke={color} strokeWidth="0.15" opacity="0.025"/>)}
      {/* Radial glow around the mark — potential radiating outward */}
      <circle cx="200" cy="190" r="50" fill="url(#bp2)"/>
      <circle cx="200" cy="190" r="30" fill={color} opacity="0.03" filter="url(#bp1)"/>
      {/* The first mark — bolder, more intentional */}
      <path d="M192 195 Q198 182 212 188" stroke={color} strokeWidth="1.6" fill="none" opacity="0.4" strokeLinecap="round"/>
      {/* Starting dot — where pen first touched */}
      <circle cx="192" cy="195" r="1.2" fill={color} opacity="0.3"/>
    </svg>
  );
}

/* 26. The Price of Everything — Asymmetric scale */
function ThePriceOfEverything({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Fulcrum */}
      <line x1="200" y1="80" x2="200" y2="130" stroke={color} strokeWidth="0.6" opacity="0.18"/>
      <polygon points="195,130 205,130 200,136" fill={color} opacity="0.12"/>
      {/* Tilted beam */}
      <line x1="110" y1="100" x2="290" y2="72" stroke={color} strokeWidth="0.8" opacity="0.2"/>
      {/* Heavy side — material, dense */}
      <rect x="90" y="105" width="42" height="35" fill={color} opacity="0.06" stroke={color} strokeWidth="0.4" strokeOpacity="0.15" rx="1"/>
      <rect x="95" y="110" width="12" height="10" fill={color} opacity="0.04"/>
      <rect x="112" y="108" width="14" height="14" fill={color} opacity="0.05"/>
      {/* Light side — organic, small */}
      <circle cx="285" cy="78" r="6" fill="none" stroke={color} strokeWidth="0.4" opacity="0.15"/>
      {/* Cracking fulcrum */}
      <path d="M198 120 L196 125 L199 128" stroke={color} strokeWidth="0.3" fill="none" opacity="0.12"/>
      <path d="M202 122 L204 126 L201 129" stroke={color} strokeWidth="0.25" fill="none" opacity="0.1"/>
    </svg>
  );
}

/* 27. Why Do I Keep Going Back? — Circular trap with worn path */
function WhyDoIKeepGoingBack({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {[...Array(4)].map((_,i) => (
        <circle key={i} cx="195" cy="150" r={52+i*2} fill="none" stroke={color} strokeWidth={0.3+i*0.25} opacity={0.05+i*0.04}/>
      ))}
      {[...Array(14)].map((_,i) => {
        const a=(i/14)*Math.PI*2;
        const x=195+Math.cos(a)*52; const y=150+Math.sin(a)*52;
        return <line key={i} x1={x} y1={y} x2={x+Math.cos(a)*4} y2={y+Math.sin(a)*4} stroke={color} strokeWidth="0.5" opacity="0.12"/>;
      })}
      {/* Attempted escape — curves back */}
      <path d="M247 148 Q270 135 285 140 Q300 150 295 165 Q285 178 265 172 Q252 165 248 155" stroke={color} strokeWidth="0.5" fill="none" opacity="0.15" strokeDasharray="3 4"/>
    </svg>
  );
}

/* 28. What You Leave Behind — Fading footprints into distance */
function WhatYouLeaveBehind({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="wl1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Perspective lines */}
      {[...Array(6)].map((_,i) => (
        <line key={i} x1={200} y1={60} x2={40+i*70} y2={290} stroke={color} strokeWidth="0.2" opacity="0.04"/>
      ))}
      {/* Fading marks along the path */}
      {[...Array(10)].map((_,i) => {
        const t = i/10;
        const x = 200+(1-t)*(Math.sin(i*1.2)*40-20);
        const y = 60+t*220;
        const s = 1+t*4;
        return <rect key={i} x={x-s/2} y={y-s/4} width={s} height={s/2} fill={color} opacity={0.04+t*0.12} rx="0.5"/>;
      })}
      {/* Vanishing point glow */}
      <circle cx="200" cy="60" r="4" fill={color} opacity="0.1" filter="url(#wl1)"/>
      <circle cx="200" cy="60" r="1.5" fill={color} opacity="0.2"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   FREEDOM & JUSTICE — Burst palette
   ═══════════════════════════════════════════════ */

/* 29. When Silence Becomes Complicity — Sealed lips cracking */
function WhenSilenceBecomesComplicity({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Sealed lips */}
      <path d="M130 148 Q165 140 200 145 Q235 140 270 148" stroke={color} strokeWidth="1.2" fill="none" opacity="0.25"/>
      <path d="M130 152 Q165 160 200 155 Q235 160 270 152" stroke={color} strokeWidth="1.2" fill="none" opacity="0.25"/>
      {/* Cracks forming between */}
      <path d="M165 148 L167 152" stroke={color} strokeWidth="0.5" fill="none" opacity="0.2"/>
      <path d="M195 146 L193 154" stroke={color} strokeWidth="0.6" fill="none" opacity="0.22"/>
      <path d="M225 147 L227 153" stroke={color} strokeWidth="0.4" fill="none" opacity="0.18"/>
      {/* Pressure building — particles accumulating outside */}
      {[...Array(20)].map((_,i) => {
        const x = 120+i*8+Math.sin(i)*6;
        const above = i%2===0;
        const y = above ? 130-Math.random()*30 : 170+Math.random()*30;
        return <circle key={i} cx={x} cy={y} r={0.4+Math.random()*1} fill={color} opacity={0.06+Math.random()*0.06}/>;
      })}
    </svg>
  );
}

/* 30. Four Freedoms — Chains becoming birds */
function FourFreedoms({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ff1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {[...Array(5)].map((_,i) => {
        const y=250-i*16; const x=200+Math.sin(i*0.5)*2;
        return <ellipse key={i} cx={x} cy={y} rx={7} ry={4.5} fill="none" stroke={color} strokeWidth={1.1-i*0.12} opacity={0.28-i*0.035}/>;
      })}
      {[[168,138,22],[232,132,20],[150,108,20],[250,102,18],[175,78,18],[225,72,20],[158,52,16],[242,48,14],[200,35,18]].map(([x,y,w],i) => (
        <path key={i} d={`M${x} ${y} Q${x+w/2} ${y-5-i*0.5} ${x+w} ${y+1.5}`} stroke={color} strokeWidth={0.45+i*0.04} fill="none" opacity={0.08+i*0.02}/>
      ))}
      {[...Array(12)].map((_,i) => (
        <circle key={`p${i}`} cx={165+i*6+Math.sin(i*1.8)*18} cy={135-i*7} r={0.4+Math.random()*0.8} fill={color} opacity={0.08+i*0.01}/>
      ))}
      <line x1="200" y1="168" x2="200" y2="22" stroke={color} strokeWidth="0.4" opacity="0.06" filter="url(#ff1)"/>
    </svg>
  );
}

/* 31. The Emperor and the Fugitive — Dissolving crown, escape trajectory */
function TheEmperorAndTheFugitive({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ef1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path d="M148 118 L158 78 L178 102 L200 68 L222 102 L242 78 L252 118" stroke={color} strokeWidth="1.1" fill="none" opacity="0.22"/>
      <line x1="148" y1="118" x2="252" y2="118" stroke={color} strokeWidth="0.9" opacity="0.18"/>
      <path d="M158 78 L178 102" stroke={color} strokeWidth="0.4" fill="none" opacity="0.08" strokeDasharray="2 5"/>
      {[[162,128,7],[182,132,5],[218,130,6],[238,135,5],[200,126,8]].map(([x,y,s],i) => (
        <rect key={i} x={x} y={y} width={s} height={s*0.4} fill={color} opacity={0.05+i*0.008} transform={`rotate(${12+i*18} ${x} ${y})`}/>
      ))}
      <path d="M102 258 Q152 218 182 178 Q212 138 262 98 Q302 68 352 38" stroke={color} strokeWidth="0.7" fill="none" opacity="0.18" strokeDasharray="7 4"/>
      {[...Array(5)].map((_,i) => {
        const t=i/5; const x=102+t*250; const y=258-t*220;
        return <line key={i} x1={x} y1={y} x2={x+14} y2={y-11} stroke={color} strokeWidth="0.25" opacity={0.06+t*0.08}/>;
      })}
      <circle cx="342" cy="44" r="2" fill={color} opacity="0.18" filter="url(#ef1)"/>
    </svg>
  );
}

/* 32. The Inner Citadel — Concentric fortress, pressure held */
function TheInnerCitadel({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {[...Array(5)].map((_,i) => {
        const s = 100-i*18;
        return <rect key={i} x={200-s} y={150-s*0.7} width={s*2} height={s*1.4} fill="none" stroke={color} strokeWidth={0.3+i*0.1} opacity={0.05+i*0.03} rx="2"/>;
      })}
      {/* Pressure arrows from outside */}
      {[...Array(8)].map((_,i) => {
        const a=(i/8)*Math.PI*2;
        const x1=200+Math.cos(a)*130; const y1=150+Math.sin(a)*95;
        const x2=200+Math.cos(a)*105; const y2=150+Math.sin(a)*76;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.4" opacity="0.1"/>;
      })}
      {/* Calm center point */}
      <circle cx="200" cy="150" r="2" fill={color} opacity="0.2"/>
    </svg>
  );
}

/* 33. The Virtue of Surrender — Opening hand releasing */
function TheVirtueOfSurrender({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Five finger-lines opening from palm point */}
      {[[-50,-70],[-25,-75],[0,-80],[25,-75],[45,-65]].map(([dx,dy],i) => (
        <path key={i} d={`M200 180 Q${200+dx*0.5} ${180+dy*0.5} ${200+dx} ${180+dy}`} stroke={color} strokeWidth={0.6+i*0.05} fill="none" opacity={0.12+i*0.02}/>
      ))}
      {/* Rising released particles */}
      {[...Array(12)].map((_,i) => {
        const x = 185+Math.sin(i*1.5)*25;
        const y = 95-i*5;
        return <circle key={i} cx={x} cy={y} r={0.5+Math.random()*1.5} fill={color} opacity={0.08+i*0.01}/>;
      })}
      {/* Palm point */}
      <circle cx="200" cy="180" r="3" fill={color} opacity="0.08"/>
    </svg>
  );
}

/* 34. The Debt You Didn't Sign — Invisible threads forward */
function TheDebtYouDidntSign({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="dy1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Figure suggestion at center — single vertical line with circle head */}
      <line x1="120" y1="115" x2="120" y2="195" stroke={color} strokeWidth="1" opacity="0.22"/>
      <circle cx="120" cy="105" r="6" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2"/>
      <circle cx="120" cy="105" r="10" fill={color} opacity="0.04" filter="url(#dy1)"/>
      {/* Threads extending to unformed future obligations — much more visible */}
      {[[280,70],[310,120],[300,170],[280,225],[330,90],[320,200]].map(([x,y],i) => (
        <g key={i}>
          <line x1={120} y1={150} x2={x} y2={y} stroke={color} strokeWidth="1" opacity={0.2+i*0.02} strokeDasharray="4 6"/>
        </g>
      ))}
      {/* Unformed shapes at thread endpoints — small, unfinished obligations */}
      <path d="M275 65 Q282 62 286 68 Q283 75 276 72" stroke={color} strokeWidth="0.7" fill="none" opacity="0.18" strokeDasharray="2 2"/>
      <rect x="303" y="114" width="14" height="12" fill="none" stroke={color} strokeWidth="0.6" opacity="0.16" strokeDasharray="2 3" rx="2"/>
      <path d="M294 165 Q300 160 306 167 Q302 175 295 172 Z" stroke={color} strokeWidth="0.6" fill="none" opacity="0.15" strokeDasharray="2 2"/>
      <circle cx="280" cy="225" r="6" fill="none" stroke={color} strokeWidth="0.6" opacity="0.16" strokeDasharray="2 3"/>
      <path d="M325 85 L335 88 L332 98 L322 95 Z" stroke={color} strokeWidth="0.6" fill="none" opacity="0.14" strokeDasharray="2 2"/>
      {/* Faint weight pulling the threads taut */}
      {[[280,70],[310,120],[300,170],[280,225],[330,90]].map(([x,y],i) => (
        <circle key={`g${i}`} cx={x} cy={y} r="8" fill={color} opacity="0.03" filter="url(#dy1)"/>
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   FAITH, DEATH & MYSTERY — Spiral palette
   ═══════════════════════════════════════════════ */

/* 35. The Unfinished Life — Hourglass mid-fall */
function TheUnfinishedLife({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Hourglass shape */}
      <path d="M155 50 L245 50 L210 145 L200 150 L190 145 L155 50Z" fill="none" stroke={color} strokeWidth="0.6" opacity="0.15"/>
      <path d="M155 250 L245 250 L210 155 L200 150 L190 155 L155 250Z" fill="none" stroke={color} strokeWidth="0.6" opacity="0.15"/>
      {/* Sand in upper chamber */}
      {[...Array(18)].map((_,i) => (
        <circle key={`u${i}`} cx={170+Math.random()*60} cy={60+Math.random()*60} r={0.5+Math.random()*1.2} fill={color} opacity={0.08+Math.random()*0.06}/>
      ))}
      {/* Falling stream */}
      {[...Array(6)].map((_,i) => (
        <circle key={`f${i}`} cx={200+Math.sin(i)*2} cy={148+i*3} r={0.4+Math.random()*0.6} fill={color} opacity={0.15+i*0.02}/>
      ))}
      {/* Sand in lower chamber — partial */}
      {[...Array(12)].map((_,i) => (
        <circle key={`l${i}`} cx={175+Math.random()*50} cy={210+Math.random()*30} r={0.5+Math.random()*1} fill={color} opacity={0.06+Math.random()*0.05}/>
      ))}
    </svg>
  );
}

/* 36. The Silent Altar — Empty altar, fading smoke */
function TheSilentAltar({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="sa1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Altar surface — more defined horizontal presence */}
      <line x1="130" y1="190" x2="270" y2="190" stroke={color} strokeWidth="1.5" opacity="0.28"/>
      <line x1="135" y1="195" x2="265" y2="195" stroke={color} strokeWidth="0.8" opacity="0.14"/>
      <line x1="140" y1="199" x2="260" y2="199" stroke={color} strokeWidth="0.4" opacity="0.08"/>
      {/* Smoke wisps — curved fading paths rising from the altar */}
      <path d="M190 185 Q184 162 190 140 Q198 118 188 95 Q180 75 186 55" stroke={color} strokeWidth="0.8" fill="none" opacity="0.14"/>
      <path d="M200 185 Q195 158 202 132 Q210 108 200 85 Q192 65 198 42" stroke={color} strokeWidth="0.7" fill="none" opacity="0.12"/>
      <path d="M210 185 Q216 160 210 138 Q202 118 212 95 Q220 78 214 58" stroke={color} strokeWidth="0.6" fill="none" opacity="0.1"/>
      <path d="M205 185 Q212 165 206 148 Q198 132 206 112 Q214 95 208 75" stroke={color} strokeWidth="0.4" fill="none" opacity="0.07" strokeDasharray="3 6"/>
      {/* Smoke glow at tips */}
      <circle cx="186" cy="55" r="6" fill={color} opacity="0.03" filter="url(#sa1)"/>
      <circle cx="198" cy="42" r="5" fill={color} opacity="0.025" filter="url(#sa1)"/>
      {/* Faint vertical columns/walls around the altar */}
      <line x1="150" y1="190" x2="145" y2="35" stroke={color} strokeWidth="0.4" opacity="0.08"/>
      <line x1="250" y1="190" x2="255" y2="35" stroke={color} strokeWidth="0.4" opacity="0.08"/>
      <line x1="130" y1="190" x2="122" y2="45" stroke={color} strokeWidth="0.25" opacity="0.05" strokeDasharray="3 8"/>
      <line x1="270" y1="190" x2="278" y2="45" stroke={color} strokeWidth="0.25" opacity="0.05" strokeDasharray="3 8"/>
      {/* Top arch suggestion between columns */}
      <path d="M145 35 Q200 15 255 35" stroke={color} strokeWidth="0.3" fill="none" opacity="0.06"/>
    </svg>
  );
}

/* 37. The God After God — Ruined temple with light pouring through */
function TheGodAfterGod({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ga1"><feGaussianBlur stdDeviation="6"/></filter></defs>
      {/* Broken columns */}
      <line x1="130" y1="250" x2="135" y2="100" stroke={color} strokeWidth="1" opacity="0.15"/>
      <line x1="130" y1="250" x2="135" y2="140" stroke={color} strokeWidth="1.5" opacity="0.12"/>
      <line x1="270" y1="250" x2="265" y2="120" stroke={color} strokeWidth="0.8" opacity="0.1" strokeDasharray="6 10"/>
      {/* Collapsed arch */}
      <path d="M135 100 Q170 55 200 50" stroke={color} strokeWidth="0.8" fill="none" opacity="0.12"/>
      <path d="M200 50 Q230 55 265 120" stroke={color} strokeWidth="0.5" fill="none" opacity="0.06" strokeDasharray="4 8"/>
      {/* Light pouring through the gaps */}
      <rect x="160" y="70" width="80" height="160" fill={color} opacity="0.03" filter="url(#ga1)"/>
      <ellipse cx="200" cy="130" rx="30" ry="60" fill={color} opacity="0.04" filter="url(#ga1)"/>
      {/* Debris */}
      {[...Array(8)].map((_,i) => (
        <rect key={i} x={150+Math.random()*100} y={220+Math.random()*30} width={3+Math.random()*8} height={2+Math.random()*4} fill={color} opacity={0.04+Math.random()*0.04} transform={`rotate(${Math.random()*60} ${170+i*10} ${235})`}/>
      ))}
    </svg>
  );
}

/* 38. Right Here, Right Now — Single expanding pulse */
function RightHereRightNow({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="rh1"><feGaussianBlur stdDeviation="4"/></filter>
        <filter id="rh2"><feGaussianBlur stdDeviation="8"/></filter>
        <radialGradient id="rh3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.07"/>
          <stop offset="50%" stopColor={color} stopOpacity="0.02"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Subtle radial gradient field */}
      <circle cx="200" cy="150" r="100" fill="url(#rh3)"/>
      {/* Center pulse — brighter and larger */}
      <circle cx="200" cy="150" r="4" fill={color} opacity="0.35"/>
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.1" filter="url(#rh1)"/>
      <circle cx="200" cy="150" r="16" fill={color} opacity="0.04" filter="url(#rh2)"/>
      {/* Three ripples expanding outward */}
      <circle cx="200" cy="150" r="35" fill="none" stroke={color} strokeWidth="1.2" opacity="0.18"/>
      <circle cx="200" cy="150" r="65" fill="none" stroke={color} strokeWidth="0.7" opacity="0.1"/>
      <circle cx="200" cy="150" r="100" fill="none" stroke={color} strokeWidth="0.4" opacity="0.06"/>
      {/* Floating mote particles — present-moment awareness */}
      {[[178,128,1.0],[225,135,0.8],[185,172,0.9],[218,168,0.7],[195,118,0.6],[210,178,0.8],[170,148,0.7],[232,152,0.6]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.08+i*0.005}/>
      ))}
    </svg>
  );
}

/* 39. The Cathedral Without Walls — Branches forming gothic arches */
function TheCathedralWithoutWalls({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="cw1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {/* Tree trunks */}
      <path d="M140 280 Q138 220 142 160 Q148 100 165 60 Q180 35 200 25" stroke={color} strokeWidth="1" fill="none" opacity="0.2"/>
      <path d="M260 280 Q262 220 258 160 Q252 100 235 60 Q220 35 200 25" stroke={color} strokeWidth="1" fill="none" opacity="0.2"/>
      {/* Branches meeting — forming arch */}
      <path d="M142 160 Q155 140 175 130" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
      <path d="M258 160 Q245 140 225 130" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
      <path d="M148 120 Q170 100 190 95" stroke={color} strokeWidth="0.4" fill="none" opacity="0.1"/>
      <path d="M252 120 Q230 100 210 95" stroke={color} strokeWidth="0.4" fill="none" opacity="0.1"/>
      {/* Light through canopy */}
      {[[200,25],[185,95],[215,95],[175,130],[225,130]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={2+i*0.5} fill={color} opacity={0.1-i*0.015} filter="url(#cw1)"/>
      ))}
    </svg>
  );
}

/* 40. The Problem of Evil — Light creating shadows */
function TheProblemOfEvil({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="pe1"><feGaussianBlur stdDeviation="4"/></filter></defs>
      {/* Light source */}
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.12" filter="url(#pe1)"/>
      <circle cx="200" cy="150" r="3" fill={color} opacity="0.25"/>
      {/* Rays */}
      {[...Array(12)].map((_,i) => {
        const a=(i/12)*Math.PI*2;
        return <line key={i} x1={200+Math.cos(a)*15} y1={150+Math.sin(a)*15} x2={200+Math.cos(a)*120} y2={150+Math.sin(a)*90} stroke={color} strokeWidth="0.3" opacity="0.08"/>;
      })}
      {/* Shadow wedges — the more light, the sharper the shadows */}
      {[1,4,7,10].map((i) => {
        const a1 = ((i-0.3)/12)*Math.PI*2;
        const a2 = ((i+0.3)/12)*Math.PI*2;
        return <path key={i} d={`M${200+Math.cos(a1)*25} ${150+Math.sin(a1)*25} L${200+Math.cos(a1)*110} ${150+Math.sin(a1)*85} L${200+Math.cos(a2)*110} ${150+Math.sin(a2)*85}Z`} fill="rgba(0,0,0,0.15)" opacity="0.3"/>;
      })}
    </svg>
  );
}

/* 41. Is This All There Is? — Horizon with something beyond */
function IsThisAllThereIs({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="ia1"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="ia2"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      {/* Horizon line — more defined */}
      <line x1="0" y1="150" x2="400" y2="150" stroke={color} strokeWidth="0.8" opacity="0.2"/>
      {/* Above — perspective lines fading into emptiness */}
      <line x1="200" y1="148" x2="60" y2="40" stroke={color} strokeWidth="0.3" opacity="0.06"/>
      <line x1="200" y1="148" x2="140" y2="30" stroke={color} strokeWidth="0.25" opacity="0.05"/>
      <line x1="200" y1="148" x2="260" y2="30" stroke={color} strokeWidth="0.25" opacity="0.05"/>
      <line x1="200" y1="148" x2="340" y2="40" stroke={color} strokeWidth="0.3" opacity="0.06"/>
      {/* Vertical marks above — the known world, sparse */}
      {[...Array(5)].map((_,i) => (
        <line key={i} x1={60+i*70} y1={140} x2={60+i*70} y2={90+i*6} stroke={color} strokeWidth="0.35" opacity={0.07-i*0.008}/>
      ))}
      {/* Below — stronger hidden glow forms */}
      <ellipse cx="200" cy="195" rx="90" ry="32" fill={color} opacity="0.08" filter="url(#ia1)"/>
      <ellipse cx="170" cy="218" rx="50" ry="18" fill={color} opacity="0.06" filter="url(#ia1)"/>
      <ellipse cx="240" cy="230" rx="40" ry="15" fill={color} opacity="0.05" filter="url(#ia1)"/>
      <ellipse cx="200" cy="250" rx="60" ry="20" fill={color} opacity="0.04" filter="url(#ia1)"/>
      {/* Bright points below the horizon — something is there */}
      <circle cx="180" cy="190" r="1.5" fill={color} opacity="0.18" filter="url(#ia2)"/>
      <circle cx="220" cy="205" r="1.2" fill={color} opacity="0.15" filter="url(#ia2)"/>
      <circle cx="195" cy="225" r="1.0" fill={color} opacity="0.12" filter="url(#ia2)"/>
      <circle cx="240" cy="240" r="0.8" fill={color} opacity="0.1" filter="url(#ia2)"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   THE MORAL LIFE — Lattice palette
   ═══════════════════════════════════════════════ */

/* 42. How Do You Forgive? — Tight knot loosening */
function HowDoYouForgive({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Tight knot */}
      <path d="M180 130 Q190 120 200 128 Q210 138 205 148 Q198 158 188 152 Q178 144 185 135 Q192 126 202 132" stroke={color} strokeWidth="1" fill="none" opacity="0.25"/>
      <path d="M195 125 Q210 122 215 135 Q218 150 208 158 Q195 165 185 158 Q175 148 182 138" stroke={color} strokeWidth="0.7" fill="none" opacity="0.18"/>
      {/* Loosening strands */}
      <path d="M180 130 Q165 118 150 115" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
      <path d="M208 158 Q225 170 240 172" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
      <path d="M215 135 Q232 128 248 130" stroke={color} strokeWidth="0.4" fill="none" opacity="0.1"/>
      {/* Air/space openings in knot */}
      <circle cx="195" cy="142" r="3" fill="none" stroke={color} strokeWidth="0.2" opacity="0.08"/>
    </svg>
  );
}

/* 43. The Letting Go — Tender opening hand */
function TheLettingGo({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="lg1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Curved clenching-then-opening lines */}
      <path d="M175 185 Q165 160 170 140 Q178 125 185 115" stroke={color} strokeWidth="0.7" fill="none" opacity="0.18"/>
      <path d="M190 188 Q182 165 185 148 Q190 135 195 125" stroke={color} strokeWidth="0.6" fill="none" opacity="0.15"/>
      <path d="M210 188 Q218 165 215 148 Q210 135 205 125" stroke={color} strokeWidth="0.6" fill="none" opacity="0.15"/>
      <path d="M225 185 Q235 160 230 140 Q222 125 215 115" stroke={color} strokeWidth="0.7" fill="none" opacity="0.18"/>
      {/* Released bright cluster drifting up */}
      {[...Array(8)].map((_,i) => (
        <circle key={i} cx={192+Math.sin(i*1.8)*12} cy={100-i*6} r={0.8+Math.random()*1.5} fill={color} opacity={0.12+i*0.01} filter={i<3?"url(#lg1)":""}/>
      ))}
    </svg>
  );
}

/* 44. What Does Your Anger Want? — Compressed explosion seeking direction */
function WhatDoesYourAngerWant({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="aw1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Compressed core */}
      <circle cx="200" cy="150" r="18" fill={color} opacity="0.06" filter="url(#aw1)"/>
      {/* Dense radiating cracks — contained */}
      {[...Array(14)].map((_,i) => {
        const a=(i/14)*Math.PI*2;
        const len=25+Math.random()*20;
        return <line key={i} x1={200+Math.cos(a)*8} y1={150+Math.sin(a)*8} x2={200+Math.cos(a)*len} y2={150+Math.sin(a)*len*0.75} stroke={color} strokeWidth={0.4+Math.random()*0.4} opacity={0.1+Math.random()*0.08}/>;
      })}
      {/* One arrow-like form — direction */}
      <path d="M200 150 L285 105 L280 112 M285 105 L278 102" stroke={color} strokeWidth="0.8" fill="none" opacity="0.2"/>
    </svg>
  );
}

/* 45. The Fear You Feed — Tiny seed, massive shadow */
function TheFearYouFeed({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="fy1"><feGaussianBlur stdDeviation="10"/></filter></defs>
      {/* Tiny seed */}
      <circle cx="200" cy="245" r="2" fill={color} opacity="0.25"/>
      {/* Massive shadow expanding upward */}
      <path d="M200 240 Q175 200 155 150 Q135 95 120 50 M200 240 Q225 200 245 150 Q265 95 280 50" fill="none" stroke={color} strokeWidth="0.4" opacity="0.08"/>
      <ellipse cx="200" cy="120" rx="70" ry="90" fill={color} opacity="0.03" filter="url(#fy1)"/>
      {/* Feeding lines */}
      {[...Array(5)].map((_,i) => (
        <line key={i} x1={200} y1={245} x2={200+Math.sin(i*1.5)*50} y2={150-i*20} stroke={color} strokeWidth="0.2" opacity="0.06" strokeDasharray="2 5"/>
      ))}
    </svg>
  );
}

/* 46. Raising the Next One — Cupped protective space, growth within */
function RaisingTheNextOne({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Protective curves — shelter without closure */}
      <path d="M130 240 Q120 170 140 110 Q165 65 200 50" stroke={color} strokeWidth="0.9" fill="none" opacity="0.2"/>
      <path d="M270 240 Q280 170 260 110 Q235 65 200 50" stroke={color} strokeWidth="0.9" fill="none" opacity="0.2"/>
      {/* Growing form — organic, upward, seeking its own shape */}
      <path d="M200 230 Q198 200 200 170 Q204 140 200 115 Q196 95 200 75" stroke={color} strokeWidth="0.7" fill="none" opacity="0.18"/>
      {/* Small leaves/branches — finding its own direction */}
      <path d="M200 170 Q212 162 218 165" stroke={color} strokeWidth="0.4" fill="none" opacity="0.12"/>
      <path d="M200 135 Q188 128 182 132" stroke={color} strokeWidth="0.35" fill="none" opacity="0.1"/>
      <path d="M200 100 Q210 92 215 96" stroke={color} strokeWidth="0.3" fill="none" opacity="0.1"/>
      {/* Gap — space between guidance and growth */}
    </svg>
  );
}

/* 47. The Intelligence of Wounds — Body meridian with bright wound nodes */
function TheIntelligenceOfWounds({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="iw1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Body outline */}
      <path d="M180 40 Q170 70 172 110 Q175 160 170 200 Q168 240 175 275" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
      <path d="M220 40 Q230 70 228 110 Q225 160 230 200 Q232 240 225 275" stroke={color} strokeWidth="0.5" fill="none" opacity="0.12"/>
      {/* Internal meridians */}
      <path d="M195 50 Q190 90 195 130 Q200 170 195 210 Q190 250 195 280" stroke={color} strokeWidth="0.3" fill="none" opacity="0.08"/>
      <path d="M205 50 Q210 90 205 130 Q200 170 205 210 Q210 250 205 280" stroke={color} strokeWidth="0.3" fill="none" opacity="0.08"/>
      {/* Wound nodes — glowing bright */}
      {[[195,85],[210,140],[188,195],[205,250]].map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={5} fill={color} opacity="0.06" filter="url(#iw1)"/>
          <circle cx={x} cy={y} r={2} fill={color} opacity="0.18"/>
          {/* Signal branches from wounds */}
          <path d={`M${x} ${y} Q${x+15} ${y-8} ${x+25} ${y-5}`} stroke={color} strokeWidth="0.3" fill="none" opacity="0.1"/>
          <path d={`M${x} ${y} Q${x-12} ${y+8} ${x-22} ${y+5}`} stroke={color} strokeWidth="0.3" fill="none" opacity="0.1"/>
        </g>
      ))}
    </svg>
  );
}

/* 48. The Examined Life — Mirror reflecting mirror, infinite regress */
function TheExaminedLife({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {[...Array(7)].map((_,i) => {
        const s = 1-i*0.13;
        const w = 120*s; const h = 180*s;
        return <rect key={i} x={200-w/2+i*3} y={150-h/2+i*2} width={w} height={h} fill="none" stroke={color} strokeWidth={0.4-i*0.04} opacity={0.15-i*0.018} rx="2"/>;
      })}
      {/* Distortion in deeper reflections */}
      <path d="M195 148 Q200 142 205 148" stroke={color} strokeWidth="0.3" fill="none" opacity="0.06"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   MIND & CREATIVITY — Orbit palette
   ═══════════════════════════════════════════════ */

/* 49. The Ghost in the Engine — Mechanical + organic overlay */
function TheGhostInTheEngine({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Grid/circuit layer */}
      {[...Array(6)].map((_,i) => <line key={`v${i}`} x1={120+i*35} y1={40} x2={120+i*35} y2={260} stroke={color} strokeWidth="0.2" opacity="0.05"/>)}
      {[...Array(5)].map((_,i) => <line key={`h${i}`} x1={100} y1={60+i*48} x2={300} y2={60+i*48} stroke={color} strokeWidth="0.2" opacity="0.05"/>)}
      {/* Organic neural curves */}
      <path d="M150 80 Q170 100 180 130 Q188 160 175 190 Q162 215 170 245" stroke={color} strokeWidth="0.6" fill="none" opacity="0.15"/>
      <path d="M240 70 Q225 100 220 135 Q218 168 228 195 Q240 220 235 250" stroke={color} strokeWidth="0.6" fill="none" opacity="0.15"/>
      {/* Ghost points — in the gaps */}
      {[[188,115],[212,148],[178,178],[225,108],[195,210]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.5+Math.random()} fill={color} opacity={0.12+i*0.015}/>
      ))}
    </svg>
  );
}

/* 50. The Vessel and the Flame — Cracked vessel, light through cracks */
function TheVesselAndTheFlame({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="vf1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {/* Vessel outline */}
      <path d="M165 60 Q155 100 158 150 Q162 200 168 240 Q175 260 200 268 Q225 260 232 240 Q238 200 242 150 Q245 100 235 60" stroke={color} strokeWidth="0.8" fill="none" opacity="0.18"/>
      {/* Cracks with light */}
      {[[178,90,20,15],[225,120,-18,20],[170,160,22,12],[230,190,-20,18],[185,220,18,8]].map(([x,y,dx,dy],i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x+dx} y2={y+dy} stroke={color} strokeWidth="1" opacity="0.3" filter="url(#vf1)"/>
          <line x1={x} y1={y} x2={x+dx} y2={y+dy} stroke={color} strokeWidth="0.4" opacity="0.4"/>
        </g>
      ))}
      {/* Inner glow from within */}
      <ellipse cx="200" cy="160" rx="25" ry="50" fill={color} opacity="0.03"/>
    </svg>
  );
}

/* 51. When Words Aren't Enough — Dissolving text into pure form */
function WhenWordsArentEnough({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Abstract letter forms dissolving left to right */}
      {[...Array(8)].map((_,i) => {
        const x = 80+i*38;
        const dissolve = i/8;
        return <g key={i}>
          <line x1={x} y1={140} x2={x+12} y2={140} stroke={color} strokeWidth="0.5" opacity={(0.15-dissolve*0.12)} strokeDasharray={dissolve > 0.5 ? "2 4" : "none"}/>
          <line x1={x+5} y1={135} x2={x+5} y2={158} stroke={color} strokeWidth="0.4" opacity={(0.12-dissolve*0.1)} strokeDasharray={dissolve > 0.3 ? "2 3" : "none"}/>
          {dissolve > 0.5 && <circle cx={x+8} cy={148} r={1+dissolve*2} fill={color} opacity={dissolve*0.08}/>}
        </g>;
      })}
      {/* What emerges — wave/organic forms on the right */}
      <path d="M310 130 Q325 140 320 155 Q315 170 330 175" stroke={color} strokeWidth="0.7" fill="none" opacity="0.15"/>
      <path d="M330 125 Q340 145 335 160" stroke={color} strokeWidth="0.5" fill="none" opacity="0.1"/>
    </svg>
  );
}

/* 52. The Discipline of Seeing — Eye becoming landscape of detail */
function TheDisciplineOfSeeing({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Eye shape */}
      <path d="M120 150 Q160 100 200 95 Q240 100 280 150 Q240 200 200 205 Q160 200 120 150Z" fill="none" stroke={color} strokeWidth="0.7" opacity="0.18"/>
      {/* Iris/pupil opening into depth */}
      <circle cx="200" cy="150" r="22" fill="none" stroke={color} strokeWidth="0.5" opacity="0.15"/>
      <circle cx="200" cy="150" r="10" fill={color} opacity="0.04"/>
      {/* Detail points radiating from eye — attention as creation */}
      {[...Array(10)].map((_,i) => {
        const a = (i/10)*Math.PI*2;
        const d = 80+i*8;
        const x = 200+Math.cos(a)*d;
        const y = 150+Math.sin(a)*d*0.6;
        return <g key={i}>
          <line x1={200+Math.cos(a)*28} y1={150+Math.sin(a)*28} x2={x} y2={y} stroke={color} strokeWidth="0.15" opacity="0.06"/>
          <circle cx={x} cy={y} r={1+Math.random()*1.5} fill={color} opacity={0.08+Math.random()*0.06}/>
        </g>;
      })}
    </svg>
  );
}

/* 53. The Freedom of Less — Dense left, refined right */
function TheFreedomOfLess({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Dense left */}
      {[...Array(30)].map((_,i) => {
        const x = 50+Math.random()*120;
        const y = 40+Math.random()*220;
        const type = Math.random();
        if(type < 0.33) return <circle key={i} cx={x} cy={y} r={1+Math.random()*4} fill="none" stroke={color} strokeWidth="0.3" opacity="0.06"/>;
        if(type < 0.66) return <line key={i} x1={x} y1={y} x2={x+Math.random()*20-10} y2={y+Math.random()*20-10} stroke={color} strokeWidth="0.3" opacity="0.06"/>;
        return <rect key={i} x={x} y={y} width={2+Math.random()*6} height={2+Math.random()*6} fill="none" stroke={color} strokeWidth="0.2" opacity="0.05"/>;
      })}
      {/* Refined right — few perfect elements */}
      <circle cx="310" cy="130" r="12" fill="none" stroke={color} strokeWidth="0.6" opacity="0.18"/>
      <line x1="290" y1="185" x2="330" y2="185" stroke={color} strokeWidth="0.5" opacity="0.15"/>
      <circle cx="310" cy="210" r="2" fill={color} opacity="0.12"/>
    </svg>
  );
}

/* 54. The Serious Work of Play — Spiraling joyful marks forming structure */
function TheSeriousWorkOfPlay({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Playful spirals and bouncing marks */}
      {[...Array(6)].map((_,i) => {
        const cx = 120+i*45+Math.sin(i*2)*20;
        const cy = 100+Math.sin(i*1.5)*60;
        const r = 8+Math.random()*12;
        return <path key={i} d={`M${cx} ${cy} Q${cx+r} ${cy-r} ${cx+r*1.5} ${cy} Q${cx+r} ${cy+r} ${cx} ${cy}`} stroke={color} strokeWidth="0.5" fill="none" opacity={0.08+i*0.02}/>;
      })}
      {/* Bouncing dots */}
      {[...Array(15)].map((_,i) => (
        <circle key={`d${i}`} cx={80+i*22+Math.sin(i*3)*15} cy={60+Math.abs(Math.sin(i*1.8))*180} r={0.8+Math.random()*2} fill={color} opacity={0.06+Math.random()*0.08}/>
      ))}
      {/* Hidden structure — barely visible grid beneath the play */}
      <line x1="100" y1="200" x2="300" y2="200" stroke={color} strokeWidth="0.15" opacity="0.04"/>
      <line x1="200" y1="50" x2="200" y2="250" stroke={color} strokeWidth="0.15" opacity="0.04"/>
    </svg>
  );
}

/* 55. The Mind That Won't Be Quiet — Overlapping thought circles, crowding */
function TheMindThatWontBeQuiet({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Many overlapping thought circles */}
      {[[160,100,28],[220,90,32],[180,150,35],[240,140,25],[150,170,22],[260,170,28],[200,120,30],[190,200,24],[230,195,26],[170,130,20],[250,110,22],[210,170,18]].map(([cx,cy,r],i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={0.35+i*0.02} opacity={0.06+i*0.008}/>
      ))}
      {/* Inner marks — thoughts within thoughts */}
      {[[160,100],[220,90],[180,150],[240,140]].map(([cx,cy],i) => (
        <g key={`m${i}`}>
          <line x1={cx-5} y1={cy} x2={cx+5} y2={cy} stroke={color} strokeWidth="0.2" opacity="0.06"/>
          <line x1={cx-4} y1={cy+4} x2={cx+4} y2={cy+4} stroke={color} strokeWidth="0.2" opacity="0.05"/>
        </g>
      ))}
      {/* One tiny gap of silence */}
      <circle cx="310" cy="230" r="8" fill="none" stroke={color} strokeWidth="0.2" opacity="0.08" strokeDasharray="1 3"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   EXPORT MAP — council ID → art component
   ═══════════════════════════════════════════════ */

export const councilArt = {
  // Loss & Grief
  'the-empty-room': TheEmptyRoom,
  'becoming-the-parent': BecomingTheParent,
  'the-uninvited-guest': TheUninvitedGuest,
  'what-carried-you-through': WhatCarriedYouThrough,
  'the-meaning-of-pain': TheMeaningOfPain,
  'the-public-wreckage': ThePublicWreckage,
  'laughing-at-the-abyss': LaughingAtTheAbyss,
  // Love & Connection
  'alone-in-the-room-full-of-people': AloneInTheRoomFullOfPeople,
  'the-undoing-of-two': TheUndoingOfTwo,
  'choosing-to-be-alone': ChoosingToBeAlone,
  'where-do-you-belong': WhereDoYouBelong,
  'the-trouble-with-desire': TheTroubleWithDesire,
  'the-mask-behind-the-face': TheMaskBehindTheFace,
  'the-green-eyed-god': TheGreenEyedGod,
  // Who Am I?
  'the-self-that-isnt-there': TheSelfThatIsntThere,
  'the-mask-that-speaks': TheMaskThatSpeaks,
  'the-stain-that-stays': TheStainThatStays,
  'the-gilded-cage-you-built-yourself': TheGildedCageYouBuiltYourself,
  'the-weight-of-things': TheWeightOfThings,
  'the-story-you-keep-telling': TheStoryYouKeepTelling,
  'the-body-that-carried-you': TheBodyThatCarriedYou,
  // Meaning & Purpose
  'the-question-behind-every-question': TheQuestionBehindEveryQuestion,
  'the-life-you-think-you-want': TheLifeYouThinkYouWant,
  'the-calling-that-wont-shut-up': TheCallingThatWontShutUp,
  'the-blank-page': TheBlankPage,
  'the-price-of-everything': ThePriceOfEverything,
  'why-do-i-keep-going-back': WhyDoIKeepGoingBack,
  'what-you-leave-behind': WhatYouLeaveBehind,
  // Freedom & Justice
  'when-silence-becomes-complicity': WhenSilenceBecomesComplicity,
  'four-freedoms': FourFreedoms,
  'the-emperor-and-the-fugitive': TheEmperorAndTheFugitive,
  'the-inner-citadel': TheInnerCitadel,
  'the-virtue-of-surrender': TheVirtueOfSurrender,
  'the-debt-you-didnt-sign': TheDebtYouDidntSign,
  // Faith, Death & Mystery
  'the-unfinished-life': TheUnfinishedLife,
  'the-silent-altar': TheSilentAltar,
  'the-god-after-god': TheGodAfterGod,
  'right-here-right-now': RightHereRightNow,
  'the-cathedral-without-walls': TheCathedralWithoutWalls,
  'the-problem-of-evil': TheProblemOfEvil,
  'is-this-all-there-is': IsThisAllThereIs,
  // The Moral Life
  'how-do-you-forgive': HowDoYouForgive,
  'the-letting-go': TheLettingGo,
  'what-does-your-anger-want': WhatDoesYourAngerWant,
  'the-fear-you-feed': TheFearYouFeed,
  'raising-the-next-one': RaisingTheNextOne,
  'the-intelligence-of-wounds': TheIntelligenceOfWounds,
  'the-examined-life': TheExaminedLife,
  // Mind & Creativity
  'the-ghost-in-the-engine': TheGhostInTheEngine,
  'the-vessel-and-the-flame': TheVesselAndTheFlame,
  'when-words-arent-enough': WhenWordsArentEnough,
  'the-discipline-of-seeing': TheDisciplineOfSeeing,
  'the-freedom-of-less': TheFreedomOfLess,
  'the-serious-work-of-play': TheSeriousWorkOfPlay,
  'the-mind-that-wont-be-quiet': TheMindThatWontBeQuiet,
};

export default councilArt;

export function getCouncilArtwork(councilId: string): FC<{ color: string }> | null {
  return councilArt[councilId] || null;
}
