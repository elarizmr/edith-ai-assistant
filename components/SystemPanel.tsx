"use client";

import { motion } from "framer-motion";
import { OrbState, STATE_COLORS, STATE_LABELS } from "@/lib/jarvis-theme";
import GaugeRing from "./GaugeRing";

interface SystemPanelProps {
  state?: OrbState;
}

export default function SystemPanel({ state = "idle" }: SystemPanelProps) {
  const color = STATE_COLORS[state];

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed left-5 top-1/2 -translate-y-1/2 w-64 hidden lg:block pointer-events-auto"
    >
      <div
        className="relative border bg-[#030914]/75 backdrop-blur-xl"
        style={{ borderColor: `${color}30` }}
      >
        {/* Header */}
        <div
          className="border-b px-4 py-3 flex items-center justify-between"
          style={{ borderColor: `${color}30` }}
        >
          <span
            className="text-[10px] tracking-[0.25em] font-mono"
            style={{ color }}
          >
            SYSTEM SETTINGS
          </span>
          <span className="text-[9px] font-mono" style={{ color: `${color}c0` }}>
            J.A.R.V.I.S
          </span>
        </div>

        <div className="p-4 space-y-5">
          {/* Time */}
          <div>
            <p className="text-[9px] font-mono tracking-widest" style={{ color: `${color}b0` }}>
              TIME
            </p>
            <div className="mt-1 text-2xl font-mono" style={{ color }}>
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <p className="text-[9px] text-white/30 font-mono mt-1">LOCAL SYSTEM TIME</p>
          </div>

          {/* System status */}
          <div>
            <p className="text-[9px] font-mono tracking-widest" style={{ color: `${color}b0` }}>
              SYSTEM STATUS
            </p>
            <div className="mt-2 flex items-center gap-2">
              <motion.span
                className="w-2 h-2 rounded-full"
                style={{ background: color }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-xs font-mono" style={{ color }}>
                ONLINE
              </span>
            </div>
          </div>

          {/* Current mode */}
          <div>
            <p className="text-[9px] font-mono tracking-widest" style={{ color: `${color}b0` }}>
              CURRENT MODE
            </p>
            <div
              className="mt-2 border p-2"
              style={{ borderColor: `${color}18`, background: `${color}0a` }}
            >
              <span className="text-xs text-white/70 font-mono">
                {STATE_LABELS[state]}
              </span>
            </div>
          </div>

          {/* Gauges */}
          <div className="flex items-center justify-around pt-1">
            <GaugeRing value={42} size={64} strokeWidth={3} color={color} label="CPU" />
            <GaugeRing value={68} size={64} strokeWidth={3} color={color} label="MEMORY" />
          </div>

          {/* Network */}
          <div>
            <p className="text-[9px] font-mono tracking-widest" style={{ color: `${color}b0` }}>
              NETWORK
            </p>
            <p className="text-xs text-white/50 font-mono mt-1">SECURE CONNECTION</p>
          </div>

          {/* Bottom info */}
          <div className="pt-3 border-t" style={{ borderColor: `${color}18` }}>
            <p className="text-[8px] leading-4 text-white/25 font-mono">
              J.A.R.V.I.S CORE SYSTEM
              <br />
              VOICE INTERFACE ACTIVE
              <br />
              AI PROCESSING READY
            </p>
          </div>
        </div>

        {/* Decorative corners */}
        <div className="absolute -top-px -left-px w-3 h-3 border-l border-t" style={{ borderColor: color }} />
        <div className="absolute -top-px -right-px w-3 h-3 border-r border-t" style={{ borderColor: color }} />
        <div className="absolute -bottom-px -left-px w-3 h-3 border-l border-b" style={{ borderColor: color }} />
        <div className="absolute -bottom-px -right-px w-3 h-3 border-r border-b" style={{ borderColor: color }} />
      </div>
    </motion.aside>
  );
}