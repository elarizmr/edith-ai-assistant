"use client";

import { motion } from "framer-motion";
import { OrbState, STATE_COLORS, STATE_LABELS } from "@/lib/edith-theme";
import GaugeRing from "./GaugeRing";

// Server ve client-de trigonometriya ile hesablanan uzun onluq ededler
// fergli sekilde stringe cevrile bilir (hydration mismatch-in sebebi budur).
const r = (n: number) => Math.round(n * 1000) / 1000;

export default function VoiceOrb({ state = "idle" }: { state?: OrbState }) {
  const color = STATE_COLORS[state];
  const isActive = state !== "idle";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 430, height: 430 }}
    >
      {/* ================================================= */}
      {/* OUTER TICK-MARK SCALE (gauge look) */}
      {/* ================================================= */}

      <motion.svg
        width={410}
        height={410}
        className="absolute"
        animate={{ rotate: 360 }}
        transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
      >
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i / 60) * 360;
          const rad = (angle * Math.PI) / 180;
          const cx = 205;
          const cy = 205;
          const major = i % 5 === 0;
          const r1 = major ? 186 : 192;
          const r2 = 198;
          return (
            <line
              key={i}
              x1={r(cx + r1 * Math.cos(rad))}
              y1={r(cy + r1 * Math.sin(rad))}
              x2={r(cx + r2 * Math.cos(rad))}
              y2={r(cy + r2 * Math.sin(rad))}
              stroke={major ? `${color}70` : `${color}30`}
              strokeWidth={major ? 1.5 : 1}
            />
          );
        })}
      </motion.svg>

      {/* ================================================= */}
      {/* OUTER HUD CIRCLE */}
      {/* ================================================= */}

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 410,
          height: 410,
          border: `1px solid ${color}18`,
          boxShadow: `0 0 60px ${color}10`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />

      {/* ================================================= */}
      {/* SECOND HUD CIRCLE */}
      {/* ================================================= */}

      <motion.div
        className="absolute rounded-full"
        style={{ width: 360, height: 360, border: `1px solid ${color}30` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />

      {/* ================================================= */}
      {/* DASHED RING */}
      {/* ================================================= */}

      <motion.div
        className="absolute rounded-full"
        style={{ width: 325, height: 325, border: `1px dashed ${color}65` }}
        animate={{ rotate: 360, scale: isActive ? [1, 1.04, 1] : 1 }}
        transition={{
          rotate: {
            duration: state === "listening" ? 4 : 10,
            repeat: Infinity,
            ease: "linear",
          },
          scale: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* ================================================= */}
      {/* ROTATING ENERGY ARC */}
      {/* ================================================= */}

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 290,
          height: 290,
          borderTop: `3px solid ${color}`,
          borderRight: `1px solid ${color}80`,
          borderBottom: `1px solid ${color}20`,
          borderLeft: "1px solid transparent",
          filter: `drop-shadow(0 0 8px ${color})`,
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: state === "thinking" ? 2.5 : 6,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* ================================================= */}
      {/* INNER ROTATING ARC */}
      {/* ================================================= */}

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 260,
          height: 260,
          borderBottom: `2px solid ${color}`,
          borderLeft: `1px solid ${color}70`,
          borderTop: "1px solid transparent",
          borderRight: "1px solid transparent",
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
        animate={{ rotate: -360 }}
        transition={{
          duration: state === "listening" ? 2 : 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* ================================================= */}
      {/* RADAR LINE */}
      {/* ================================================= */}

      <motion.div
        className="absolute origin-center"
        style={{
          width: 270,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}90, transparent)`,
          boxShadow: `0 0 10px ${color}`,
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: state === "listening" ? 2 : 5,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* ================================================= */}
      {/* ORBITING DOTS */}
      {/* ================================================= */}

      <motion.div
        className="absolute"
        style={{ width: 280, height: 280 }}
        animate={{ rotate: 360 }}
        transition={{
          duration: state === "thinking" ? 3 : 8,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 6,
            height: 6,
            top: 0,
            left: "50%",
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 3,
            height: 3,
            bottom: 18,
            left: 25,
            background: "#fff",
            boxShadow: `0 0 10px ${color}`,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 4,
            height: 4,
            right: 12,
            bottom: 70,
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      </motion.div>

      {/* ================================================= */}
      {/* CENTRAL GLOW */}
      {/* ================================================= */}

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 220,
          height: 220,
          background: `radial-gradient(circle, ${color}35 0%, ${color}15 35%, transparent 72%)`,
          filter: "blur(4px)",
        }}
        animate={{
          scale: isActive ? [1, 1.12, 1] : [1, 1.05, 1],
          opacity: isActive ? [0.7, 1, 0.7] : [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: state === "listening" ? 0.7 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ================================================= */}
      {/* MAIN CORE */}
      {/* ================================================= */}

      <motion.div
        className="relative rounded-full overflow-hidden"
        style={{
          width: 175,
          height: 175,
          background: `radial-gradient(circle at 50% 45%, ${color}cc 0%, ${color}55 20%, ${color}18 48%, #020617 72%)`,
          border: `1px solid ${color}`,
          boxShadow: `0 0 20px ${color}90, 0 0 50px ${color}45, inset 0 0 40px ${color}35`,
        }}
        animate={{
          scale:
            state === "idle"
              ? [1, 1.03, 1]
              : state === "listening"
              ? [1, 1.14, 1]
              : state === "thinking"
              ? [1, 1.08, 1]
              : [1, 1.1, 1],
        }}
        transition={{
          duration: state === "listening" ? 0.6 : state === "speaking" ? 0.5 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 85,
            height: 85,
            left: "50%",
            top: "45%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, white 0%, ${color} 18%, ${color}70 40%, transparent 72%)`,
            filter: "blur(3px)",
          }}
          animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.65, 1, 0.65] }}
          transition={{
            duration: state === "listening" ? 0.55 : 1.7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute rounded-full bg-white"
          style={{
            width: 10,
            height: 10,
            left: "50%",
            top: "45%",
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 15px white, 0 0 30px ${color}, 0 0 55px ${color}`,
          }}
          animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.7, 1, 0.7] }}
          transition={{
            duration: state === "listening" ? 0.5 : 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute left-0 right-0"
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${color}80, white, ${color}80, transparent)`,
            boxShadow: `0 0 8px ${color}`,
          }}
          animate={{ top: ["25%", "70%", "25%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* ================================================= */}
      {/* CORNER MARKERS */}
      {/* ================================================= */}

      <div
        className="absolute"
        style={{ width: 18, height: 18, top: 62, left: 62, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }}
      />
      <div
        className="absolute"
        style={{ width: 18, height: 18, top: 62, right: 62, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }}
      />
      <div
        className="absolute"
        style={{ width: 18, height: 18, bottom: 62, left: 62, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }}
      />
      <div
        className="absolute"
        style={{ width: 18, height: 18, bottom: 62, right: 62, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }}
      />

      {/* ================================================= */}
      {/* SIDE READOUTS (Iron Man style mini gauges) */}
      {/* ================================================= */}

      <div className="absolute" style={{ left: -70, top: "50%", transform: "translateY(-50%)" }}>
        <GaugeRing value={isActive ? 100 : 62} size={58} strokeWidth={2.5} color={color} label="CORE" />
      </div>

      <div className="absolute" style={{ right: -70, top: "50%", transform: "translateY(-50%)" }}>
        <GaugeRing
          value={state === "thinking" ? 88 : 100}
          size={58}
          strokeWidth={2.5}
          color={color}
          label="LINK"
        />
      </div>

      {/* ================================================= */}
      {/* STATUS */}
      {/* ================================================= */}

      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.35em] whitespace-nowrap"
        style={{ color, textShadow: `0 0 10px ${color}` }}
      >
        {STATE_LABELS[state]}
      </div>
    </div>
  );
}