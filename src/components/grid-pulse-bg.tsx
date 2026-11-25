'use client';

import { useEffect, useRef } from 'react';

type GridPulseBgProps = {
  bg?: string;
  ink?: string;
  accent?: string;
  cell?: number;
  lineOpacity?: number;
  pulses?: number;
  tail?: number;
  speed?: number;
  turnChance?: number;
  glow?: number;
  trace?: number;
  calm?: number;
  calmX?: number;
  calmY?: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(4)})`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function radialSprite(rgb: [number, number, number], a: number) {
  const sp = document.createElement('canvas');
  sp.width = sp.height = 64;
  const s = sp.getContext('2d');
  if (!s) return sp;
  const rg = s.createRadialGradient(32, 32, 0, 32, 32, 32);
  const stops: [number, number][] = [
    [0, 1],
    [0.25, 0.45],
    [0.6, 0.1],
    [1, 0],
  ];
  for (const [o, k] of stops) rg.addColorStop(o, rgba(rgb, a * k));
  s.fillStyle = rg;
  s.fillRect(0, 0, 64, 64);
  return sp;
}

const TRACE_LIFE = 2.4;

type Agent = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  trail: [number, number][];
  tail: number;
  nodes: number;
  hand: number;
  life: number;
  state: 'run' | 'fade' | 'wait';
  wait: number;
  flash: number;
  fx: number;
  fy: number;
};

type Trace = { n: number; i: number; j: number; born: number };

export function GridPulseBg({
  bg = '#161316',
  ink = '#BABABA',
  accent = '#FF6D29',
  cell = 48,
  lineOpacity = 0.11,
  pulses = 7,
  tail = 2.6,
  speed = 150,
  turnChance = 0.25,
  glow = 0.7,
  trace = 0.65,
  calm = 0.5,
  calmX = 0.5,
  calmY = 0.5,
}: GridPulseBgProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const gridC = document.createElement('canvas');
    const pulseC = document.createElement('canvas');
    for (const c of [gridC, pulseC]) {
      c.setAttribute('aria-hidden', 'true');
      Object.assign(c.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity .5s ease',
      });
    }
    el.appendChild(gridC);
    el.appendChild(pulseC);

    const g = gridC.getContext('2d');
    const ctx = pulseC.getContext('2d');
    if (!g || !ctx) return;

    const accRgb = hexToRgb(accent);
    const lineRgb = hexToRgb(ink);
    const headRgb = mixRgb(accRgb, [255, 255, 255], 0.5);
    const glowS = radialSprite(accRgb, 0.65);

    let w = 1;
    let h = 1;
    let dpr = 1;
    let shown = false;
    let clock = 0;
    let F: [number, number] = [0, 0];

    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const focus = (): [number, number] => {
      const k = Math.min(1, calm * 2);
      const fx = Math.min(0.85, Math.max(0.15, 0.5 + (0.5 - calmX) * 0.95 * k));
      const fy = Math.min(0.85, Math.max(0.15, 0.5 + (0.5 - calmY) * 0.75 * k));
      return [fx * w, fy * h];
    };

    const calmAt = (x: number, y: number) => {
      if (calm <= 0) return 0;
      const r = (0.32 + 0.4 * calm) * h;
      const d = Math.hypot(x - calmX * w, y - calmY * h);
      return calm * (1 - smooth(r * 0.35, r, d));
    };

    const maskAt = (x: number, y: number) => {
      const edge = Math.min(x, w - x, y, h - y);
      if (edge < 2) return 0;
      const d = Math.hypot((x - F[0]) / (w * 0.95), (y - F[1]) / (h * 1.05));
      let m = 1 - smooth(0.32, 1.1, d);
      m *= smooth(0, Math.min(w, h) * 0.1, edge);
      return m * (1 - calmAt(x, y));
    };

    const lineW = () => Math.max(1, Math.round(dpr));
    const snap = (v: number) => Math.round(v * dpr);
    const gx = (i: number) => w / 2 + i * cell;
    const gy = (j: number) => h / 2 + j * cell;
    const iMin = () => -Math.floor(w / 2 / cell);
    const iMax = () => Math.floor(w / 2 / cell);
    const jMin = () => -Math.floor(h / 2 / cell);
    const jMax = () => Math.floor(h / 2 / cell);

    function drawGrid() {
      if (!g) return;
      F = focus();
      const W = gridC.width;
      const H = gridC.height;
      const lw = lineW();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.fillStyle = rgba(lineRgb, 1);
      for (let i = iMin() - 1; i <= iMax() + 1; i++) {
        g.fillRect(snap(gx(i)) - (lw >> 1), 0, lw, H);
      }
      for (let j = jMin() - 1; j <= jMax() + 1; j++) {
        g.fillRect(0, snap(gy(j)) - (lw >> 1), W, lw);
      }

      const mw = Math.max(8, Math.ceil(w / 8));
      const mh = Math.max(8, Math.ceil(h / 8));
      const mc = document.createElement('canvas');
      mc.width = mw;
      mc.height = mh;
      const mx = mc.getContext('2d');
      if (!mx) return;
      const img = mx.createImageData(mw, mh);
      const k = lineOpacity * 1.3;
      for (let y = 0; y < mh; y++) {
        for (let x = 0; x < mw; x++) {
          const m = maskAt(((x + 0.5) / mw) * w, ((y + 0.5) / mh) * h);
          const o = (y * mw + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = 0;
          img.data[o + 3] = Math.round(Math.min(1, m * k) * 255);
        }
      }
      mx.putImageData(img, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(mc, 0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }

    const traces = new Map<string, Trace>();
    function lightUp(a: Agent, x0: number, y0: number, x1: number, y1: number, born: number) {
      const i = Math.round(x1);
      const j = Math.round(y1);
      traces.set(`n${i},${j}`, { n: 1, i, j, born });
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      const nx = dy * a.hand;
      const ny = -dx * a.hand;
      const ci = dx ? Math.min(Math.round(x0), i) : nx > 0 ? i : i - 1;
      const cj = dy ? Math.min(Math.round(y0), j) : ny > 0 ? j : j - 1;
      traces.set(`c${ci},${cj}`, { n: 0, i: ci, j: cj, born });
    }

    const agents: Agent[] = [];
    function spawn(a: Partial<Agent>): Agent {
      const nodes: [number, number, number][] = [];
      for (let ii = iMin() + 1; ii < iMax(); ii++) {
        for (let jj = jMin() + 1; jj < jMax(); jj++) {
          const m = maskAt(gx(ii), gy(jj));
          if (m > 0.45) nodes.push([ii, jj, m]);
        }
      }
      let i = 0;
      let j = 0;
      for (let k = 0; k < 12 && nodes.length; k++) {
        [i, j] = nodes[Math.floor(rand() * nodes.length)];
        const busy = agents.some(
          (o) => o !== a && o.state !== 'wait' && (Math.abs(o.x - i) < 0.5 || Math.abs(o.y - j) < 0.5),
        );
        if (!busy) break;
      }
      const dirs: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      let d = dirs[Math.floor(rand() * 4)];
      if (
        maskAt(gx(i + d[0] * 3), gy(j + d[1] * 3)) <
        maskAt(gx(i - d[0] * 3), gy(j - d[1] * 3))
      ) {
        d = [-d[0], -d[1]];
      }
      return Object.assign(a, {
        x: i,
        y: j,
        dx: d[0],
        dy: d[1],
        trail: [[i, j]] as [number, number][],
        tail: 0,
        nodes: 0,
        hand: rand() < 0.5 ? 1 : -1,
        life: 6 + Math.floor(rand() * 9),
        state: 'run' as const,
        wait: 0,
        flash: 0,
        fx: i,
        fy: j,
      });
    }

    function step(a: Agent, dt: number, now: number) {
      const tailPx = tail * cell;
      if (a.flash > 0) a.flash = Math.max(0, a.flash - dt / 0.9);
      if (a.state === 'wait') {
        a.wait -= dt;
        if (a.wait <= 0) spawn(a);
        return;
      }
      const v = speed * dt;
      if (a.state === 'fade') {
        a.tail -= v;
        if (a.tail <= 0) {
          a.state = 'wait';
          a.wait = 0.1 + rand() * 0.4;
        }
        return;
      }
      a.tail = Math.min(tailPx, a.tail + v);
      let move = v / cell;
      while (move > 1e-6) {
        const pos = a.dx ? a.x : a.y;
        const dir = a.dx || a.dy;
        const next = dir > 0 ? Math.floor(pos + 1e-6) + 1 : Math.ceil(pos - 1e-6) - 1;
        const dn = Math.abs(next - pos);
        if (move < dn) {
          if (a.dx) a.x += dir * move;
          else a.y += dir * move;
          break;
        }
        const [px0, py0] = [a.x, a.y];
        if (a.dx) a.x = next;
        else a.y = next;
        move -= dn;
        a.trail.push([a.x, a.y]);
        if (a.trail.length > 16) a.trail.shift();
        a.nodes++;
        const m = maskAt(gx(a.x), gy(a.y));
        if (m >= 0.3) {
          lightUp(
            a,
            a.dx ? a.x - a.dx : px0,
            a.dy ? a.y - a.dy : py0,
            a.x,
            a.y,
            now - move / Math.max(1e-6, speed / cell),
          );
        }
        if (a.nodes >= a.life || m < 0.3) {
          a.state = 'fade';
          a.flash = m < 0.3 ? 0 : 1;
          a.fx = a.x;
          a.fy = a.y;
          break;
        }
        if (rand() < turnChance) {
          const s = rand() < 0.5 ? 1 : -1;
          [a.dx, a.dy] = a.dx ? [0, s] : [s, 0];
        }
      }
    }

    const targetCount = () => {
      const n = Math.round(pulses);
      if (n <= 0) return 0;
      return Math.max(n, Math.min(Math.round(n * 2.5), Math.round((n * (w * h)) / (480 * 300))));
    };

    function setCount() {
      const n = targetCount();
      while (agents.length > n) agents.pop();
      while (agents.length < n) {
        const a = spawn({});
        const T = ((0.25 + 0.6 * rand()) * a.life * cell) / speed;
        for (let s = 0; s < T && a.state === 'run'; s += 1 / 30) {
          step(a, 1 / 30, clock - T + s);
        }
        agents.push(a);
      }
    }

    const px = (x: number) => snap(gx(x)) + (lineW() % 2 ? 0.5 : 0);
    const py = (y: number) => snap(gy(y)) + (lineW() % 2 ? 0.5 : 0);

    function drawTraces() {
      if (!ctx || trace <= 0) return;
      const c = cell * dpr;
      const lw = lineW();
      for (const [key, tr] of traces) {
        const age = (clock - tr.born) / TRACE_LIFE;
        if (age >= 1) {
          traces.delete(key);
          continue;
        }
        const f = Math.pow(1 - Math.max(0, age), 2);
        if (tr.n) {
          const m = maskAt(gx(tr.i), gy(tr.j));
          const X = px(tr.i);
          const Y = py(tr.j);
          const s = (1.5 + 1.2 * trace) * dpr;
          ctx.fillStyle = rgba(headRgb, f * m * (0.55 + 0.45 * trace));
          ctx.fillRect(Math.round(X - s), Math.round(Y - s), Math.round(s * 2), Math.round(s * 2));
        } else {
          const m = maskAt(gx(tr.i + 0.5), gy(tr.j + 0.5));
          const X = snap(gx(tr.i)) + lw;
          const Y = snap(gy(tr.j)) + lw;
          ctx.fillStyle = rgba(accRgb, f * m * trace * 0.2);
          ctx.fillRect(X, Y, Math.round(c) - lw, Math.round(c) - lw);
        }
      }
    }

    function drawPulse(a: Agent) {
      if (!ctx) return;
      const lw = lineW();
      if (a.flash > 0) {
        const m = maskAt(gx(a.fx), gy(a.fy));
        const s = (10 + 8 * glow) * dpr;
        ctx.globalAlpha = a.flash * a.flash * m * (0.35 + 0.65 * glow);
        ctx.drawImage(glowS, px(a.fx) - s, py(a.fy) - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
      }
      if (a.state === 'wait' || a.tail <= 0) return;

      const pts: [number, number][] = [[a.x, a.y]];
      let left = a.tail / cell;
      for (let k = a.trail.length - 1; k >= 0 && left > 0; k--) {
        const [x0, y0] = pts[pts.length - 1];
        const [x1, y1] = a.trail[k];
        const d = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        if (d < 1e-6) continue;
        if (d >= left) {
          pts.push([x0 + ((x1 - x0) * left) / d, y0 + ((y1 - y0) * left) / d]);
          left = 0;
          break;
        }
        pts.push([x1, y1]);
        left -= d;
      }
      const total = a.tail / cell - left;
      if (total <= 1e-4) return;

      ctx.lineCap = 'butt';
      let s0 = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k];
        const [x1, y1] = pts[k + 1];
        const d = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        const s1 = s0 + d;
        const a0 = Math.min(1, Math.pow(1 - s0 / tail, 1.4) * maskAt(gx(x0), gy(y0)));
        const a1 = Math.min(1, Math.pow(Math.max(0, 1 - s1 / tail), 1.4) * maskAt(gx(x1), gy(y1)));
        const X0 = px(x0);
        const Y0 = py(y0);
        const X1 = px(x1);
        const Y1 = py(y1);
        const gr = ctx.createLinearGradient(X0, Y0, X1, Y1);
        gr.addColorStop(0, rgba(accRgb, a0));
        gr.addColorStop(1, rgba(accRgb, a1));
        ctx.beginPath();
        ctx.moveTo(X0, Y0);
        ctx.lineTo(X1, Y1);
        ctx.strokeStyle = gr;
        ctx.globalAlpha = 0.22 * glow;
        ctx.lineWidth = lw * 5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.stroke();
        s0 = s1;
      }

      if (a.state === 'run') {
        const m = maskAt(gx(a.x), gy(a.y));
        const grow = Math.min(1, a.tail / (tail * cell * 0.35));
        const X = px(a.x);
        const Y = py(a.y);
        if (glow > 0) {
          const s = (10 + 10 * glow) * dpr;
          ctx.globalAlpha = m * grow * glow;
          ctx.drawImage(glowS, X - s, Y - s, s * 2, s * 2);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = rgba(headRgb, m * grow);
        ctx.beginPath();
        ctx.arc(X, Y, 1.7 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function fit() {
      if (!el) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, el.clientWidth);
      h = Math.max(1, el.clientHeight);
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      for (const c of [gridC, pulseC]) {
        if (c.width !== W || c.height !== H) {
          c.width = W;
          c.height = H;
        }
      }
      drawGrid();
    }

    fit();
    setCount();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      for (const a of agents) step(a, dt, clock);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pulseC.width, pulseC.height);
      drawTraces();
      for (const a of agents) drawPulse(a);
      if (!shown) {
        shown = true;
        gridC.style.opacity = '1';
        pulseC.style.opacity = '1';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      fit();
      setCount();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gridC.remove();
      pulseC.remove();
    };
  }, [accent, cell, glow, ink, lineOpacity, pulses, speed, tail, trace, turnChance, calm, calmX, calmY]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        backgroundColor: bg,
        backgroundImage: `radial-gradient(ellipse 65% 55% at 15% 45%, rgba(255, 109, 41, 0.28), transparent 65%), radial-gradient(ellipse 55% 50% at 85% 20%, rgba(69, 48, 39, 0.45), transparent 65%)`,
      }}
    />
  );
}
