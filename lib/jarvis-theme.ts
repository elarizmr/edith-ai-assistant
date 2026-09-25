export type OrbState = "idle" | "listening" | "thinking" | "speaking";


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