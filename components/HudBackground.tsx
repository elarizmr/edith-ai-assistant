"use client";

import { motion } from "framer-motion";
import { OrbState, STATE_COLORS } from "@/lib/edith-theme";

// Server ve client-de trigonometriya ile hesablanan uzun onluq ededler
// fergli sekilde stringe cevrile bilir (hydration mismatch-in sebebi budur).
const r = (n: number) => Math.round(n * 1000) / 1000;

interface HudBackgroundProps {
  state?: OrbState;
}

export default function HudBackground({ state = "idle" }: HudBackgroundProps) {
  const color = STATE_COLORS[state];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-[#020611]">
      {/* Main radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              circle at 50% 50%,
              ${color}12 0%,
              transparent 38%
            )
          `,
        }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(${color}22 1px, transparent 1px),
            linear-gradient(90deg, ${color}22 1px, transparent 1px)
          `,
          backgroundSize: "45px 45px",
        }}
      />

      {/* Horizontal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
          boxShadow: `0 0 12px ${color}`,
        }}
        animate={{ top: ["0%", "100%"], opacity: [0, 0.8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />

      {/* Large HUD circle */}
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 700,
          height: 700,
          transform: "translate(-50%, -50%)",
          border: `1px solid ${color}14`,
          boxShadow: `0 0 80px ${color}08`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
      />

      {/* Radar tick-mark ring (Iron Man style scale) */}
      <motion.svg
        className="absolute left-1/2 top-1/2"
        width={620}
        height={620}
        style={{ transform: "translate(-50%, -50%)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      >
        {Array.from({ length: 72 }).map((_, i) => {
          const angle = (i / 72) * 360;
          const rad = (angle * Math.PI) / 180;
          const cx = 310;
          const cy = 310;
          const r1 = i % 6 === 0 ? 292 : 300;
          const r2 = 308;
          return (
            <line
              key={i}
              x1={r(cx + r1 * Math.cos(rad))}
              y1={r(cy + r1 * Math.sin(rad))}
              x2={r(cx + r2 * Math.cos(rad))}
              y2={r(cy + r2 * Math.sin(rad))}
              stroke={`${color}${i % 6 === 0 ? "40" : "20"}`}
              strokeWidth={i % 6 === 0 ? 1.5 : 1}
            />
          );
        })}
      </motion.svg>

      {/* Second circle */}
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 430,
          height: 430,
          transform: "translate(-50%, -50%)",
          border: `1px dashed ${color}20`,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      {/* Corner vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)`,
        }}
      />

      {/* Top line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
        }}
      />

      {/* Bottom line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
        }}
      />
    </div>
  );
}