export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Single source of truth for the state -> color mapping.
 * Every HUD component imports this so the whole interface
 * shifts color together (background, orb, side panels, dock).
 */
export const STATE_COLORS: Record<OrbState, string> = {
  idle: "#3b82f6", // blue
  listening: "#22d3ee", // cyan
  thinking: "#a855f7", // purple
  speaking: "#22c55e", // green
};

export const STATE_LABELS: Record<OrbState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "SPEAKING",
};

export function getStateColor(state: OrbState = "idle") {
  return STATE_COLORS[state];
}