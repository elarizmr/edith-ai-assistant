"use client";

import { motion } from "framer-motion";

// Server ve client-de trigonometriya ile hesablanan uzun onluq ededler
// fergli sekilde stringe cevrile bilir (hydration mismatch-in sebebi budur).
// Sabit dereceye yuvarlaqlasdirmaq iki terefde de eyni netice verir.
const r = (n: number) => Math.round(n * 1000) / 1000;

interface GaugeRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color: string;
  label?: string;
  valueLabel?: string;
  ticks?: number;
}

export default function GaugeRing({
  value,
  size = 84,
  strokeWidth = 3,
  color,
  label,
  valueLabel,
  ticks = 24,
}: GaugeRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Tick marks */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        {Array.from({ length: ticks }).map((_, i) => {
          const angle = (i / ticks) * 360;
          const r1 = radius + strokeWidth + 2;
          const r2 = radius + strokeWidth + 5;
          const rad = (angle * Math.PI) / 180;
          const cx = size / 2;
          const cy = size / 2;
          return (
            <line
              key={i}
              x1={r(cx + r1 * Math.cos(rad))}
              y1={r(cy + r1 * Math.sin(rad))}
              x2={r(cx + r2 * Math.cos(rad))}
              y2={r(cy + r2 * Math.sin(rad))}
              stroke={`${color}35`}
              strokeWidth={1}
            />
          );
        })}
      </svg>

      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`${color}18`}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-xs font-semibold leading-none"
          style={{ color, textShadow: `0 0 8px ${color}` }}
        >
          {valueLabel ?? `${value}%`}
        </span>
        {label && (
          <span className="text-[7px] tracking-[0.2em] text-white/30 font-mono mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}