"use client";

import { useEffect, useRef } from "react";
import type { OrbState } from "@/lib/jarvis-theme";

const SIZE = 520;
const C = SIZE / 2;
const TAU = Math.PI * 2;

type Params = { spin: number; glow: number };

const PARAMS: Record<string, Params> = {
  idle: { spin: 1, glow: 0.8 },
  listening: { spin: 1.6, glow: 1.1 },
  thinking: { spin: 4, glow: 1.0 },
  speaking: { spin: 1.8, glow: 1.15 },
};

const LABELS: Record<string, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "SPEAKING",
};

const CYAN = "80,215,245";
const BLUE = "60,160,230";
const YELLOW = "255,190,40";

export default function VoiceOrb({ state }: { state: OrbState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<string>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cur: Params = { ...PARAMS.idle };
    let pulse = 0;
    let t = 0;
    let aOuter = 0;
    let aTicks = 0;
    let aBand = 0;
    let aYellow = 0;
    let aDash = 0;
    let last = performance.now();
    let raf = 0;

    const R = SIZE * 0.47;

    const arc = (
      r: number,
      a0: number,
      a1: number,
      width: number,
      color: string,
      blur = 0
    ) => {
      ctx.beginPath();
      ctx.arc(C, C, r, a0, a1);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowColor = `rgba(${CYAN},0.9)`;
      ctx.shadowBlur = blur;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      const st = stateRef.current;
      const target = PARAMS[st] ?? PARAMS.idle;
      const k = 1 - Math.exp(-dt * 3);
      cur.spin += (target.spin - cur.spin) * k;
      cur.glow += (target.glow - cur.glow) * k;

      const pulseTarget =
        st === "speaking"
          ? (0.5 + 0.5 * Math.sin(t * 7.3)) * (0.55 + 0.45 * Math.sin(t * 3.1 + 1))
          : st === "listening"
          ? 0.35 + 0.35 * Math.sin(t * 2.2)
          : 0;
      pulse += (pulseTarget - pulse) * (1 - Math.exp(-dt * 10));

      aOuter += dt * 0.18 * cur.spin;
      aTicks -= dt * 0.07 * cur.spin;
      aBand += dt * 0.12 * cur.spin;
      aYellow += dt * 0.5 * cur.spin;
      aDash -= dt * 0.15 * cur.spin;

      const glow = cur.glow + pulse * 0.3;
      const S = 1 + pulse * 0.015;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "butt";

      // ---------- Arxa fon işığı ----------
      const bg = ctx.createRadialGradient(C, C, R * 0.2, C, C, R * 1.1);
      bg.addColorStop(0, `rgba(10,90,140,${0.22 * glow})`);
      bg.addColorStop(0.7, `rgba(10,60,110,${0.12 * glow})`);
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // ---------- Çox solğun "çertyoj" xətləri ----------
      ctx.strokeStyle = `rgba(${CYAN},0.07)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, C);
      ctx.lineTo(SIZE, C);
      ctx.moveTo(C, 0);
      ctx.lineTo(C, SIZE);
      ctx.stroke();

      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(aDash);
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.4, 0, TAU);
      ctx.strokeStyle = `rgba(${CYAN},0.22)`;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.04, 0, TAU);
      ctx.strokeStyle = `rgba(${CYAN},0.18)`;
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);

      // ---------- Mərkəzdəki nazik radial xətlər ----------
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(-aBand * 0.6);
      ctx.beginPath();
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU;
        const r0 = R * 0.28;
        const r1 = R * 0.36 + (i % 3 === 0 ? R * 0.04 : 0);
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.strokeStyle = `rgba(${CYAN},0.18)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // ---------- Xarici qırıq halqa ----------
      const outer: [number, number][] = [
        [0.0, 0.3],
        [0.34, 0.2],
        [0.58, 0.14],
        [0.76, 0.2],
      ];
      outer.forEach(([s, l]) => {
        const a0 = aOuter + s * TAU;
        arc(R * 0.99 * S, a0, a0 + l * TAU, 5, `rgba(${CYAN},${0.9 * glow})`, 12 * glow);
      });
      // Qalın kiçik "tab" hissələri
      arc(R * 0.99 * S, aOuter + 0.31 * TAU, aOuter + 0.335 * TAU, 11, `rgba(${CYAN},${0.95 * glow})`, 14);
      arc(R * 0.99 * S, aOuter + 0.915 * TAU, aOuter + 0.94 * TAU, 9, `rgba(${CYAN},${0.9 * glow})`, 12);

      arc(R * 0.93 * S, 0, TAU, 1, `rgba(${CYAN},0.35)`);

      // ---------- Dişli (tick) halqası ----------
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(aTicks);
      ctx.beginPath();
      const TICKS = 140;
      for (let i = 0; i < TICKS; i++) {
        const a = (i / TICKS) * TAU;
        const long = i % 5 === 0;
        const r0 = R * 0.84;
        const r1 = R * (long ? 0.905 : 0.875);
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.strokeStyle = `rgba(${CYAN},${0.75 * glow})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // ---------- Qalın seqmentli işıqlı qövs ----------
      const r1 = R * 0.62;
      const r2 = R * 0.78;
      const bandStart = aBand + 3.35;
      const bandSpan = 2.7;
      const SEG = 20;
      const segSpan = bandSpan / SEG;

      for (let i = 0; i < SEG; i++) {
        const a0 = bandStart + i * segSpan;
        const a1 = a0 + segSpan - 0.012;

        let alpha = 0.34;
        if (st === "listening" || st === "speaking") {
          alpha += 0.22 * (0.5 + 0.5 * Math.sin(t * 5 - i * 0.55)) * (0.6 + pulse);
        } else if (st === "thinking") {
          alpha += 0.25 * (0.5 + 0.5 * Math.sin(t * 9 - i * 0.8));
        }

        ctx.beginPath();
        ctx.arc(C, C, r2 * S, a0, a1);
        ctx.arc(C, C, r1 * S, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(${BLUE},${Math.min(alpha * glow, 0.85)})`;
        ctx.fill();
      }

      arc(r2 * S, bandStart, bandStart + bandSpan, 2, `rgba(${CYAN},${0.9 * glow})`, 8);
      arc(r1 * S, bandStart, bandStart + bandSpan, 1.2, `rgba(${CYAN},0.55)`);
      arc(r2 * S, 0, TAU, 1, `rgba(${CYAN},0.25)`);

      // Sarı nöqtələr qövsün üstündə
      for (let i = 0; i < 4; i++) {
        const a = bandStart + 0.1 + i * 0.09;
        ctx.beginPath();
        ctx.arc(C + Math.cos(a) * (r2 + 8) * S, C + Math.sin(a) * (r2 + 8) * S, 2.2, 0, TAU);
        ctx.fillStyle = `rgba(${YELLOW},${0.95 * glow})`;
        ctx.shadowColor = `rgba(${YELLOW},1)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ---------- Sarı nazik qövs ----------
      ctx.shadowColor = `rgba(${YELLOW},1)`;
      ctx.beginPath();
      ctx.arc(C, C, R * 0.585 * S, aYellow, aYellow + 1.15);
      ctx.strokeStyle = `rgba(${YELLOW},${0.95 * glow})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---------- Daxili ağ-firuzəyi halqa ----------
      const inner: [number, number][] = [
        [0.12, 3.05],
        [3.25, 6.15],
      ];
      inner.forEach(([a0, a1]) => {
        arc(R * 0.52 * S, a0 - aBand * 0.5, a1 - aBand * 0.5, 4, `rgba(200,245,255,${0.95 * glow})`, 14 * glow);
      });
      arc(R * 0.56 * S, 0, TAU, 1, `rgba(${CYAN},0.4)`);

      // ---------- Yazı: J.A.R.V.I.S. ----------
      const text = "J.A.R.V.I.S.";
      ctx.font = "700 26px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const spacing = 3;
      let total = 0;
      const widths: number[] = [];
      for (const ch of text) {
        const w = ctx.measureText(ch).width;
        widths.push(w);
        total += w + spacing;
      }
      total -= spacing;

      let x = C - total / 2;
      ctx.fillStyle = "rgba(240,252,255,0.97)";
      ctx.shadowColor = `rgba(${CYAN},${0.9 * glow})`;
      ctx.shadowBlur = 12 + pulse * 10;
      let i = 0;
      for (const ch of text) {
        ctx.fillText(ch, x, C);
        x += widths[i++] + spacing;
      }
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ width: SIZE, height: SIZE, display: "block" }}
      />
      <span
        className="font-mono text-[11px] tracking-[0.4em] -mt-3"
        style={{ color: "rgba(100,220,245,0.8)" }}
      >
        {LABELS[state] ?? "STANDBY"}
      </span>
    </div>
  );
}