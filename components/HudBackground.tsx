"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { OrbState } from "@/lib/jarvis-theme";

interface HudBackgroundProps {
  state?: OrbState;
}

const COLOR = "#50d7f5";
const W = 1600;
const H = 900;
const CX = 800;
const CY = 405; // orbun mərkəzinə uyğun

const r = (n: number) => Math.round(n * 100) / 100;

// Hər dəfə eyni nəticə versin deyə (hydration xətası olmasın)
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABELS = [
  "AI", "NO", "SYS.04", "X-17", "R/221", "CORE", "SEC-9", "A3", "0xFF",
  "NODE", "LINK", "T-88", "B12", "REV.C", "SCAN", "MK-VII", "ΔV", "47.2",
];

function arcPath(rad: number, a0: number, a1: number) {
  const p = (d: number) => {
    const a = (d * Math.PI) / 180;
    return [r(CX + rad * Math.cos(a)), r(CY + rad * Math.sin(a))];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

export default function HudBackground({}: HudBackgroundProps) {
  const shapes = useMemo(() => {
    const rand = rng(7);
    const rects: { x: number; y: number; w: number; h: number; o: number }[] = [];
    const paths: { d: string; o: number }[] = [];
    const crosses: { x: number; y: number }[] = [];
    const labels: { x: number; y: number; t: string }[] = [];
    const dims: { x: number; y: number; len: number; vert: boolean }[] = [];

    const free = (x: number, y: number) =>
      Math.hypot(x - CX, (y - CY) * 1.1) > 215; // orbun öz yeri boş qalsın

    let guard = 0;
    while (rects.length < 70 && guard++ < 2000) {
      const x = rand() * W;
      const y = rand() * H;
      if (!free(x, y)) continue;
      rects.push({
        x: r(x),
        y: r(y),
        w: r(6 + rand() * 46),
        h: r(4 + rand() * 26),
        o: r(0.08 + rand() * 0.16),
      });
    }

    guard = 0;
    while (paths.length < 38 && guard++ < 2000) {
      let x = rand() * W;
      let y = rand() * H;
      if (!free(x, y)) continue;
      let d = `M ${r(x)} ${r(y)}`;
      const steps = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < steps; i++) {
        if (i % 2 === 0) x += (rand() - 0.5) * 160;
        else y += (rand() - 0.5) * 120;
        d += ` L ${r(x)} ${r(y)}`;
      }
      paths.push({ d, o: r(0.1 + rand() * 0.14) });
    }

    guard = 0;
    while (crosses.length < 34 && guard++ < 2000) {
      const x = rand() * W;
      const y = rand() * H;
      if (!free(x, y)) continue;
      crosses.push({ x: r(x), y: r(y) });
    }

    guard = 0;
    while (labels.length < 16 && guard++ < 2000) {
      const x = rand() * (W - 80);
      const y = 20 + rand() * (H - 40);
      if (!free(x, y)) continue;
      labels.push({ x: r(x), y: r(y), t: LABELS[labels.length % LABELS.length] });
    }

    guard = 0;
    while (dims.length < 9 && guard++ < 2000) {
      const x = rand() * W;
      const y = rand() * H;
      if (!free(x, y)) continue;
      dims.push({ x: r(x), y: r(y), len: r(60 + rand() * 140), vert: rand() > 0.5 });
    }

    return { rects, paths, crosses, labels, dims };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #06222e 0%, #03121a 45%, #010609 100%)",
      }}
    >
      {/* Çox incə şəbəkə */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(${COLOR} 1px, transparent 1px),
            linear-gradient(90deg, ${COLOR} 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Mühəndis çertyoju */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke={COLOR}
      >
        {/* Mərkəzdən yayılan dairələr */}
        {[130, 210, 290, 370, 470, 580, 700, 830].map((rad, i) => (
          <circle
            key={rad}
            cx={CX}
            cy={CY}
            r={rad}
            strokeOpacity={0.07 + (i % 3) * 0.03}
            strokeDasharray={i % 2 ? "2 8" : undefined}
          />
        ))}

        {/* Qırıq qövslər */}
        {[
          [340, 20, 110],
          [340, 200, 290],
          [520, 250, 340],
          [520, 60, 130],
          [650, 150, 230],
          [650, 320, 30],
        ].map(([rad, a, b], i) => (
          <path
            key={i}
            d={arcPath(rad, a, b < a ? b + 360 : b)}
            strokeOpacity={0.2}
            strokeWidth={2}
          />
        ))}

        {/* Radial xətlər */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={r(CX + Math.cos(a) * 230)}
              y1={r(CY + Math.sin(a) * 230)}
              x2={r(CX + Math.cos(a) * 880)}
              y2={r(CY + Math.sin(a) * 880)}
              strokeOpacity={0.05}
            />
          );
        })}

        {/* Xaç xətləri */}
        <line x1={0} y1={CY} x2={W} y2={CY} strokeOpacity={0.12} />
        <line x1={CX} y1={0} x2={CX} y2={H} strokeOpacity={0.1} />

        {/* Kiçik düzbucaqlılar */}
        {shapes.rects.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} strokeOpacity={s.o} />
        ))}

        {/* Sxem xətləri */}
        {shapes.paths.map((p, i) => (
          <path key={i} d={p.d} strokeOpacity={p.o} />
        ))}

        {/* Ölçü xətləri */}
        {shapes.dims.map((d, i) =>
          d.vert ? (
            <g key={i} strokeOpacity={0.18}>
              <line x1={d.x} y1={d.y} x2={d.x} y2={d.y + d.len} />
              <line x1={d.x - 5} y1={d.y} x2={d.x + 5} y2={d.y} />
              <line x1={d.x - 5} y1={d.y + d.len} x2={d.x + 5} y2={d.y + d.len} />
            </g>
          ) : (
            <g key={i} strokeOpacity={0.18}>
              <line x1={d.x} y1={d.y} x2={d.x + d.len} y2={d.y} />
              <line x1={d.x} y1={d.y - 5} x2={d.x} y2={d.y + 5} />
              <line x1={d.x + d.len} y1={d.y - 5} x2={d.x + d.len} y2={d.y + 5} />
            </g>
          )
        )}

        {/* Xaç işarələri */}
        {shapes.crosses.map((c, i) => (
          <g key={i} strokeOpacity={0.3}>
            <line x1={c.x - 5} y1={c.y} x2={c.x + 5} y2={c.y} />
            <line x1={c.x} y1={c.y - 5} x2={c.x} y2={c.y + 5} />
          </g>
        ))}

        {/* Kiçik yazılar */}
        {shapes.labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            fill={COLOR}
            fillOpacity={0.3}
            stroke="none"
            fontSize={10}
            fontFamily="ui-monospace, Menlo, monospace"
            letterSpacing={2}
          >
            {l.t}
          </text>
        ))}
      </svg>

      {/* Yavaş dönən nöqtəli halqa */}
      <div
        className="absolute left-0 w-full flex items-center justify-center"
        style={{ top: `${(CY / H) * 100}%`, transform: "translateY(-50%)" }}
      >
        <motion.svg
          width={1100}
          height={1100}
          viewBox="0 0 1100 1100"
          style={{ flexShrink: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx={550}
            cy={550}
            r={540}
            fill="none"
            stroke={COLOR}
            strokeOpacity={0.18}
            strokeDasharray="2 12"
          />
        </motion.svg>
      </div>

      {/* Kənar kölgəsi */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Yuxarı və aşağı nazik xətlər */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${COLOR}50, transparent)` }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${COLOR}50, transparent)` }}
      />
    </div>
  );
}