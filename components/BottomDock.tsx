"use client";

import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Settings,
  Power,
  Volume2,
  RotateCcw,
  Pause,
  Play,
} from "lucide-react";
import { OrbState, STATE_COLORS } from "@/lib/edith-theme";

interface BottomDockProps {
  state?: OrbState;
  muted?: boolean;
  paused?: boolean;
  bottomOffset?: number;
  onToggleMic?: () => void;
  onToggleMute?: () => void;
  onTogglePause?: () => void;
  onSettings?: () => void;
  onReset?: () => void;
  onPower?: () => void;
}

export default function BottomDock({
  state = "idle",
  muted = false,
  paused = false,
  bottomOffset = 20,
  onToggleMic,
  onToggleMute,
  onTogglePause,
  onSettings,
  onReset,
  onPower,
}: BottomDockProps) {
  const color = STATE_COLORS[state];

  const items = [
    {
      icon: muted ? MicOff : Mic,
      onClick: onToggleMic,
      active: state === "listening",
      key: "mic",
    },
    { icon: Volume2, onClick: onToggleMute, active: false, key: "volume" },
    {
      icon: paused ? Play : Pause,
      onClick: onTogglePause,
      active: paused,
      key: "pause",
    },
    { icon: RotateCcw, onClick: onReset, active: false, key: "reset" },
    { icon: Settings, onClick: onSettings, active: false, key: "settings" },
    { icon: Power, onClick: onPower, active: false, key: "power" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="fixed left-1/2 -translate-x-1/2 pointer-events-auto"
      style={{ bottom: bottomOffset }}
    >
      <div
        className="flex items-center gap-3 border bg-[#030914]/75 backdrop-blur-xl px-4 py-2.5"
        style={{ borderColor: `${color}30` }}
      >
        {items.map(({ icon: Icon, onClick, active, key }) => (
          <motion.button
            key={key}
            onClick={onClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="relative w-10 h-10 rounded-full border flex items-center justify-center"
            style={{
              borderColor: active ? color : `${color}35`,
              background: active ? `${color}15` : "transparent",
            }}
          >
            {active && (
              <motion.span
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: color }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
            )}
            <Icon
              size={15}
              color={active ? color : `${color}b0`}
              strokeWidth={1.75}
            />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}