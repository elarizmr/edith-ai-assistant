"use client";

import { motion } from "framer-motion";
import { OrbState, STATE_COLORS } from "@/lib/jarvis-theme";

interface ConversationPanelProps {
  transcript: string;
  state?: OrbState;
}

export default function ConversationPanel({
  transcript,
  state = "idle",
}: ConversationPanelProps) {
  const color = STATE_COLORS[state];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed right-5 top-1/2 -translate-y-1/2 w-72 hidden lg:block pointer-events-auto"
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
          <span className="text-[10px] tracking-[0.25em] font-mono" style={{ color }}>
            CONVERSATION
          </span>
          <span className="text-[9px] font-mono" style={{ color: `${color}c0` }}>
            {state === "speaking" ? "SPEAKING" : "READY"}
          </span>
        </div>

        {/* Conversation */}
        <div className="h-[350px] overflow-hidden p-4">
          {transcript ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <p className="text-[9px] font-mono mb-1" style={{ color: `${color}b0` }}>
                  J.A.R.V.I.S
                </p>
                <div
                  className="border p-3"
                  style={{ borderColor: `${color}18`, background: `${color}0a` }}
                >
                  <p className="text-xs leading-5 text-white/80 font-mono">{transcript}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  className="mx-auto mb-3 w-2 h-2 rounded-full"
                  style={{ background: color }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <p className="text-[9px] tracking-widest text-white/25 font-mono">
                  WAITING FOR INPUT
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="border-t px-4 py-3" style={{ borderColor: `${color}18` }}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-white/30 font-mono">VOICE CHANNEL</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((item) => (
                <motion.span
                  key={item}
                  className="w-1"
                  style={{ background: `${color}99` }}
                  animate={{ height: state === "speaking" ? [3, 12, 5, 16, 4] : 3 }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: item * 0.08 }}
                />
              ))}
            </div>
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