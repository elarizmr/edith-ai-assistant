"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import GaugeRing from "./GaugeRing";
import { OrbState, STATE_COLORS, STATE_LABELS } from "@/lib/jarvis-theme";

interface TopBarProps {
  state?: OrbState;
  location?: string;
  cpu?: number;
  memory?: number;
}

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const MONTH_NAMES = [
 "JANUARY",
"FEBRUARY",
"MARCH",
"APRIL",
"MAY",
"JUNE",
"JULY",
"AUGUST",
"SEPTEMBER",
"OCTOBER",
"NOVEMBER",
"DECEMBER"
];

export default function TopBar({
  state = "idle",
  location = "BAKI, AZ",
  cpu = 42,
  memory = 68,
}: TopBarProps) {
  const color = STATE_COLORS[state];
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";
  const day = now ? now.getDate().toString().padStart(2, "0") : "--";
  const dayName = now ? DAY_NAMES[now.getDay()] : "";
  const monthName = now ? MONTH_NAMES[now.getMonth()] : "";

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-3 md:top-5 left-1/2 -translate-x-1/2 w-[min(1100px,92vw)] pointer-events-auto z-40"
    >
      <div
        className="relative border bg-[#030914]/75 backdrop-blur-xl px-3 py-2 md:px-5 md:py-3 flex items-center justify-center md:justify-between"
        style={{ borderColor: `${color}30` }}
      >
        {/* Left: date block (yalnız masaüstü) */}
        <div className="hidden md:flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full border flex items-center justify-center"
            style={{ borderColor: `${color}50` }}
          >
            <span className="font-mono text-sm font-bold" style={{ color }}>
              {day}
            </span>
          </div>
          <div className="leading-tight">
            <p className="text-[9px] tracking-[0.2em] text-white/40 font-mono">
              {dayName}
            </p>
            <p className="text-[9px] tracking-[0.2em] font-mono" style={{ color }}>
              {monthName}
            </p>
          </div>
        </div>

        {/* Center: wordmark + clock */}
        <div className="flex flex-col items-center">
          <span
            className="text-xs md:text-sm font-mono font-bold tracking-[0.25em] md:tracking-[0.4em]"
            style={{ color, textShadow: `0 0 14px ${color}` }}
          >
            J.A.R.V.I.S
          </span>
          <div className="flex items-center gap-2 mt-1">
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span className="font-mono text-base md:text-lg tabular-nums text-white/85">
              {time}
            </span>
            <span
              className="text-[8px] tracking-[0.2em] font-mono ml-1"
              style={{ color }}
            >
              {STATE_LABELS[state]}
            </span>
          </div>
        </div>

        {/* Right: system gauges (yalnız masaüstü) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right leading-tight mr-1">
            <p className="text-[9px] tracking-[0.2em] text-white/40 font-mono">
              {location}
            </p>
            <p className="text-[9px] tracking-[0.2em] font-mono" style={{ color }}>
              SECURE LINK
            </p>
          </div>
          <GaugeRing value={cpu} size={46} strokeWidth={2.5} color={color} label="CPU" />
          <GaugeRing value={memory} size={46} strokeWidth={2.5} color={color} label="MEM" />
        </div>

        {/* Decorative corners */}
        <div
          className="absolute -top-px -left-px w-3 h-3 border-l border-t"
          style={{ borderColor: color }}
        />
        <div
          className="absolute -top-px -right-px w-3 h-3 border-r border-t"
          style={{ borderColor: color }}
        />
        <div
          className="absolute -bottom-px -left-px w-3 h-3 border-l border-b"
          style={{ borderColor: color }}
        />
        <div
          className="absolute -bottom-px -right-px w-3 h-3 border-r border-b"
          style={{ borderColor: color }}
        />
      </div>
    </motion.header>
  );
}