import { FC, useEffect, useRef, useState } from 'react';
import { getCachedPerformanceTier } from '../utils/performanceDetector';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  life: number;
  opacity: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  pulse: number;
  twinkleSpeed: number;
}

interface GoldenStar extends Star {
  sparkleChance: number;
  sparklePhase: number;
}

interface MousePosition {
  x: number;
  y: number;
}

// Star count limits by performance tier
const STAR_LIMITS = {
  high: 120,
  medium: 60,
  low: 30
} as const;

const ParticleEffect: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const goldenStarsRef = useRef<GoldenStar[]>([]);
  const mouseRef = useRef<MousePosition>({ x: 0, y: 0 });
  const lastMouseMoveRef = useRef<number>(0);

  // Safari detection
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMobileSafari = isSafari && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Respect prefers-reduced-motion (reactive to OS setting changes)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return; // Skip all animation for reduced motion

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Add performance hints for better GPU usage.
    // NOTE: `desynchronized: true` triggers an Android Chrome bug where the
    // canvas backing store flashes opaque black during resize (e.g. when the
    // soft keyboard dismisses on form submit). Disabled to keep Android safe.
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false // Hint that we won't read pixels back
    });

    if (!ctx) return;

    // Additional performance settings
    ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering, better performance

    // Performance tier — reduce star count on low-end devices
    const tier = getCachedPerformanceTier();
    const maxStars = STAR_LIMITS[tier];

    let animationFrameId: number;
    let isVisible = !document.hidden; // Track tab visibility
    let frameCount = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    // Initialize white and golden stars
    const initStars = () => {
      starsRef.current = [];
      goldenStarsRef.current = [];
      
      // Calculate total stars based on screen size, capped by performance tier
      const totalStars = Math.min(Math.floor((canvas.width * canvas.height) / 15000), maxStars);
      
      // Avoid placing stars in bottom 25% of screen (where mountains are)
      const safeHeight = canvas.height * 0.75;
      
      // Create white stars (60% of total)
      for (let i = 0; i < totalStars * 0.6; i++) {
        starsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * safeHeight, // Only in top 75% of screen
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.7 + 0.3,
          pulse: Math.random() * 0.1,
          twinkleSpeed: 0.0004 + Math.random() * 0.0008 // Much slower twinkle
        });
      }
      
      // Create golden stars (40% of total)
      for (let i = 0; i < totalStars * 0.4; i++) {
        goldenStarsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * safeHeight, // Only in top 75% of screen
          size: Math.random() * 1.7 + 0.6, // Slightly larger
          opacity: Math.random() * 0.7 + 0.3,
          pulse: Math.random() * 0.1,
          twinkleSpeed: 0.0006 + Math.random() * 0.001, // Slower twinkle but still slightly faster than white
          sparkleChance: Math.random() * 0.015 + 0.005, // Reduced sparkle frequency
          sparklePhase: Math.random() * Math.PI * 2
        });
      }
    };

    const createParticle = (x: number, y: number): Particle => ({
      x,
      y,
      size: Math.random() * 1.5 + 0.3,
      color: `hsl(43, ${70 + Math.random() * 25}%, ${55 + Math.random() * 25}%)`,
      speedX: Math.random() * 2 - 1,
      speedY: Math.random() * 2 - 1,
      life: 120 + Math.random() * 80,
      opacity: 0.5 + Math.random() * 0.3,
    });

    const updateParticles = () => {
      particlesRef.current.forEach((particle) => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Attraction to mouse
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 100) {
          particle.speedX += dx / distance * 0.05;
          particle.speedY += dy / distance * 0.05;
        }

        // Apply some randomness
        particle.speedX += (Math.random() - 0.5) * 0.1;
        particle.speedY += (Math.random() - 0.5) * 0.1;

        // Reduce opacity for trail effect
        particle.opacity *= 0.99;
        particle.life -= 1;
      });
      // Remove dead particles after iteration to avoid mutating array during forEach
      particlesRef.current = particlesRef.current.filter(
        p => p.life > 0 && p.opacity >= 0.01
      );
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw white stars
      const time = Date.now();
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.pulse) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.fill();
      });
      
      // Draw golden stars with special effects
      goldenStarsRef.current.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.pulse) * 0.4 + 0.6;
        
        // Draw the glowing star core
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${star.opacity * twinkle})`;
        ctx.fill();
        
        // Add subtle glow with gradient
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 3 * twinkle
        );
        gradient.addColorStop(0, `rgba(255, 215, 0, ${star.opacity * twinkle})`);
        gradient.addColorStop(0.5, `rgba(255, 180, 0, ${star.opacity * twinkle * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3 * twinkle, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Random sparkle effect (occasional)
        if (Math.random() < star.sparkleChance) {
          const sparkleSize = star.size * 2.5;
          ctx.beginPath();
          
          // Draw 4-point star shape
          ctx.moveTo(star.x - sparkleSize, star.y);
          ctx.lineTo(star.x + sparkleSize, star.y);
          ctx.moveTo(star.x, star.y - sparkleSize);
          ctx.lineTo(star.x, star.y + sparkleSize);
          
          // Add diagonal rays for extra sparkle
          const diagonalSize = sparkleSize * 0.7;
          ctx.moveTo(star.x - diagonalSize, star.y - diagonalSize);
          ctx.lineTo(star.x + diagonalSize, star.y + diagonalSize);
          ctx.moveTo(star.x - diagonalSize, star.y + diagonalSize);
          ctx.lineTo(star.x + diagonalSize, star.y - diagonalSize);
          
          ctx.strokeStyle = `rgba(255, 230, 150, ${star.opacity * 0.7})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
      
      // Draw mouse trail particles
      particlesRef.current.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        // Convert HSL to HSLA with opacity instead of using globalAlpha
        const hslaColor = particle.color.replace('hsl', 'hsla').replace(')', `, ${particle.opacity})`);
        ctx.fillStyle = hslaColor;
        ctx.fill();
      });
    };

    const animate = () => {
      if (!isVisible) return; // Don't loop when tab is hidden
      updateParticles();
      drawParticles();
      animationFrameId = requestAnimationFrame(animate);
    };

    // Pause/resume when tab visibility changes (saves battery)
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        // Resume the loop
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Stop the loop — no frames drawn while hidden
        cancelAnimationFrame(animationFrameId);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Skip mouse particles for Safari due to performance issues
      if (isSafari) return;

      // Throttle mouse move events for performance
      const now = Date.now();
      if (now - lastMouseMoveRef.current < 16) return; // ~60fps throttle
      lastMouseMoveRef.current = now;

      mouseRef.current = { x: event.clientX, y: event.clientY };

      // Create particles on mouse move
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push(createParticle(event.clientX, event.clientY));
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, [prefersReducedMotion]);

  // Don't render canvas at all when reduced motion is preferred
  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        // Stars are a background layer — must sit behind login UI, figures,
        // and the Paradiso rose (z-index 50). Was z-index 1000, which on
        // Android Chrome let a transient canvas glitch cover the whole screen
        // black during the post-login resize.
        zIndex: 1,
        // GPU acceleration (canvas already composites efficiently)
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }} 
    />
  );
};

export default ParticleEffect;