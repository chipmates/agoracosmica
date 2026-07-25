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
          <stop offset="50%" stopColor={color} stopOpacity="0.182"/>
          <stop offset="100%" stopColor="transparent"/>
        </linearGradient>
        <filter id="er2"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <rect width="400" height="300" fill="url(#er1)"/>
      {/* Floor perspective */}
      {[...Array(9)].map((_,i) => (
        <line key={`f${i}`} x1={200} y1={135} x2={40+i*44} y2={300} stroke={color} strokeWidth="0.405" opacity={0.156+i*0.0208}/>
      ))}
      {/* Doorframe — solid left, dissolving right */}
      <path d="M155 45 L155 245" stroke={color} strokeWidth="2.16" opacity="0.9"/>
      <path d="M245 45 L245 245" stroke={color} strokeWidth="1.89" opacity="0.468" strokeDasharray="6 14"/>
      <path d="M155 45 L245 45" stroke={color} strokeWidth="1.89" opacity="0.65" strokeDasharray="4 8"/>
      {/* Ghost doorframe */}
      <path d="M150 50 L150 240" stroke={color} strokeWidth="0.54" opacity="0.208" strokeDasharray="2 12"/>
      {/* Chair suggestion — absent presence */}
      <path d="M185 195 L185 215 M215 195 L215 215 M183 195 L217 195" stroke={color} strokeWidth="0.81" opacity="0.26" strokeDasharray="2 4"/>
      {/* Warm glow where person was */}
      <ellipse cx="200" cy="180" rx="25" ry="15" fill={color} opacity="0.104" filter="url(#er2)"/>
      <ellipse cx="200" cy="140" rx="15" ry="35" fill={color} opacity="0.078" filter="url(#er2)"/>
      {/* Dissolving particles from right side of frame */}
      {[...Array(28)].map((_,i) => {
        const x = 245 + Math.sin(i*1.4)*(8+i*1.5);
        const y = 50 + i*7.2;
        return <rect key={i} x={x} y={y} width={1+Math.random()*2.2} height={1+Math.random()*1.8} fill={color} opacity={0.26-i*0.0078} transform={`rotate(${i*12} ${x} ${y})`}/>;
      })}
    </svg>
  );
}

/* 2. Becoming the Parent — Inverted shelter, inheriting the arch */
function BecomingTheParent({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <radialGradient id="bp1g" cx="50%" cy="35%" r="50%"><stop offset="0%" stopColor={color} stopOpacity="0.312"/><stop offset="100%" stopColor="transparent"/></radialGradient>
        <filter id="bp1f"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <rect width="400" height="300" fill="url(#bp1g)"/>
      {/* Large dissolving arch — the one who sheltered you */}
      <path d="M80 270 Q90 60 200 30 Q310 60 320 270" stroke={color} strokeWidth="3.375" fill="none" opacity="0.312" strokeDasharray="6 10"/>
      <path d="M90 265 Q100 70 200 42 Q300 70 310 265" stroke={color} strokeWidth="2.025" fill="none" opacity="0.208" strokeDasharray="4 14"/>
      {/* Dissolving particles from old arch */}
      {[...Array(18)].map((_,i) => {
        const a = (i/18)*Math.PI; const r = 110+i*3;
        const x = 200+Math.cos(a)*r; const y = 30+Math.sin(a)*r*0.6;
        return <rect key={`d${i}`} x={x} y={y} width={2+i%3} height={1.5+i%2} fill={color} opacity={0.104+i*0.0078} transform={`rotate(${i*20} ${x} ${y})`}/>;
      })}
      {/* New solid arch — you, becoming the shelter */}
      <path d="M130 270 Q140 120 200 95 Q260 120 270 270" stroke={color} strokeWidth="2.7" fill="none" opacity="0.9"/>
      <path d="M138 268 Q147 128 200 104 Q253 128 262 268" stroke={color} strokeWidth="1.35" fill="none" opacity="0.52"/>
      {/* Hands reaching between arches */}
      <path d="M165 140 Q180 110 195 90" stroke={color} strokeWidth="1.08" fill="none" opacity="0.52"/>
      <path d="M235 140 Q220 110 205 90" stroke={color} strokeWidth="1.08" fill="none" opacity="0.52"/>
      {/* Keystone where arches meet */}
      <circle cx="200" cy="62" r="6" fill={color} opacity="0.208" filter="url(#bp1f)"/>
      <circle cx="200" cy="62" r="2" fill={color} opacity="0.78"/>
      {/* Grounding figure below */}
      <line x1="200" y1="180" x2="200" y2="220" stroke={color} strokeWidth="1.35" opacity="0.39"/>
      <circle cx="200" cy="174" r="5" fill="none" stroke={color} strokeWidth="0.945" opacity="0.39"/>
      {/* Warmth transfer particles */}
      {[...Array(10)].map((_,i) => {
        const t=i/10; const x=200+Math.sin(t*6)*25; const y=80+t*100;
        return <circle key={i} cx={x} cy={y} r={0.8+t} fill={color} opacity={0.208+t*0.156}/>;
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
      <path d="M170 50 Q160 80 155 120 Q150 170 160 210 Q170 250 185 270" stroke={color} strokeWidth="1.62" fill="none" opacity="0.728"/>
      <path d="M230 50 Q240 80 245 120 Q250 170 240 210 Q230 250 215 270" stroke={color} strokeWidth="1.62" fill="none" opacity="0.728"/>
      {/* Foreign geometric intrusions from the right */}
      <polygon points="260,100 235,115 240,140 270,130" fill="none" stroke={color} strokeWidth="1.215" opacity="0.52"/>
      <polygon points="275,140 245,150 250,175 280,168" fill="none" stroke={color} strokeWidth="0.945" opacity="0.416"/>
      <polygon points="265,170 240,182 242,200 268,195" fill="none" stroke={color} strokeWidth="0.81" opacity="0.312"/>
      {/* Intrusion penetrating the body outline */}
      <line x1="260" y1="100" x2="225" y2="112" stroke={color} strokeWidth="1.08" opacity="0.468"/>
      <line x1="275" y1="140" x2="235" y2="148" stroke={color} strokeWidth="0.81" opacity="0.364"/>
      {/* Deformation in body outline where intrusions enter */}
      <path d="M245 110 Q255 115 248 125" stroke={color} strokeWidth="1.08" fill="none" opacity="0.52"/>
      {/* Spore particles at breach points */}
      {[...Array(15)].map((_,i) => {
        const x = 230+Math.sin(i*2)*25+i*2;
        const y = 100+i*8+Math.cos(i*1.5)*10;
        return <circle key={i} cx={x} cy={y} r={0.5+Math.random()*1.5} fill={color} opacity={0.208+Math.random()*0.208}/>;
      })}
      {/* Inner glow of distress */}
      <ellipse cx="200" cy="150" rx="30" ry="60" fill={color} opacity="0.078" filter="url(#ug1)"/>
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
        return <line key={i} x1={x} y1={y} x2={x+dx} y2={y+dy} stroke={color} strokeWidth={0.3+Math.random()*0.5} opacity={0.13+Math.random()*0.182}/>;
      })}
      {/* The single unbroken thread */}
      <path d="M180 285 Q175 260 185 235 Q200 210 190 185 Q175 165 185 140 Q198 120 192 95 Q185 75 195 50 Q205 30 200 15"
        stroke={color} strokeWidth="1.89" fill="none" opacity="0.9" filter="url(#wc1)"/>
      <path d="M180 285 Q175 260 185 235 Q200 210 190 185 Q175 165 185 140 Q198 120 192 95 Q185 75 195 50 Q205 30 200 15"
        stroke={color} strokeWidth="0.945" fill="none" opacity="0.9"/>
      {/* Nodes along the thread — things that held */}
      {[[185,235],[190,185],[185,140],[192,95],[195,50]].map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3} fill={color} opacity="0.208" filter="url(#wc1)"/>
          <circle cx={x} cy={y} r={1.2} fill={color} opacity="0.52"/>
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
          <stop offset="0%" stopColor="#ff4444" stopOpacity="0.78"/>
          <stop offset="50%" stopColor={color} stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#440000" stopOpacity="0.39"/>
        </linearGradient>
        <filter id="mp2"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      {/* Central fissure */}
      <path d="M200 10 L196 45 L204 80 L193 115 L207 150 L195 185 L205 220 L198 255 L200 290" stroke="url(#mp1)" strokeWidth="3.375" fill="none" filter="url(#mp2)"/>
      <path d="M200 10 L196 45 L204 80 L193 115 L207 150 L195 185 L205 220 L198 255 L200 290" stroke={color} strokeWidth="1.35" fill="none" opacity="0.9"/>
      {/* Left side: crystalline forms (meaning emerges) */}
      <polygon points="140,80 160,65 175,85 165,100 145,95" fill="none" stroke={color} strokeWidth="0.945" opacity="0.52"/>
      <polygon points="125,120 148,108 165,125 150,140 128,135" fill="none" stroke={color} strokeWidth="0.81" opacity="0.468"/>
      <polygon points="135,165 155,155 168,172 155,185 138,178" fill="none" stroke={color} strokeWidth="0.675" opacity="0.39"/>
      {/* Right side: dissolving ash */}
      {[...Array(20)].map((_,i) => {
        const x = 215+Math.random()*80; const y = 60+i*11;
        return <circle key={i} cx={x} cy={y} r={0.5+Math.random()*2} fill={color} opacity={0.156+Math.random()*0.156}/>;
      })}
      {/* Ember glow at core */}
      <ellipse cx="200" cy="150" rx="15" ry="80" fill={color} opacity="0.13" filter="url(#mp2)"/>
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
          <polygon points={pts.join(',')} fill="none" stroke={color} strokeWidth={0.5} opacity={0.468-i*0.026}/>
          <polygon points={pts.join(',')} fill={color} opacity={0.039+Math.sin(i)*0.026}/>
        </g>
      ))}
      {/* Bright edge highlights */}
      <line x1="180" y1="28" x2="178" y2="85" stroke={color} strokeWidth="0.945" opacity="0.65" filter="url(#pw1)"/>
      <line x1="218" y1="80" x2="225" y2="145" stroke={color} strokeWidth="0.675" opacity="0.468"/>
      {/* Falling debris */}
      {[...Array(12)].map((_,i) => (
        <circle key={`d${i}`} cx={75+Math.sin(i*2.1)*160+i*15} cy={25+i*20} r={0.5+Math.random()*1.2} fill={color} opacity={0.312+Math.random()*0.208}/>
      ))}
    </svg>
  );
}

/* 7. Laughing at the Abyss — Grin over the void */
function LaughingAtTheAbyss({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="la-v" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
        <filter id="la-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the abyss — a dark mouth opening in the ground */}
      <path d="M96 206 Q160 198 204 202 Q260 198 320 206" fill="none" stroke={color} strokeWidth="1.6" opacity="0.55"/>
      <path d="M140 206 Q170 262 208 268 Q252 262 282 206" fill="url(#la-v)"/>
      <path d="M140 206 Q170 262 208 268 Q252 262 282 206" fill="none" stroke={color} strokeWidth="1.2" opacity="0.4"/>
      {/* the laugh — one bold upturned arc, hanging in the air */}
      <path d="M158 128 Q210 172 262 128" fill="none" stroke={color} strokeWidth="3" opacity="0.9"/>
      <ellipse cx="210" cy="140" rx="58" ry="26" fill={color} opacity="0.1" filter="url(#la-g)"/>
      {/* sparks of it */}
      <path d="M150 110 L142 98 M270 110 L278 98 M210 106 L210 92" stroke={color} strokeWidth="1.4" opacity="0.6"/>
      <path d="M176 100 L170 90 M244 100 L250 90" stroke={color} strokeWidth="1.1" opacity="0.45"/>
      <circle cx="210" cy="82" r="1.6" fill={color} opacity="0.5"/>
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
      <defs>
        <filter id="al-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the crowd — thin figure-strokes with head dots */}
      {[...Array(11)].map((_,i) => {
        const x = 48 + i*24 + (i%3)*4;
        if (i === 5 || i === 6) return null;
        return <g key={i} opacity={0.38}>
          <circle cx={x} cy={112+(i%2)*8} r={4.5} fill={color}/>
          <line x1={x} y1={120+(i%2)*8} x2={x} y2={186+(i%2)*6} stroke={color} strokeWidth="1.6"/>
        </g>;
      })}
      {[...Array(9)].map((_,i) => {
        const x = 300 + (i%5)*20;
        const y = 108 + Math.floor(i/5)*10;
        return <g key={i} opacity={0.3}>
          <circle cx={x} cy={y} r={4} fill={color}/>
          <line x1={x} y1={y+8} x2={x} y2={y+68} stroke={color} strokeWidth="1.4"/>
        </g>;
      })}
      {/* the one — solid, present, apart */}
      <circle cx="196" cy="118" r="7.5" fill={color} opacity="0.9"/>
      <path d="M196 126 L196 196 M196 142 L182 168 M196 142 L210 168" stroke={color} strokeWidth="2.4" opacity="0.9" fill="none"/>
      <ellipse cx="196" cy="150" rx="34" ry="52" fill={color} opacity="0.08" filter="url(#al-g)"/>
      {/* the space nobody crosses */}
      <path d="M160 202 Q196 214 232 202" fill="none" stroke={color} strokeWidth="0.8" opacity="0.25" strokeDasharray="3 6"/>
    </svg>
  );
}

/* 9. The Undoing of Two — Splitting double helix */
function TheUndoingOfTwo({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ut1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Two intertwined paths — woven below, splitting above */}
      <path d="M185 280 Q210 255 190 230 Q170 210 195 185 Q215 165 190 145 Q170 130 185 110 Q200 90 175 65 Q155 45 160 20" stroke={color} strokeWidth="1.62" fill="none" opacity="0.78" filter="url(#ut1)"/>
      <path d="M215 280 Q190 255 210 230 Q230 210 205 185 Q185 165 210 145 Q230 130 215 110 Q200 90 225 65 Q245 45 240 20" stroke={color} strokeWidth="1.62" fill="none" opacity="0.78" filter="url(#ut1)"/>
      {/* Connecting filaments between the splitting strands */}
      {[[192,110,208,110],[180,90,220,90],[172,72,228,68],[165,55,235,50],[162,38,238,32]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.3} opacity={0.39-i*0.065} strokeDasharray="2 3"/>
      ))}
      {/* Particles where strands separate */}
      {[...Array(8)].map((_,i) => (
        <circle key={i} cx={185+Math.sin(i*1.8)*30} cy={60+i*8} r={0.5+Math.random()*1} fill={color} opacity={0.26+Math.random()*0.156}/>
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
          <stop offset="0%" stopColor={color} stopOpacity="0.156"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Inner glow field */}
      <circle cx="190" cy="145" r="60" fill="url(#ca3)"/>
      {/* Core circle — clean and defined */}
      <circle cx="190" cy="145" r="32" fill="none" stroke={color} strokeWidth="1.62" opacity="0.832"/>
      {/* Gentle inner glow */}
      <circle cx="190" cy="145" r="25" fill={color} opacity="0.104" filter="url(#ca1)"/>
      {/* Concentric ripples emanating outward */}
      <circle cx="190" cy="145" r="48" fill="none" stroke={color} strokeWidth="0.675" opacity="0.364"/>
      <circle cx="190" cy="145" r="66" fill="none" stroke={color} strokeWidth="0.54" opacity="0.26"/>
      <circle cx="190" cy="145" r="86" fill="none" stroke={color} strokeWidth="0.405" opacity="0.182"/>
      <circle cx="190" cy="145" r="108" fill="none" stroke={color} strokeWidth="0.3375" opacity="0.117"/>
      <circle cx="190" cy="145" r="132" fill="none" stroke={color} strokeWidth="0.27" opacity="0.065"/>
      {/* Floating motes — solitary particles in the space */}
      {[[142,98,1.2],[248,112,0.9],[120,188,1.0],[255,192,0.8],[170,58,0.7],[222,228,1.1],[98,145,0.6]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.156+i*0.0208} filter="url(#ca2)"/>
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
      <circle cx="200" cy="150" r="4" fill={color} opacity="0.65"/>
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.156" filter="url(#wb1)"/>
      {/* North — straight, structural */}
      <line x1="200" y1="146" x2="200" y2="42" stroke={color} strokeWidth="1.62" opacity="0.572"/>
      <path d="M200 42 Q196 35 190 30" stroke={color} strokeWidth="0.81" fill="none" opacity="0.312"/>
      <path d="M200 42 Q204 36 208 32" stroke={color} strokeWidth="0.675" fill="none" opacity="0.26"/>
      {/* South — dissolving into roots */}
      <path d="M200 154 L200 260 Q195 270 188 275 Q178 280 170 282" stroke={color} strokeWidth="1.62" fill="none" opacity="0.52"/>
      <path d="M188 275 Q182 278 175 276" stroke={color} strokeWidth="0.675" fill="none" opacity="0.26"/>
      <path d="M170 282 Q165 285 158 283" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208"/>
      <path d="M200 260 Q206 268 214 272 Q222 275 228 280" stroke={color} strokeWidth="0.675" fill="none" opacity="0.26"/>
      {/* East — organic curve with root branches */}
      <path d="M204 150 L310 150 Q320 155 325 165 Q328 178 330 188" stroke={color} strokeWidth="1.62" fill="none" opacity="0.468"/>
      <path d="M330 188 Q332 196 328 202" stroke={color} strokeWidth="0.675" fill="none" opacity="0.26"/>
      <path d="M325 165 Q332 162 338 165" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208"/>
      {/* West — organic curve with root branches */}
      <path d="M196 150 L90 150 Q80 148 72 142 Q65 135 58 132" stroke={color} strokeWidth="1.62" fill="none" opacity="0.468"/>
      <path d="M58 132 Q52 128 48 132" stroke={color} strokeWidth="0.675" fill="none" opacity="0.26"/>
      <path d="M72 142 Q66 146 60 148" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208"/>
      {/* Diagonal root-lines */}
      <path d="M200 150 L265 85 Q275 78 282 72 Q290 62 295 58" stroke={color} strokeWidth="0.945" fill="none" opacity="0.364"/>
      <path d="M295 58 Q300 52 298 45" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208"/>
      <path d="M200 150 L135 215 Q125 228 118 235 Q108 242 100 245" stroke={color} strokeWidth="0.945" fill="none" opacity="0.364"/>
      <path d="M100 245 Q94 248 88 246" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208"/>
      {/* One brighter direction — suggestion of home */}
      <path d="M200 150 L280 110 Q295 105 305 98" stroke={color} strokeWidth="1.89" fill="none" opacity="0.9"/>
      <circle cx="305" cy="98" r="3.5" fill={color} opacity="0.52"/>
      <circle cx="305" cy="98" r="8" fill={color} opacity="0.156" filter="url(#wb1)"/>
      <path d="M305 98 Q312 92 318 90" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
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
      <circle cx="200" cy="55" r="18" fill={color} opacity="0.156" filter="url(#td2)"/>
      <circle cx="200" cy="55" r="10" fill={color} opacity="0.26" filter="url(#td1)"/>
      <circle cx="200" cy="55" r="3" fill={color} opacity="0.78"/>
      {/* Five reaching tendrils from below — thicker, more presence */}
      <path d="M165 285 Q158 240 165 195 Q175 160 170 130 Q165 105 178 85" stroke={color} strokeWidth="2.025" fill="none" opacity="0.65"/>
      <path d="M190 285 Q185 235 190 190 Q196 155 192 125 Q188 100 195 80" stroke={color} strokeWidth="2.025" fill="none" opacity="0.728"/>
      <path d="M200 285 Q198 230 200 180 Q202 145 200 115 Q198 90 200 72" stroke={color} strokeWidth="2.025" fill="none" opacity="0.78"/>
      <path d="M215 285 Q220 235 215 190 Q208 155 212 125 Q216 100 208 80" stroke={color} strokeWidth="2.025" fill="none" opacity="0.728"/>
      <path d="M240 285 Q248 240 240 195 Q230 160 235 130 Q240 105 225 85" stroke={color} strokeWidth="2.025" fill="none" opacity="0.65"/>
      {/* Fragments breaking off near the light — showing tension */}
      {[[182,82,1.8],[195,75,1.5],[208,72,1.6],[220,78,1.4],[200,68,1.2],[188,70,1.0],[215,74,0.9],[175,88,1.3],[228,86,1.1],[200,64,0.8]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.39-i*0.026}/>
      ))}
      {/* Tension lines — fragments reaching toward the unreachable */}
      <line x1="178" y1="85" x2="190" y2="68" stroke={color} strokeWidth="0.675" opacity="0.312" strokeDasharray="1.5 3"/>
      <line x1="195" y1="80" x2="198" y2="65" stroke={color} strokeWidth="0.675" opacity="0.312" strokeDasharray="1.5 3"/>
      <line x1="208" y1="80" x2="204" y2="65" stroke={color} strokeWidth="0.675" opacity="0.312" strokeDasharray="1.5 3"/>
      <line x1="225" y1="85" x2="212" y2="68" stroke={color} strokeWidth="0.675" opacity="0.312" strokeDasharray="1.5 3"/>
      {/* Larger break-off fragments near light showing tension */}
      <path d="M192 74 L188 70 L194 68" stroke={color} strokeWidth="0.81" fill="none" opacity="0.26"/>
      <path d="M210 76 L214 72 L208 69" stroke={color} strokeWidth="0.81" fill="none" opacity="0.26"/>
    </svg>
  );
}

/* 13. The Mask Behind the Face — Peeling profiles revealing void */
function TheMaskBehindTheFace({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="mb1"><feGaussianBlur stdDeviation="5"/></filter></defs>
      {/* Profile layers peeling away */}
      <path d="M150 65 Q135 95 132 135 Q130 175 142 205 Q156 232 180 242" stroke={color} strokeWidth="2.025" fill="none" opacity="0.832"/>
      <path d="M168 60 Q155 90 152 130 Q150 170 160 200 Q174 228 195 238" stroke={color} strokeWidth="1.485" fill="none" opacity="0.572"/>
      <path d="M188 58 Q177 88 175 128 Q173 168 180 198 Q192 225 210 234" stroke={color} strokeWidth="1.08" fill="none" opacity="0.39"/>
      <path d="M210 60 Q202 90 200 128 Q198 165 203 195 Q212 222 228 230" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208" strokeDasharray="3 6"/>
      {/* Peeling connections */}
      <path d="M150 65 C158 62 164 60 168 60" stroke={color} strokeWidth="0.54" fill="none" opacity="0.39"/>
      <path d="M168 60 C177 56 184 56 188 58" stroke={color} strokeWidth="0.405" fill="none" opacity="0.26"/>
      {/* Eyes in first two layers */}
      <circle cx="152" cy="118" r="3.5" fill="none" stroke={color} strokeWidth="0.81" opacity="0.572"/>
      <circle cx="170" cy="115" r="3" fill="none" stroke={color} strokeWidth="0.54" opacity="0.364"/>
      {/* Void behind last layer */}
      {[...Array(15)].map((_,i) => (
        <circle key={i} cx={225+i*5+Math.sin(i*2)*8} cy={75+i*10} r={0.4+Math.random()*1.2} fill={color} opacity={0.104+Math.random()*0.104}/>
      ))}
      <ellipse cx="195" cy="148" rx="40" ry="55" fill={color} opacity="0.065" filter="url(#mb1)"/>
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
        return <path key={i} d={`M${x1} ${y1} A${r} ${r} 0 1 1 ${x2} ${y2}`} stroke={color} strokeWidth={0.5+i*0.15} fill="none" opacity={0.208+i*0.091}/>;
      })}
      {/* Bright clutching center */}
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.208" filter="url(#ge1)"/>
      <circle cx="200" cy="150" r="3" fill={color} opacity="0.52"/>
      {/* Trapped particles within */}
      {[...Array(10)].map((_,i) => {
        const a = (i/10)*Math.PI*2;
        const d = 15+i*4;
        return <circle key={i} cx={200+Math.cos(a)*d} cy={150+Math.sin(a)*d*0.7} r={0.5+Math.random()*1} fill={color} opacity={0.26+Math.random()*0.208}/>;
      })}
      {/* Grasping finger-like curves */}
      {[0,72,144,216,288].map((angle,i) => {
        const rad = angle*Math.PI/180;
        const x1 = 200+Math.cos(rad)*90;
        const y1 = 150+Math.sin(rad)*65;
        const x2 = 200+Math.cos(rad)*45;
        const y2 = 150+Math.sin(rad)*32;
        return <path key={i} d={`M${x1} ${y1} Q${200+Math.cos(rad+0.3)*65} ${150+Math.sin(rad+0.3)*48} ${x2} ${y2}`} stroke={color} strokeWidth="0.675" fill="none" opacity={0.26+i*0.052}/>;
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
        return r > 0 ? <circle key={i} cx="200" cy="150" r={r} fill="none" stroke={color} strokeWidth={0.3+i*0.07} opacity={0.13+i*0.0572} strokeDasharray={`${dash} ${gap}`} transform={`rotate(${i*13} 200 150)`}/> : null;
      })}
      <path d="M186 132 Q178 142 180 156 Q184 170 196 172" stroke={color} strokeWidth="0.7425" fill="none" opacity="0.468"/>
      <path d="M212 128 Q224 138 221 155 Q217 172 206 176" stroke={color} strokeWidth="0.6075" fill="none" opacity="0.338"/>
      <circle cx="200" cy="150" r="2" fill="none" stroke={color} strokeWidth="0.4725" opacity="0.52" strokeDasharray="1 2"/>
      {[...Array(18)].map((_,i) => {
        const a=(i/18)*Math.PI*2; const d=12+i*5;
        return <circle key={i} cx={200+Math.cos(a)*d} cy={150+Math.sin(a)*d*0.7} r={0.3+Math.random()*1.1} fill={color} opacity={0.208+i*0.0156}/>;
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
      <path d="M120 80 Q200 35 280 80" stroke={color} strokeWidth="2.7" fill="none" opacity="0.65"/>
      <path d="M132 92 Q200 52 268 92" stroke={color} strokeWidth="2.025" fill="none" opacity="0.468"/>
      <path d="M145 102 Q200 68 255 102" stroke={color} strokeWidth="1.35" fill="none" opacity="0.312"/>
      {/* Prominent mouth curve */}
      <path d="M150 172 Q200 210 250 172" stroke={color} strokeWidth="2.7" fill="none" opacity="0.832" filter="url(#ms1)"/>
      <path d="M162 186 Q202 215 242 186" stroke={color} strokeWidth="1.35" fill="none" opacity="0.39"/>
      {/* Eyes — almond shapes */}
      <path d="M155 128 Q175 115 195 128 Q175 141 155 128Z" fill="none" stroke={color} strokeWidth="1.08" opacity="0.52"/>
      <path d="M205 128 Q225 115 245 128 Q225 141 205 128Z" fill="none" stroke={color} strokeWidth="1.08" opacity="0.52"/>
      {/* Three thick puppet strings from above */}
      <line x1="170" y1="0" x2="172" y2="80" stroke={color} strokeWidth="0.945" opacity="0.312"/>
      <line x1="200" y1="0" x2="200" y2="75" stroke={color} strokeWidth="1.08" opacity="0.39"/>
      <line x1="230" y1="0" x2="228" y2="80" stroke={color} strokeWidth="0.945" opacity="0.312"/>
      {/* Larger word-particles falling from the mouth */}
      {[[172,215,2.5],[188,225,2.2],[205,220,2.8],[220,230,2.0],[195,238,1.8],[210,242,2.3],[180,248,1.6],[200,255,1.4]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.364-i*0.0312}/>
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
      <ellipse cx="200" cy="150" rx="55" ry="45" fill={color} opacity="0.13" filter="url(#ss1)"/>
      <path d="M172 132 Q182 112 200 118 Q218 124 226 138 Q234 156 230 174 Q222 192 206 188 Q188 184 180 168 Q172 152 172 132Z" fill={color} opacity="0.208" filter="url(#ss2)"/>
      <path d="M182 138 Q190 122 202 128 Q216 134 220 146 Q224 160 220 172 Q214 182 204 180 Q192 176 186 164 Q180 152 182 138Z" fill={color} opacity="0.26"/>
      {/* Tendrils */}
      <path d="M172 132 Q142 112 112 118" stroke={color} strokeWidth="0.945" fill="none" opacity="0.338"/>
      <path d="M226 138 Q258 122 288 132" stroke={color} strokeWidth="0.81" fill="none" opacity="0.26"/>
      <path d="M180 168 Q155 190 125 195" stroke={color} strokeWidth="0.675" fill="none" opacity="0.208"/>
      <path d="M230 174 Q258 195 292 190" stroke={color} strokeWidth="0.6075" fill="none" opacity="0.182"/>
      <path d="M200 118 Q196 82 200 52" stroke={color} strokeWidth="0.6075" fill="none" opacity="0.208"/>
      <path d="M206 188 Q210 228 202 258" stroke={color} strokeWidth="0.54" fill="none" opacity="0.156"/>
      {[...Array(10)].map((_,i) => {
        const a=(i/10)*Math.PI*2; const d=65+i*7;
        return <circle key={i} cx={200+Math.cos(a)*d} cy={150+Math.sin(a)*d*0.7} r={0.6+Math.random()*1.3} fill={color} opacity={0.156+Math.random()*0.13}/>;
      })}
    </svg>
  );
}

/* 18. The Gilded Cage — Ornate bars with vine breaking through */
function TheGildedCageYouBuiltYourself({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="gc1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {[...Array(7)].map((_,i) => <line key={i} x1={132+i*22} y1={52} x2={132+i*22} y2={248} stroke={color} strokeWidth="0.945" opacity={0.26+Math.sin(i)*0.104}/>)}
      {[...Array(5)].map((_,i) => <line key={`h${i}`} x1={128} y1={72+i*40} x2={282} y2={72+i*40} stroke={color} strokeWidth="0.54" opacity={0.182+i*0.0208}/>)}
      <path d="M132 52 Q200 18 268 52" stroke={color} strokeWidth="0.945" fill="none" opacity="0.338"/>
      <path d="M200 248 Q196 218 198 188 Q202 158 192 138 Q180 124 186 98 Q196 74 200 48" stroke={color} strokeWidth="1.485" fill="none" opacity="0.728" filter="url(#gc1)"/>
      <path d="M192 138 Q172 132 158 138" stroke={color} strokeWidth="0.675" fill="none" opacity="0.468"/>
      <path d="M198 188 Q218 182 232 188" stroke={color} strokeWidth="0.6075" fill="none" opacity="0.364"/>
      {[[158,136],[232,186],[152,96],[200,44]].map(([x,y],i) => (
        <ellipse key={i} cx={x} cy={y} rx={3.5} ry={1.8} fill={color} opacity={0.26+i*0.052} transform={`rotate(${-28+i*22} ${x} ${y})`}/>
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
      <circle cx="200" cy="55" r="3" fill={color} opacity="0.52"/>
      <circle cx="200" cy="55" r="6" fill={color} opacity="0.156" filter="url(#wt1)"/>
      {/* Hanging weighted objects — larger, more defined */}
      {[[130,145,26,20],[168,172,22,18],[232,162,24,19],[272,138,20,16],[195,195,28,22]].map(([x,y,w,h],i) => (
        <g key={i}>
          <line x1={200} y1={55} x2={x} y2={y-h/2} stroke={color} strokeWidth="0.945" opacity={0.39+i*0.052}/>
          <rect x={x-w/2} y={y-h/2} width={w} height={h} fill={color} fillOpacity="0.03" stroke={color} strokeWidth="1.08" opacity={0.468+i*0.065} rx="2"/>
        </g>
      ))}
      {/* One shape mid-fall — thread just cut, springing upward */}
      <g>
        {/* The cut thread — dashed, broken */}
        <line x1={200} y1={55} x2={310} y2={115} stroke={color} strokeWidth="0.54" opacity="0.208" strokeDasharray="2 5"/>
        {/* Freed thread end springing up — whip curve */}
        <path d="M310 115 Q308 95 312 75 Q318 55 310 38" stroke={color} strokeWidth="0.81" fill="none" opacity="0.468"/>
        {/* Falling shape — rotated, tumbling */}
        <rect x={300} y={175} width={18} height={14} fill="none" stroke={color} strokeWidth="0.945" opacity="0.39" rx="2" transform="rotate(25 309 182)"/>
        {/* Fall trail */}
        <line x1={310} y1={130} x2={309} y2={170} stroke={color} strokeWidth="0.405" opacity="0.208" strokeDasharray="1 4"/>
      </g>
      {/* Second fallen object */}
      <rect x={88} y={230} width={16} height={12} fill="none" stroke={color} strokeWidth="0.675" opacity="0.26" rx="2" transform="rotate(-18 96 236)"/>
      <line x1={200} y1={55} x2={96} y2={200} stroke={color} strokeWidth="0.405" opacity="0.156" strokeDasharray="2 5"/>
    </svg>
  );
}

/* 20. The Story You Keep Telling — Loop that doesn't expand */
function TheStoryYouKeepTelling({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="st-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the loop, retold until worn — layered rings */}
      <circle cx="196" cy="150" r="52" fill="none" stroke={color} strokeWidth="2" opacity="0.7"/>
      <circle cx="196" cy="150" r="44" fill="none" stroke={color} strokeWidth="1" opacity="0.35" strokeDasharray="10 8"/>
      <circle cx="196" cy="150" r="60" fill="none" stroke={color} strokeWidth="0.8" opacity="0.25" strokeDasharray="4 10"/>
      {/* tally marks of repetition on the ring */}
      {[...Array(8)].map((_,i) => {
        const a = -0.4 + i*0.22;
        return <line key={i} x1={196+Math.cos(a)*48} y1={150+Math.sin(a)*48} x2={196+Math.cos(a)*57} y2={150+Math.sin(a)*57} stroke={color} strokeWidth="1" opacity="0.45"/>;
      })}
      {/* the breakout — the line leaves the loop and runs free */}
      <path d="M244 132 Q286 112 322 118 Q352 124 368 112" fill="none" stroke={color} strokeWidth="2.2" opacity="0.9"/>
      <circle cx="368" cy="112" r="2.4" fill={color} opacity="0.9"/>
      <ellipse cx="330" cy="118" rx="40" ry="18" fill={color} opacity="0.1" filter="url(#st-g)"/>
      {/* the old page it circled on */}
      <path d="M132 216 L268 216" stroke={color} strokeWidth="0.8" opacity="0.2"/>
    </svg>
  );
}

/* 21. The Body That Carried You — Body topography shifting over time */
function TheBodyThatCarriedYou({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="bc1"><feGaussianBlur stdDeviation="4"/></filter></defs>
      {/* First body-landscape silhouette — solid, the body as it was */}
      <path d="M0 175 Q45 142 90 148 Q130 155 160 140 Q190 125 215 132 Q245 140 275 130 Q310 118 345 128 Q375 135 400 125" stroke={color} strokeWidth="1.89" fill="none" opacity="0.728"/>
      {/* Second body-landscape — shifted contours, the body as it became */}
      <path d="M0 185 Q50 155 95 160 Q135 168 165 150 Q195 135 220 142 Q250 152 280 140 Q315 128 350 138 Q380 145 400 135" stroke={color} strokeWidth="1.62" fill="none" opacity="0.572" strokeDasharray="6 4"/>
      {/* Topographic contour lines between the two silhouettes */}
      <path d="M0 178 Q48 148 92 153 Q132 160 162 144 Q192 129 218 136 Q248 145 278 134 Q312 122 348 132 Q378 139 400 129" stroke={color} strokeWidth="0.54" fill="none" opacity="0.26"/>
      <path d="M0 182 Q49 152 93 157 Q133 164 163 148 Q193 133 219 139 Q249 148 279 138 Q313 126 349 135 Q379 142 400 132" stroke={color} strokeWidth="0.4725" fill="none" opacity="0.208"/>
      <path d="M0 172 Q46 144 91 149 Q131 156 161 141 Q191 127 216 133 Q246 141 276 131 Q311 120 346 129 Q376 136 400 127" stroke={color} strokeWidth="0.4725" fill="none" opacity="0.208"/>
      {/* Lower body-landscape — hips, legs suggestion */}
      <path d="M0 215 Q55 195 100 205 Q140 215 175 200 Q210 188 240 198 Q275 210 310 200 Q350 190 400 195" stroke={color} strokeWidth="1.62" fill="none" opacity="0.572"/>
      <path d="M0 225 Q60 200 105 212 Q145 222 180 208 Q215 195 245 205 Q280 218 315 208 Q355 196 400 202" stroke={color} strokeWidth="1.35" fill="none" opacity="0.468" strokeDasharray="6 4"/>
      {/* Contour lines between lower pair */}
      <path d="M0 219 Q58 197 102 208 Q142 218 177 203 Q212 191 242 201 Q278 214 312 204 Q352 193 400 198" stroke={color} strokeWidth="0.4725" fill="none" opacity="0.208"/>
      {/* Glow between the shifting contours — area of change */}
      <ellipse cx="200" cy="138" rx="100" ry="18" fill={color} opacity="0.104" filter="url(#bc1)"/>
      <ellipse cx="200" cy="208" rx="90" ry="14" fill={color} opacity="0.078" filter="url(#bc1)"/>
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
        return <path key={i} d={`M${175*s+200*(1-s)+ox} ${80*s+120*(1-s)} Q${230*s+200*(1-s)+ox} ${60*s+110*(1-s)} ${230*s+200*(1-s)+ox} ${110*s+140*(1-s)} Q${230*s+200*(1-s)+ox} ${150*s+165*(1-s)} ${200*s+200*(1-s)+ox} ${155*s+168*(1-s)}`} stroke={color} strokeWidth={0.4+i*0.15} fill="none" opacity={0.156+i*0.104}/>;
      })}
      {/* Innermost opens to light */}
      <circle cx="200" cy="168" r="2.5" fill={color} opacity="0.39" filter="url(#qq1)"/>
      <circle cx="200" cy="168" r="1" fill={color} opacity="0.78"/>
      {/* Dots of inquiry */}
      {[200,198,201,199,200].map((x,i) => (
        <circle key={i} cx={x} cy={178+i*3*(1-i*0.15)} r={1.5-i*0.25} fill={color} opacity={0.39-i*0.065}/>
      ))}
    </svg>
  );
}

/* 23. The Life You Think You Want ★ HERO — Net with wrong catch */
function TheLifeYouThinkYouWant({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="lyw-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* warm glow behind the bird */}
      <ellipse cx="264" cy="148" rx="52" ry="38" fill={color} opacity="0.1" filter="url(#lyw-g)"/>
      {/* the branch */}
      <path d="M170 186 Q240 176 330 182" fill="none" stroke={color} strokeWidth="2" opacity="0.55"/>
      <path d="M306 182 Q322 172 336 168" fill="none" stroke={color} strokeWidth="1.1" opacity="0.35"/>
      <path d="M190 184 Q182 194 172 198" fill="none" stroke={color} strokeWidth="1" opacity="0.3"/>
      {/* the bird — filled silhouette, facing right, beak closed */}
      <path d="M238 178 Q234 160 246 148 Q254 140 266 140 Q276 130 286 132 Q296 134 298 142 L310 146 L298 150 Q298 160 290 168 Q280 176 264 178 Q250 179 244 178 L226 190 Q234 183 238 178 Z" fill={color} opacity="0.75"/>
      {/* feet */}
      <path d="M256 178 L254 186 M266 178 L266 186" stroke={color} strokeWidth="1.1" opacity="0.5"/>
      {/* the song that does not come — one note dissolving into dots */}
      <path d="M316 122 Q322 110 330 104" fill="none" stroke={color} strokeWidth="1.1" opacity="0.4"/>
      <circle cx="332" cy="103" r="3.2" fill={color} opacity="0.4"/>
      <circle cx="344" cy="94" r="1.6" fill={color} opacity="0.28"/>
      <circle cx="354" cy="86" r="1.1" fill={color} opacity="0.18"/>
      <circle cx="362" cy="79" r="0.8" fill={color} opacity="0.1"/>
      {/* the grand room behind, faint and far */}
      {[...Array(4)].map((_,i) => (
        <line key={i} x1={54+i*28} y1={60} x2={54+i*28} y2={182} stroke={color} strokeWidth="0.7" opacity="0.12"/>
      ))}
      <path d="M42 60 L166 60" stroke={color} strokeWidth="0.8" opacity="0.14"/>
    </svg>
  );
}

/* 24. The Calling That Won't Shut Up — Persistent signal pulse */
function TheCallingThatWontShutUp({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="cw-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the stack of dutiful documents */}
      <rect x="118" y="178" width="180" height="13" rx="1.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      <path d="M126 198 L290 198 M134 206 L282 206 M142 214 L274 214" stroke={color} strokeWidth="1.1" opacity="0.3"/>
      {/* the folded letter, slipped out, one corner lifted */}
      <path d="M148 178 L208 150 L268 178 Z" fill={color} opacity="0.5"/>
      <path d="M148 178 L208 150 L268 178" fill="none" stroke={color} strokeWidth="1.7" opacity="0.85"/>
      <path d="M148 178 L268 178" stroke={color} strokeWidth="1.1" opacity="0.5"/>
      <path d="M208 150 L212 178" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <ellipse cx="208" cy="172" rx="52" ry="15" fill={color} opacity="0.12" filter="url(#cw-g)"/>
      {/* the voice rising from the fold */}
      <path d="M198 138 Q208 128 218 138" fill="none" stroke={color} strokeWidth="1.6" opacity="0.7"/>
      <path d="M188 122 Q208 104 228 122" fill="none" stroke={color} strokeWidth="1.4" opacity="0.5"/>
      <path d="M178 106 Q208 80 238 106" fill="none" stroke={color} strokeWidth="1.1" opacity="0.32"/>
      {/* the quill, set down on the stack, waiting */}
      <path d="M300 186 Q322 168 340 144 Q330 172 310 190 Z" fill={color} opacity="0.45"/>
      <path d="M300 186 Q322 168 340 144" fill="none" stroke={color} strokeWidth="1.2" opacity="0.6"/>
    </svg>
  );
}

/* 25. The Blank Page — Near-empty, one brave first mark */
function TheBlankPage({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="bp-g"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      {/* the page, slightly turned */}
      <path d="M150 52 L300 62 L288 252 L138 242 Z" fill={color} opacity="0.05"/>
      <path d="M150 52 L300 62 L288 252 L138 242 Z" fill="none" stroke={color} strokeWidth="1.6" opacity="0.6"/>
      {/* faint ruled lines, waiting */}
      {[...Array(7)].map((_,i) => (
        <line key={i} x1={152} y1={92+i*22} x2={284} y2={98+i*22} stroke={color} strokeWidth="0.6" opacity="0.14"/>
      ))}
      {/* the first sentence — one strong living line */}
      <path d="M156 94 Q186 88 212 93 Q236 98 258 92" fill="none" stroke={color} strokeWidth="2.2" opacity="0.85"/>
      {/* pen point resting where it stopped, still warm */}
      <circle cx="262" cy="92" r="2.2" fill={color} opacity="0.9"/>
      <circle cx="262" cy="92" r="9" fill={color} opacity="0.16" filter="url(#bp-g)"/>
      {/* everything that was, behind — torn corner drifting */}
      <path d="M92 178 L116 172 L112 196 Z" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" transform="rotate(-14 104 184)"/>
      <path d="M70 130 L92 126 L88 148 Z" fill="none" stroke={color} strokeWidth="0.7" opacity="0.14" transform="rotate(9 80 138)"/>
    </svg>
  );
}

/* 26. The Price of Everything — Asymmetric scale */
function ThePriceOfEverything({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="pe-g"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      {/* pillar + tilted beam */}
      <line x1="220" y1="52" x2="220" y2="238" stroke={color} strokeWidth="1.8" opacity="0.5"/>
      <path d="M120 96 L320 76" stroke={color} strokeWidth="2" opacity="0.7"/>
      <circle cx="220" cy="86" r="4" fill="none" stroke={color} strokeWidth="1.4" opacity="0.7"/>
      {/* left pan, lower: the coin, heavy and bright */}
      <line x1="120" y1="96" x2="120" y2="150" stroke={color} strokeWidth="0.9" opacity="0.4"/>
      <path d="M92 150 Q120 172 148 150" fill="none" stroke={color} strokeWidth="1.6" opacity="0.6"/>
      <circle cx="120" cy="142" r="12" fill="none" stroke={color} strokeWidth="1.8" opacity="0.8"/>
      <circle cx="120" cy="142" r="20" fill={color} opacity="0.12" filter="url(#pe-g)"/>
      {/* right pan, higher: the small human heart, unweighable */}
      <line x1="320" y1="76" x2="320" y2="112" stroke={color} strokeWidth="0.9" opacity="0.4"/>
      <path d="M292 112 Q320 134 348 112" fill="none" stroke={color} strokeWidth="1.6" opacity="0.6"/>
      <path d="M320 108 Q313 98 306 104 Q300 110 320 124 Q340 110 334 104 Q327 98 320 108 Z" fill="none" stroke={color} strokeWidth="1.5" opacity="0.85"/>
      {/* base */}
      <path d="M196 238 L244 238" stroke={color} strokeWidth="1.6" opacity="0.4"/>
      {/* faint ledger grid behind */}
      {[...Array(4)].map((_,i) => (
        <line key={i} x1={40} y1={210+i*18} x2={180} y2={210+i*18} stroke={color} strokeWidth="0.5" opacity="0.1"/>
      ))}
    </svg>
  );
}

/* 27. Why Do I Keep Going Back? — Circular trap with worn path */
function WhyDoIKeepGoingBack({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {[...Array(4)].map((_,i) => (
        <circle key={i} cx="195" cy="150" r={52+i*2} fill="none" stroke={color} strokeWidth={0.3+i*0.25} opacity={0.13+i*0.104}/>
      ))}
      {[...Array(14)].map((_,i) => {
        const a=(i/14)*Math.PI*2;
        const x=195+Math.cos(a)*52; const y=150+Math.sin(a)*52;
        return <line key={i} x1={x} y1={y} x2={x+Math.cos(a)*4} y2={y+Math.sin(a)*4} stroke={color} strokeWidth="0.675" opacity="0.312"/>;
      })}
      {/* Attempted escape — curves back */}
      <path d="M247 148 Q270 135 285 140 Q300 150 295 165 Q285 178 265 172 Q252 165 248 155" stroke={color} strokeWidth="0.675" fill="none" opacity="0.39" strokeDasharray="3 4"/>
    </svg>
  );
}

/* 28. What You Leave Behind — Fading footprints into distance */
function WhatYouLeaveBehind({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="lb-g"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      {/* the pedestal, broken at the top */}
      <path d="M226 226 L234 128 L294 128 L302 226" fill="none" stroke={color} strokeWidth="1.6" opacity="0.5"/>
      <path d="M234 128 L246 108 L262 122 L276 102 L294 128" fill="none" stroke={color} strokeWidth="1.3" opacity="0.4"/>
      {/* fragments drifting off */}
      <path d="M310 96 l12 -6 l4 12 l-13 5 Z" fill="none" stroke={color} strokeWidth="0.9" opacity="0.28" transform="rotate(12 318 100)"/>
      <path d="M330 130 l9 -4 l3 9 l-10 4 Z" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" transform="rotate(-8 336 134)"/>
      <path d="M206 226 L322 226" stroke={color} strokeWidth="1.2" opacity="0.4"/>
      {/* the sprout at its foot — alive, glowing */}
      <path d="M150 226 Q150 190 146 172" fill="none" stroke={color} strokeWidth="2" opacity="0.85"/>
      <path d="M148 196 Q128 184 122 166" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"/>
      <path d="M147 184 Q166 172 172 156" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"/>
      <path d="M122 166 Q116 158 118 148 Q128 152 128 162 Z" fill={color} opacity="0.5"/>
      <path d="M172 156 Q178 148 176 138 Q166 142 166 152 Z" fill={color} opacity="0.5"/>
      <circle cx="146" cy="176" r="24" fill={color} opacity="0.1" filter="url(#lb-g)"/>
      {/* seeds on the wind toward the pedestal */}
      {[...Array(6)].map((_,i) => (
        <circle key={i} cx={168+i*16} cy={150-i*7} r={1.2} fill={color} opacity={0.5-i*0.06}/>
      ))}
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
      <path d="M130 148 Q165 140 200 145 Q235 140 270 148" stroke={color} strokeWidth="1.62" fill="none" opacity="0.65"/>
      <path d="M130 152 Q165 160 200 155 Q235 160 270 152" stroke={color} strokeWidth="1.62" fill="none" opacity="0.65"/>
      {/* Cracks forming between */}
      <path d="M165 148 L167 152" stroke={color} strokeWidth="0.675" fill="none" opacity="0.52"/>
      <path d="M195 146 L193 154" stroke={color} strokeWidth="0.81" fill="none" opacity="0.572"/>
      <path d="M225 147 L227 153" stroke={color} strokeWidth="0.54" fill="none" opacity="0.468"/>
      {/* Pressure building — particles accumulating outside */}
      {[...Array(20)].map((_,i) => {
        const x = 120+i*8+Math.sin(i)*6;
        const above = i%2===0;
        const y = above ? 130-Math.random()*30 : 170+Math.random()*30;
        return <circle key={i} cx={x} cy={y} r={0.4+Math.random()*1} fill={color} opacity={0.156+Math.random()*0.156}/>;
      })}
    </svg>
  );
}

/* 30. Four Freedoms — Chains becoming birds */
function FourFreedoms({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="ff-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* three closed links */}
      <ellipse cx="110" cy="150" rx="26" ry="38" fill="none" stroke={color} strokeWidth="2.2" opacity="0.55" transform="rotate(-18 110 150)"/>
      <ellipse cx="168" cy="150" rx="26" ry="38" fill="none" stroke={color} strokeWidth="2.2" opacity="0.62" transform="rotate(14 168 150)"/>
      <ellipse cx="226" cy="150" rx="26" ry="38" fill="none" stroke={color} strokeWidth="2.2" opacity="0.7" transform="rotate(-12 226 150)"/>
      {/* the fourth link — open */}
      <path d="M280 112 A 26 38 16 1 0 306 178" fill="none" stroke={color} strokeWidth="2.4" opacity="0.9" transform="rotate(10 290 146)"/>
      <circle cx="296" cy="132" r="26" fill={color} opacity="0.13" filter="url(#ff-g)"/>
      {/* the gap breathes */}
      <path d="M312 108 L322 96" stroke={color} strokeWidth="1.2" opacity="0.5" strokeDasharray="3 5"/>
      <path d="M322 122 L336 114" stroke={color} strokeWidth="1" opacity="0.4" strokeDasharray="3 5"/>
      {/* ground shadow */}
      <line x1="84" y1="200" x2="330" y2="200" stroke={color} strokeWidth="0.7" opacity="0.15"/>
    </svg>
  );
}

/* 31. The Emperor and the Fugitive — Dissolving crown, escape trajectory */
function TheEmperorAndTheFugitive({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="ef1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path d="M148 118 L158 78 L178 102 L200 68 L222 102 L242 78 L252 118" stroke={color} strokeWidth="1.485" fill="none" opacity="0.572"/>
      <line x1="148" y1="118" x2="252" y2="118" stroke={color} strokeWidth="1.215" opacity="0.468"/>
      <path d="M158 78 L178 102" stroke={color} strokeWidth="0.54" fill="none" opacity="0.208" strokeDasharray="2 5"/>
      {[[162,128,7],[182,132,5],[218,130,6],[238,135,5],[200,126,8]].map(([x,y,s],i) => (
        <rect key={i} x={x} y={y} width={s} height={s*0.4} fill={color} opacity={0.13+i*0.0208} transform={`rotate(${12+i*18} ${x} ${y})`}/>
      ))}
      <path d="M102 258 Q152 218 182 178 Q212 138 262 98 Q302 68 352 38" stroke={color} strokeWidth="0.945" fill="none" opacity="0.468" strokeDasharray="7 4"/>
      {[...Array(5)].map((_,i) => {
        const t=i/5; const x=102+t*250; const y=258-t*220;
        return <line key={i} x1={x} y1={y} x2={x+14} y2={y-11} stroke={color} strokeWidth="0.3375" opacity={0.156+t*0.208}/>;
      })}
      <circle cx="342" cy="44" r="2" fill={color} opacity="0.468" filter="url(#ef1)"/>
    </svg>
  );
}

/* 32. The Inner Citadel — Concentric fortress, pressure held */
function TheInnerCitadel({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {[...Array(5)].map((_,i) => {
        const s = 100-i*18;
        return <rect key={i} x={200-s} y={150-s*0.7} width={s*2} height={s*1.4} fill="none" stroke={color} strokeWidth={0.3+i*0.1} opacity={0.13+i*0.078} rx="2"/>;
      })}
      {/* Pressure arrows from outside */}
      {[...Array(8)].map((_,i) => {
        const a=(i/8)*Math.PI*2;
        const x1=200+Math.cos(a)*130; const y1=150+Math.sin(a)*95;
        const x2=200+Math.cos(a)*105; const y2=150+Math.sin(a)*76;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.54" opacity="0.26"/>;
      })}
      {/* Calm center point */}
      <circle cx="200" cy="150" r="2" fill={color} opacity="0.52"/>
    </svg>
  );
}

/* 33. The Virtue of Surrender — Opening hand releasing */
function TheVirtueOfSurrender({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="vs-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the stream — lines entering, parting around the stone, rejoining */}
      <path d="M30 118 Q140 114 196 122 Q232 100 268 122 Q330 132 372 124" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5"/>
      <path d="M30 146 Q130 142 190 148 Q232 174 274 150 Q334 142 372 148" fill="none" stroke={color} strokeWidth="1.7" opacity="0.6"/>
      <path d="M30 174 Q140 172 200 176 Q240 196 282 178 Q336 170 372 176" fill="none" stroke={color} strokeWidth="1.4" opacity="0.45"/>
      <path d="M30 92 Q160 88 372 96" fill="none" stroke={color} strokeWidth="0.9" opacity="0.25"/>
      <path d="M30 202 Q170 200 372 204" fill="none" stroke={color} strokeWidth="0.9" opacity="0.25"/>
      {/* THE STONE — solid, still, filled */}
      <path d="M204 128 Q212 108 236 108 Q258 110 262 132 Q262 154 240 160 Q214 158 204 144 Q202 136 204 128 Z" fill={color} opacity="0.6"/>
      <path d="M204 128 Q212 108 236 108 Q258 110 262 132 Q262 154 240 160 Q214 158 204 144 Q202 136 204 128 Z" fill="none" stroke={color} strokeWidth="1.6" opacity="0.8"/>
      <ellipse cx="233" cy="134" rx="44" ry="30" fill={color} opacity="0.09" filter="url(#vs-g)"/>
      {/* small standing ripples where water meets stone */}
      <path d="M186 122 q6 -6 12 0" fill="none" stroke={color} strokeWidth="1" opacity="0.45"/>
      <path d="M180 146 q6 -6 12 0" fill="none" stroke={color} strokeWidth="1" opacity="0.4"/>
      {/* downstream calm */}
      <path d="M296 138 q8 -5 16 0" fill="none" stroke={color} strokeWidth="0.9" opacity="0.3"/>
    </svg>
  );
}

/* 34. The Debt You Didn't Sign — Invisible threads forward */
function TheDebtYouDidntSign({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="dy1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Figure suggestion at center — single vertical line with circle head */}
      <line x1="120" y1="115" x2="120" y2="195" stroke={color} strokeWidth="1.35" opacity="0.572"/>
      <circle cx="120" cy="105" r="6" fill="none" stroke={color} strokeWidth="1.08" opacity="0.52"/>
      <circle cx="120" cy="105" r="10" fill={color} opacity="0.104" filter="url(#dy1)"/>
      {/* Threads extending to unformed future obligations — much more visible */}
      {[[280,70],[310,120],[300,170],[280,225],[330,90],[320,200]].map(([x,y],i) => (
        <g key={i}>
          <line x1={120} y1={150} x2={x} y2={y} stroke={color} strokeWidth="1.35" opacity={0.52+i*0.052} strokeDasharray="4 6"/>
        </g>
      ))}
      {/* Unformed shapes at thread endpoints — small, unfinished obligations */}
      <path d="M275 65 Q282 62 286 68 Q283 75 276 72" stroke={color} strokeWidth="0.945" fill="none" opacity="0.468" strokeDasharray="2 2"/>
      <rect x="303" y="114" width="14" height="12" fill="none" stroke={color} strokeWidth="0.81" opacity="0.416" strokeDasharray="2 3" rx="2"/>
      <path d="M294 165 Q300 160 306 167 Q302 175 295 172 Z" stroke={color} strokeWidth="0.81" fill="none" opacity="0.39" strokeDasharray="2 2"/>
      <circle cx="280" cy="225" r="6" fill="none" stroke={color} strokeWidth="0.81" opacity="0.416" strokeDasharray="2 3"/>
      <path d="M325 85 L335 88 L332 98 L322 95 Z" stroke={color} strokeWidth="0.81" fill="none" opacity="0.364" strokeDasharray="2 2"/>
      {/* Faint weight pulling the threads taut */}
      {[[280,70],[310,120],[300,170],[280,225],[330,90]].map(([x,y],i) => (
        <circle key={`g${i}`} cx={x} cy={y} r="8" fill={color} opacity="0.078" filter="url(#dy1)"/>
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
      <path d="M155 50 L245 50 L210 145 L200 150 L190 145 L155 50Z" fill="none" stroke={color} strokeWidth="0.81" opacity="0.39"/>
      <path d="M155 250 L245 250 L210 155 L200 150 L190 155 L155 250Z" fill="none" stroke={color} strokeWidth="0.81" opacity="0.39"/>
      {/* Sand in upper chamber */}
      {[...Array(18)].map((_,i) => (
        <circle key={`u${i}`} cx={170+Math.random()*60} cy={60+Math.random()*60} r={0.5+Math.random()*1.2} fill={color} opacity={0.208+Math.random()*0.156}/>
      ))}
      {/* Falling stream */}
      {[...Array(6)].map((_,i) => (
        <circle key={`f${i}`} cx={200+Math.sin(i)*2} cy={148+i*3} r={0.4+Math.random()*0.6} fill={color} opacity={0.39+i*0.052}/>
      ))}
      {/* Sand in lower chamber — partial */}
      {[...Array(12)].map((_,i) => (
        <circle key={`l${i}`} cx={175+Math.random()*50} cy={210+Math.random()*30} r={0.5+Math.random()*1} fill={color} opacity={0.156+Math.random()*0.13}/>
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
      <line x1="130" y1="190" x2="270" y2="190" stroke={color} strokeWidth="2.025" opacity="0.728"/>
      <line x1="135" y1="195" x2="265" y2="195" stroke={color} strokeWidth="1.08" opacity="0.364"/>
      <line x1="140" y1="199" x2="260" y2="199" stroke={color} strokeWidth="0.54" opacity="0.208"/>
      {/* Smoke wisps — curved fading paths rising from the altar */}
      <path d="M190 185 Q184 162 190 140 Q198 118 188 95 Q180 75 186 55" stroke={color} strokeWidth="1.08" fill="none" opacity="0.364"/>
      <path d="M200 185 Q195 158 202 132 Q210 108 200 85 Q192 65 198 42" stroke={color} strokeWidth="0.945" fill="none" opacity="0.312"/>
      <path d="M210 185 Q216 160 210 138 Q202 118 212 95 Q220 78 214 58" stroke={color} strokeWidth="0.81" fill="none" opacity="0.26"/>
      <path d="M205 185 Q212 165 206 148 Q198 132 206 112 Q214 95 208 75" stroke={color} strokeWidth="0.54" fill="none" opacity="0.182" strokeDasharray="3 6"/>
      {/* Smoke glow at tips */}
      <circle cx="186" cy="55" r="6" fill={color} opacity="0.078" filter="url(#sa1)"/>
      <circle cx="198" cy="42" r="5" fill={color} opacity="0.065" filter="url(#sa1)"/>
      {/* Faint vertical columns/walls around the altar */}
      <line x1="150" y1="190" x2="145" y2="35" stroke={color} strokeWidth="0.54" opacity="0.208"/>
      <line x1="250" y1="190" x2="255" y2="35" stroke={color} strokeWidth="0.54" opacity="0.208"/>
      <line x1="130" y1="190" x2="122" y2="45" stroke={color} strokeWidth="0.3375" opacity="0.13" strokeDasharray="3 8"/>
      <line x1="270" y1="190" x2="278" y2="45" stroke={color} strokeWidth="0.3375" opacity="0.13" strokeDasharray="3 8"/>
      {/* Top arch suggestion between columns */}
      <path d="M145 35 Q200 15 255 35" stroke={color} strokeWidth="0.405" fill="none" opacity="0.156"/>
    </svg>
  );
}

/* 37. The God After God — Ruined temple with light pouring through */
function TheGodAfterGod({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="gg-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* pediment + columns, dissolving upward */}
      <path d="M120 118 L200 66 L280 118" fill="none" stroke={color} strokeWidth="1.4" opacity="0.35" strokeDasharray="8 10"/>
      {[...Array(5)].map((_,i) => (
        <line key={i} x1={136+i*32} y1={124} x2={136+i*32} y2={196} stroke={color} strokeWidth="1.3" opacity={0.32-i*0.03} strokeDasharray="10 7"/>
      ))}
      {/* fragments rising away like ash */}
      {[...Array(8)].map((_,i) => (
        <rect key={i} x={150+i*14} y={92-i*8} width={2.4} height={2.4} fill={color} opacity={0.4-i*0.04} transform={`rotate(${i*22} ${151+i*14} ${93-i*8})`}/>
      ))}
      {/* THE FOUNDATION — unbroken, bright, warm */}
      <path d="M104 208 L296 208" stroke={color} strokeWidth="2.6" opacity="0.9"/>
      <path d="M112 220 L288 220" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      <ellipse cx="200" cy="212" rx="86" ry="14" fill={color} opacity="0.1" filter="url(#gg-g)"/>
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
          <stop offset="0%" stopColor={color} stopOpacity="0.182"/>
          <stop offset="50%" stopColor={color} stopOpacity="0.052"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Subtle radial gradient field */}
      <circle cx="200" cy="150" r="100" fill="url(#rh3)"/>
      {/* Center pulse — brighter and larger */}
      <circle cx="200" cy="150" r="4" fill={color} opacity="0.9"/>
      <circle cx="200" cy="150" r="8" fill={color} opacity="0.26" filter="url(#rh1)"/>
      <circle cx="200" cy="150" r="16" fill={color} opacity="0.104" filter="url(#rh2)"/>
      {/* Three ripples expanding outward */}
      <circle cx="200" cy="150" r="35" fill="none" stroke={color} strokeWidth="1.62" opacity="0.468"/>
      <circle cx="200" cy="150" r="65" fill="none" stroke={color} strokeWidth="0.945" opacity="0.26"/>
      <circle cx="200" cy="150" r="100" fill="none" stroke={color} strokeWidth="0.54" opacity="0.156"/>
      {/* Floating mote particles — present-moment awareness */}
      {[[178,128,1.0],[225,135,0.8],[185,172,0.9],[218,168,0.7],[195,118,0.6],[210,178,0.8],[170,148,0.7],[232,152,0.6]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.208+i*0.013}/>
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
      <path d="M140 280 Q138 220 142 160 Q148 100 165 60 Q180 35 200 25" stroke={color} strokeWidth="1.35" fill="none" opacity="0.52"/>
      <path d="M260 280 Q262 220 258 160 Q252 100 235 60 Q220 35 200 25" stroke={color} strokeWidth="1.35" fill="none" opacity="0.52"/>
      {/* Branches meeting — forming arch */}
      <path d="M142 160 Q155 140 175 130" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
      <path d="M258 160 Q245 140 225 130" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
      <path d="M148 120 Q170 100 190 95" stroke={color} strokeWidth="0.54" fill="none" opacity="0.26"/>
      <path d="M252 120 Q230 100 210 95" stroke={color} strokeWidth="0.54" fill="none" opacity="0.26"/>
      {/* Light through canopy */}
      {[[200,25],[185,95],[215,95],[175,130],[225,130]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={2+i*0.5} fill={color} opacity={0.26-i*0.039} filter="url(#cw1)"/>
      ))}
    </svg>
  );
}

/* 40. The Problem of Evil — Light creating shadows */
function TheProblemOfEvil({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="pv-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the dark heart of the question */}
      <circle cx="204" cy="148" r="17" fill={color} opacity="0.65"/>
      <circle cx="204" cy="148" r="26" fill="none" stroke={color} strokeWidth="1" opacity="0.35"/>
      <ellipse cx="204" cy="148" rx="46" ry="40" fill={color} opacity="0.1" filter="url(#pv-g)"/>
      {/* the rays — ordered, radiant */}
      {[...Array(12)].map((_,i) => {
        const a = i * Math.PI / 6;
        if (i === 2) return null;
        return <line key={i} x1={204+Math.cos(a)*34} y1={148+Math.sin(a)*34} x2={204+Math.cos(a)*(88+(i%3)*16)} y2={148+Math.sin(a)*(88+(i%3)*16)} stroke={color} strokeWidth={i%2 ? 1 : 1.5} opacity={0.5-(i%3)*0.1}/>;
      })}
      {/* the broken ray — bends and falls */}
      <path d="M233 131 L262 114 L258 96 L282 82" fill="none" stroke={color} strokeWidth="1.8" opacity="0.85"/>
      <circle cx="284" cy="80" r="2" fill={color} opacity="0.8"/>
    </svg>
  );
}

/* 41. Is This All There Is? — Horizon with something beyond */
function IsThisAllThereIs({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="ia-l" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
        <filter id="ia-g"><feGaussianBlur stdDeviation="7"/></filter>
      </defs>
      {/* the veil — two curtains of the ordinary */}
      <path d="M60 48 Q80 120 64 190 Q56 232 66 262" fill="none" stroke={color} strokeWidth="1.2" opacity="0.3"/>
      <path d="M96 44 Q118 130 100 210 Q94 240 102 264" fill="none" stroke={color} strokeWidth="1.4" opacity="0.38"/>
      <path d="M136 42 Q158 128 142 214 Q136 244 144 266" fill="none" stroke={color} strokeWidth="1.6" opacity="0.45"/>
      <path d="M340 48 Q322 122 336 194 Q344 234 336 262" fill="none" stroke={color} strokeWidth="1.2" opacity="0.3"/>
      <path d="M306 44 Q286 132 302 212 Q308 242 300 264" fill="none" stroke={color} strokeWidth="1.4" opacity="0.38"/>
      <path d="M268 42 Q248 130 264 216 Q270 246 262 266" fill="none" stroke={color} strokeWidth="1.6" opacity="0.45"/>
      {/* the seam where the world grew thin */}
      <polygon points="196,40 212,40 224,270 186,270" fill="url(#ia-l)"/>
      <line x1="203" y1="40" x2="204" y2="270" stroke={color} strokeWidth="2" opacity="0.85"/>
      <ellipse cx="204" cy="120" rx="30" ry="80" fill={color} opacity="0.12" filter="url(#ia-g)"/>
      {/* motes drifting through */}
      {[...Array(6)].map((_,i) => (
        <circle key={i} cx={204+Math.sin(i*2.1)*26} cy={70+i*32} r={1.3} fill={color} opacity={0.6-i*0.07}/>
      ))}
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
      <path d="M180 130 Q190 120 200 128 Q210 138 205 148 Q198 158 188 152 Q178 144 185 135 Q192 126 202 132" stroke={color} strokeWidth="1.35" fill="none" opacity="0.65"/>
      <path d="M195 125 Q210 122 215 135 Q218 150 208 158 Q195 165 185 158 Q175 148 182 138" stroke={color} strokeWidth="0.945" fill="none" opacity="0.468"/>
      {/* Loosening strands */}
      <path d="M180 130 Q165 118 150 115" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
      <path d="M208 158 Q225 170 240 172" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
      <path d="M215 135 Q232 128 248 130" stroke={color} strokeWidth="0.54" fill="none" opacity="0.26"/>
      {/* Air/space openings in knot */}
      <circle cx="195" cy="142" r="3" fill="none" stroke={color} strokeWidth="0.27" opacity="0.208"/>
    </svg>
  );
}

/* 43. The Letting Go — Tender opening hand */
function TheLettingGo({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="lg1"><feGaussianBlur stdDeviation="3"/></filter></defs>
      {/* Curved clenching-then-opening lines */}
      <path d="M175 185 Q165 160 170 140 Q178 125 185 115" stroke={color} strokeWidth="0.945" fill="none" opacity="0.468"/>
      <path d="M190 188 Q182 165 185 148 Q190 135 195 125" stroke={color} strokeWidth="0.81" fill="none" opacity="0.39"/>
      <path d="M210 188 Q218 165 215 148 Q210 135 205 125" stroke={color} strokeWidth="0.81" fill="none" opacity="0.39"/>
      <path d="M225 185 Q235 160 230 140 Q222 125 215 115" stroke={color} strokeWidth="0.945" fill="none" opacity="0.468"/>
      {/* Released bright cluster drifting up */}
      {[...Array(8)].map((_,i) => (
        <circle key={i} cx={192+Math.sin(i*1.8)*12} cy={100-i*6} r={0.8+Math.random()*1.5} fill={color} opacity={0.312+i*0.026} filter={i<3?"url(#lg1)":""}/>
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
      <circle cx="200" cy="150" r="18" fill={color} opacity="0.156" filter="url(#aw1)"/>
      {/* Dense radiating cracks — contained */}
      {[...Array(14)].map((_,i) => {
        const a=(i/14)*Math.PI*2;
        const len=25+Math.random()*20;
        return <line key={i} x1={200+Math.cos(a)*8} y1={150+Math.sin(a)*8} x2={200+Math.cos(a)*len} y2={150+Math.sin(a)*len*0.75} stroke={color} strokeWidth={0.4+Math.random()*0.4} opacity={0.26+Math.random()*0.208}/>;
      })}
      {/* One arrow-like form — direction */}
      <path d="M200 150 L285 105 L280 112 M285 105 L278 102" stroke={color} strokeWidth="1.08" fill="none" opacity="0.52"/>
    </svg>
  );
}

/* 45. The Fear You Feed — Tiny seed, massive shadow */
function TheFearYouFeed({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="fy-s" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.04"/>
        </linearGradient>
        <filter id="fy-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the door, ajar */}
      <path d="M138 76 L138 220 L186 208 L186 88 Z" fill="none" stroke={color} strokeWidth="1.8" opacity="0.7"/>
      <path d="M130 76 L130 222" stroke={color} strokeWidth="1.2" opacity="0.4"/>
      <circle cx="178" cy="150" r="2.4" fill={color} opacity="0.7"/>
      {/* light through the gap */}
      <path d="M186 92 L196 88 L196 206 L186 206 Z" fill={color} opacity="0.16"/>
      {/* the shadow — narrow at the door, wide where it is fed */}
      <polygon points="196,150 336,108 352,196 196,168" fill="url(#fy-s)"/>
      <path d="M196 150 L336 108 M196 168 L352 196" stroke={color} strokeWidth="0.9" opacity="0.3"/>
      <ellipse cx="300" cy="152" rx="56" ry="34" fill={color} opacity="0.07" filter="url(#fy-g)"/>
      {/* the crumbs, dropped one by one */}
      {[...Array(6)].map((_,i) => (
        <circle key={i} cx={216+i*22} cy={182-i*4} r={1.8-i*0.12} fill={color} opacity={0.75-i*0.09}/>
      ))}
    </svg>
  );
}

/* 46. Raising the Next One — Cupped protective space, growth within */
function RaisingTheNextOne({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Protective curves — shelter without closure */}
      <path d="M130 240 Q120 170 140 110 Q165 65 200 50" stroke={color} strokeWidth="1.215" fill="none" opacity="0.52"/>
      <path d="M270 240 Q280 170 260 110 Q235 65 200 50" stroke={color} strokeWidth="1.215" fill="none" opacity="0.52"/>
      {/* Growing form — organic, upward, seeking its own shape */}
      <path d="M200 230 Q198 200 200 170 Q204 140 200 115 Q196 95 200 75" stroke={color} strokeWidth="0.945" fill="none" opacity="0.468"/>
      {/* Small leaves/branches — finding its own direction */}
      <path d="M200 170 Q212 162 218 165" stroke={color} strokeWidth="0.54" fill="none" opacity="0.312"/>
      <path d="M200 135 Q188 128 182 132" stroke={color} strokeWidth="0.4725" fill="none" opacity="0.26"/>
      <path d="M200 100 Q210 92 215 96" stroke={color} strokeWidth="0.405" fill="none" opacity="0.26"/>
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
      <path d="M180 40 Q170 70 172 110 Q175 160 170 200 Q168 240 175 275" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
      <path d="M220 40 Q230 70 228 110 Q225 160 230 200 Q232 240 225 275" stroke={color} strokeWidth="0.675" fill="none" opacity="0.312"/>
      {/* Internal meridians */}
      <path d="M195 50 Q190 90 195 130 Q200 170 195 210 Q190 250 195 280" stroke={color} strokeWidth="0.405" fill="none" opacity="0.208"/>
      <path d="M205 50 Q210 90 205 130 Q200 170 205 210 Q210 250 205 280" stroke={color} strokeWidth="0.405" fill="none" opacity="0.208"/>
      {/* Wound nodes — glowing bright */}
      {[[195,85],[210,140],[188,195],[205,250]].map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={5} fill={color} opacity="0.156" filter="url(#iw1)"/>
          <circle cx={x} cy={y} r={2} fill={color} opacity="0.468"/>
          {/* Signal branches from wounds */}
          <path d={`M${x} ${y} Q${x+15} ${y-8} ${x+25} ${y-5}`} stroke={color} strokeWidth="0.405" fill="none" opacity="0.26"/>
          <path d={`M${x} ${y} Q${x-12} ${y+8} ${x-22} ${y+5}`} stroke={color} strokeWidth="0.405" fill="none" opacity="0.26"/>
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
        return <rect key={i} x={200-w/2+i*3} y={150-h/2+i*2} width={w} height={h} fill="none" stroke={color} strokeWidth={0.4-i*0.04} opacity={0.39-i*0.0468} rx="2"/>;
      })}
      {/* Distortion in deeper reflections */}
      <path d="M195 148 Q200 142 205 148" stroke={color} strokeWidth="0.405" fill="none" opacity="0.156"/>
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
      <defs>
        <filter id="ge-g"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      {/* rigid traces, right angles, vias */}
      <path d="M40 90 L120 90 L120 130 L176 130" fill="none" stroke={color} strokeWidth="1.4" opacity="0.5"/>
      <path d="M40 160 L96 160 L96 196 L176 196" fill="none" stroke={color} strokeWidth="1.4" opacity="0.5"/>
      <path d="M40 226 L140 226 L140 164 L176 164" fill="none" stroke={color} strokeWidth="1.2" opacity="0.38"/>
      <circle cx="120" cy="90" r="2.6" fill={color} opacity="0.6"/>
      <circle cx="96" cy="160" r="2.6" fill={color} opacity="0.6"/>
      <circle cx="140" cy="226" r="2.6" fill={color} opacity="0.6"/>
      {/* the crossing: traces braid into one line */}
      <path d="M176 130 Q210 130 226 148 Q244 168 262 162" fill="none" stroke={color} strokeWidth="1.6" opacity="0.65"/>
      <path d="M176 164 Q206 164 226 156" fill="none" stroke={color} strokeWidth="1.4" opacity="0.5"/>
      <path d="M176 196 Q214 196 232 172" fill="none" stroke={color} strokeWidth="1.4" opacity="0.5"/>
      {/* the breath — one organic wave, alive */}
      <path d="M262 162 Q282 132 300 158 Q316 182 334 150 Q348 126 364 142" fill="none" stroke={color} strokeWidth="2.2" opacity="0.9"/>
      <circle cx="300" cy="158" r="26" fill={color} opacity="0.09" filter="url(#ge-g)"/>
      {/* a heartbeat blip escaping upward */}
      <path d="M318 108 L324 96 L330 116 L336 84" fill="none" stroke={color} strokeWidth="1" opacity="0.35"/>
    </svg>
  );
}

/* 50. The Vessel and the Flame — Cracked vessel, light through cracks */
function TheVesselAndTheFlame({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><filter id="vf1"><feGaussianBlur stdDeviation="2"/></filter></defs>
      {/* Vessel outline */}
      <path d="M165 60 Q155 100 158 150 Q162 200 168 240 Q175 260 200 268 Q225 260 232 240 Q238 200 242 150 Q245 100 235 60" stroke={color} strokeWidth="1.08" fill="none" opacity="0.468"/>
      {/* Cracks with light */}
      {[[178,90,20,15],[225,120,-18,20],[170,160,22,12],[230,190,-20,18],[185,220,18,8]].map(([x,y,dx,dy],i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x+dx} y2={y+dy} stroke={color} strokeWidth="1.35" opacity="0.78" filter="url(#vf1)"/>
          <line x1={x} y1={y} x2={x+dx} y2={y+dy} stroke={color} strokeWidth="0.54" opacity="0.9"/>
        </g>
      ))}
      {/* Inner glow from within */}
      <ellipse cx="200" cy="160" rx="25" ry="50" fill={color} opacity="0.078"/>
    </svg>
  );
}

/* 51. When Words Aren't Enough — Dissolving text into pure form */
function WhenWordsArentEnough({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="wa-g"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      {/* the sentence being written */}
      {[...Array(7)].map((_,i) => (
        <line key={i} x1={52+i*24} y1={218} x2={68+i*24} y2={218} stroke={color} strokeWidth="1.8" opacity={0.7-i*0.07}/>
      ))}
      {/* dashes loosening, lifting */}
      <line x1="226" y1="212" x2="240" y2="208" stroke={color} strokeWidth="1.6" opacity="0.5" transform="rotate(-8 233 210)"/>
      <line x1="252" y1="200" x2="264" y2="194" stroke={color} strokeWidth="1.5" opacity="0.48" transform="rotate(-16 258 197)"/>
      <line x1="274" y1="184" x2="284" y2="176" stroke={color} strokeWidth="1.4" opacity="0.45" transform="rotate(-24 279 180)"/>
      {/* becoming birds */}
      <path d="M296 158 q7 -9 14 0 M303 158 q7 -9 14 0" stroke={color} strokeWidth="1.6" fill="none" opacity="0.75"/>
      <path d="M318 128 q6 -8 12 0 M324 128 q6 -8 12 0" stroke={color} strokeWidth="1.5" fill="none" opacity="0.65"/>
      <path d="M336 100 q5 -7 11 0 M341 100 q5 -7 11 0" stroke={color} strokeWidth="1.3" fill="none" opacity="0.55"/>
      <path d="M300 92 q5 -7 10 0 M305 92 q5 -7 10 0" stroke={color} strokeWidth="1.1" fill="none" opacity="0.4"/>
      <circle cx="318" cy="126" r="26" fill={color} opacity="0.09" filter="url(#wa-g)"/>
      {/* the unsayable above — open sky, one thin horizon */}
      <line x1="40" y1="64" x2="200" y2="64" stroke={color} strokeWidth="0.6" opacity="0.14"/>
    </svg>
  );
}

/* 52. The Discipline of Seeing — Eye becoming landscape of detail */
function TheDisciplineOfSeeing({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {/* Eye shape */}
      <path d="M120 150 Q160 100 200 95 Q240 100 280 150 Q240 200 200 205 Q160 200 120 150Z" fill="none" stroke={color} strokeWidth="0.945" opacity="0.468"/>
      {/* Iris/pupil opening into depth */}
      <circle cx="200" cy="150" r="22" fill="none" stroke={color} strokeWidth="0.675" opacity="0.39"/>
      <circle cx="200" cy="150" r="10" fill={color} opacity="0.104"/>
      {/* Detail points radiating from eye — attention as creation */}
      {[...Array(10)].map((_,i) => {
        const a = (i/10)*Math.PI*2;
        const d = 80+i*8;
        const x = 200+Math.cos(a)*d;
        const y = 150+Math.sin(a)*d*0.6;
        return <g key={i}>
          <line x1={200+Math.cos(a)*28} y1={150+Math.sin(a)*28} x2={x} y2={y} stroke={color} strokeWidth="0.2025" opacity="0.156"/>
          <circle cx={x} cy={y} r={1+Math.random()*1.5} fill={color} opacity={0.208+Math.random()*0.156}/>
        </g>;
      })}
    </svg>
  );
}

/* 53. The Freedom of Less — Dense left, refined right */
function TheFreedomOfLess({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="fl-g"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      {/* scribble chaos outside the frame */}
      <path d="M36 70 Q64 44 84 76 Q52 84 70 108 Q92 96 84 128" fill="none" stroke={color} strokeWidth="0.8" opacity="0.22"/>
      <path d="M330 220 Q356 200 348 236 Q372 224 362 252" fill="none" stroke={color} strokeWidth="0.8" opacity="0.22"/>
      <path d="M60 210 Q44 226 66 238 Q48 248 72 258" fill="none" stroke={color} strokeWidth="0.7" opacity="0.18"/>
      <path d="M320 60 Q344 48 338 78 Q360 66 352 92" fill="none" stroke={color} strokeWidth="0.7" opacity="0.18"/>
      {/* the chosen frame — double keyline */}
      <rect x="132" y="82" width="150" height="140" fill="none" stroke={color} strokeWidth="2" opacity="0.75"/>
      <rect x="140" y="90" width="134" height="124" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3"/>
      <rect x="132" y="82" width="150" height="140" fill={color} opacity="0.05"/>
      {/* inside: one perfect line */}
      <path d="M152 172 Q190 128 224 158 Q248 178 262 130" fill="none" stroke={color} strokeWidth="2.2" opacity="0.9"/>
      <circle cx="262" cy="130" r="16" fill={color} opacity="0.13" filter="url(#fl-g)"/>
    </svg>
  );
}

/* 54. The Serious Work of Play — Spiraling joyful marks forming structure */
function TheSeriousWorkOfPlay({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="sp-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the keyboard */}
      <rect x="96" y="176" width="220" height="42" rx="2" fill="none" stroke={color} strokeWidth="1.6" opacity="0.6"/>
      {[...Array(10)].map((_,i) => (
        <line key={i} x1={118+i*20} y1={176} x2={118+i*20} y2={218} stroke={color} strokeWidth="0.9" opacity="0.4"/>
      ))}
      {[...Array(7)].map((_,i) => (
        <rect key={i} x={110+i*20+(i>2?20:0)+(i>5?20:0)} y={176} width={9} height={24} fill={color} opacity="0.5"/>
      ))}
      {/* two keys pressed — the wrong ones, glowing */}
      <rect x="158" y="176" width="18" height="42" fill={color} opacity="0.18"/>
      <rect x="238" y="176" width="18" height="42" fill={color} opacity="0.18"/>
      {/* notes lifting away, tumbling */}
      <g opacity="0.85">
        <circle cx="188" cy="140" r="4.6" fill={color}/>
        <path d="M192 139 L192 116 Q198 112 204 116" fill="none" stroke={color} strokeWidth="1.4"/>
      </g>
      <g opacity="0.65" transform="rotate(-14 254 112)">
        <circle cx="250" cy="114" r="4" fill={color}/>
        <path d="M254 113 L254 92" stroke={color} strokeWidth="1.3"/>
      </g>
      <g opacity="0.45" transform="rotate(12 300 88)">
        <circle cx="296" cy="90" r="3.4" fill={color}/>
        <path d="M299 89 L299 72" stroke={color} strokeWidth="1.1"/>
      </g>
      <circle cx="228" cy="118" r="34" fill={color} opacity="0.09" filter="url(#sp-g)"/>
    </svg>
  );
}

/* 55. The Mind That Won't Be Quiet — Overlapping thought circles, crowding */
function TheMindThatWontBeQuiet({ color }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <filter id="mq-g"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      {/* the profile — one calm line, crown open */}
      <path d="M150 224 Q146 196 152 176 Q142 174 146 166 Q150 160 148 152 Q146 122 170 106 Q186 96 204 98" fill="none" stroke={color} strokeWidth="2" opacity="0.75"/>
      <path d="M150 224 Q168 214 184 216" fill="none" stroke={color} strokeWidth="1.4" opacity="0.5"/>
      {/* the thought-line: leaves the crown, builds looping towers */}
      <path d="M204 98 Q226 88 234 104 Q242 120 258 110 Q276 98 270 82 Q264 68 282 66 Q300 64 296 82 Q292 98 310 94 Q328 90 324 72" fill="none" stroke={color} strokeWidth="1.7" opacity="0.85"/>
      <path d="M234 104 Q230 126 248 132 Q268 138 262 152" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5"/>
      <path d="M296 82 Q312 110 336 104" fill="none" stroke={color} strokeWidth="1" opacity="0.4"/>
      <ellipse cx="278" cy="94" rx="64" ry="36" fill={color} opacity="0.09" filter="url(#mq-g)"/>
      {/* three lines of ink that started it all */}
      <path d="M236 176 L316 176 M236 188 L302 188 M236 200 L322 200" stroke={color} strokeWidth="1" opacity="0.3"/>
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
