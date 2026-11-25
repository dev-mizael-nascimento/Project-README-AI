'use client';

import { useEffect, useRef } from 'react';

type EdgeGlowBoxProps = {
  children: React.ReactNode;
  accent?: string;
  inset?: number;
  radius?: number;
  paused?: boolean;
  className?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Rounded container with a slow travelling edge-glow light along its border,
 * adapted from the fx-prompt / edge-glow specification.
 */
export function EdgeGlowBox({
  children,
  accent = '#FF6D29',
  inset = 18,
  radius = 22,
  paused = false,
  className = '',
}: EdgeGlowBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [r, g, b] = hexToRgb(accent);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 1;
    let h = 1;
    let dpr = 1;
    let progress = 0.15;

    function roundedRectPoint(t: number, rx: number, ry: number, rw: number, rh: number, rad: number) {
      const rr = Math.min(rad, rw / 2, rh / 2);
      const straightW = Math.max(0, rw - 2 * rr);
      const straightH = Math.max(0, rh - 2 * rr);
      const cornerLen = (Math.PI * rr) / 2;
      const total = 2 * straightW + 2 * straightH + 4 * cornerLen;
      let d = (((t % 1) + 1) % 1) * total;

      if (d < straightW) return [rx + rr + d, ry];
      d -= straightW;
      if (d < cornerLen) {
        const a = -Math.PI / 2 + (d / cornerLen) * (Math.PI / 2);
        return [rx + rw - rr + Math.cos(a) * rr, ry + rr + Math.sin(a) * rr];
      }
      d -= cornerLen;
      if (d < straightH) return [rx + rw, ry + rr + d];
      d -= straightH;
      if (d < cornerLen) {
        const a = (d / cornerLen) * (Math.PI / 2);
        return [rx + rw - rr + Math.cos(a) * rr, ry + rh - rr + Math.sin(a) * rr];
      }
      d -= cornerLen;
      if (d < straightW) return [rx + rw - rr - d, ry + rh];
      d -= straightW;
      if (d < cornerLen) {
        const a = Math.PI / 2 + (d / cornerLen) * (Math.PI / 2);
        return [rx + rr + Math.cos(a) * rr, ry + rh - rr + Math.sin(a) * rr];
      }
      d -= cornerLen;
      if (d < straightH) return [rx, ry + rh - rr - d];
      d -= straightH;
      const a = Math.PI + (d / cornerLen) * (Math.PI / 2);
      return [rx + rr + Math.cos(a) * rr, ry + rr + Math.sin(a) * rr];
    }

    function fit() {
      if (!box || !canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, box.clientWidth);
      h = Math.max(1, box.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    function drawFrame() {
      if (!ctx || !canvas) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rx = inset;
      const ry = inset;
      const rw = Math.max(2, w - inset * 2);
      const rh = Math.max(2, h - inset * 2);
      const rr = Math.min(radius, rw / 2, rh / 2);

      // Subtle idle border
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, rr);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Travelling light segment (~38% of perimeter)
      const steps = 44;
      const segment = 0.36;
      for (let i = 0; i < steps; i++) {
        const k0 = i / steps;
        const k1 = (i + 1) / steps;
        const t0 = progress - (1 - k0) * segment;
        const t1 = progress - (1 - k1) * segment;
        const [x0, y0] = roundedRectPoint(t0, rx, ry, rw, rh, rr);
        const [x1, y1] = roundedRectPoint(t1, rx, ry, rw, rh, rr);
        const alpha = Math.pow(k1, 2.2);

        // Outer bloom
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.28).toFixed(3)})`;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Crisp core border light
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = `rgba(255,210,185,${(alpha * 0.9).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    fit();
    drawFrame();

    let raf = 0;
    let last = performance.now();
    const lapSeconds = 12;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused && !reducedMotion) {
        progress = (progress + dt / lapSeconds) % 1;
      }
      drawFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(fit);
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [accent, inset, paused, radius]);

  return (
    <div
      ref={boxRef}
      style={{ padding: `${inset}px`, margin: `-${inset}px` }}
      className={`relative isolate ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      />
      <div
        style={{ borderRadius: `${radius}px` }}
        className="border border-white/10 bg-[#453027]/30 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        {children}
      </div>
    </div>
  );
}
