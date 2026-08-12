/** Tone chủ đạo + glyph CSS (không tải ảnh lobby). */
export type GameTone = {
  /** Màu điểm nhấn (viền / active / CTA) */
  accent: string;
  /** Chữ trên nền sáng */
  ink: string;
  /** Nền mềm thẻ */
  soft: string;
  /** Nền đậm khi active */
  deep: string;
  /** Chữ trên nền đậm */
  onDeep: string;
  /** Glyph ngắn trong mark */
  glyph: string;
  /** Font display tên game */
  display: "serif" | "sans";
};

const FALLBACK: GameTone = {
  accent: "#b8860b",
  ink: "#3a2210",
  soft: "#fff8ec",
  deep: "#3a2210",
  onDeep: "#fff4e0",
  glyph: "◆",
  display: "sans",
};

/** Khớp brand từng bàn — dùng cho TableNav + GameLobby. */
export const GAME_TONES: Record<string, GameTone> = {
  tarot: {
    accent: "#c9a227",
    ink: "#3a2210",
    soft: "#fff6e4",
    deep: "#5c3a14",
    onDeep: "#fff4e0",
    glyph: "★",
    display: "serif",
  },
  arcana: {
    accent: "#9b6bff",
    ink: "#2a1848",
    soft: "#f4ecff",
    deep: "#4a2080",
    onDeep: "#f8f0ff",
    glyph: "◎",
    display: "serif",
  },
  olympus: {
    accent: "#f0c14a",
    ink: "#1a1230",
    soft: "#fff7e6",
    deep: "#2a1848",
    onDeep: "#ffe9a8",
    glyph: "⚡",
    display: "sans",
  },
  ludo: {
    accent: "#d4483a",
    ink: "#3a2210",
    soft: "#faf3e8",
    deep: "#5c3a1a",
    onDeep: "#fff4e0",
    glyph: "▣",
    display: "sans",
  },
  "oan-quan": {
    accent: "#2f6b3a",
    ink: "#2a1a0c",
    soft: "#e8f0e4",
    deep: "#6b4f2a",
    onDeep: "#f5f5e8",
    glyph: "◉",
    display: "serif",
  },
  uno: {
    accent: "#e63946",
    ink: "#1a1a2e",
    soft: "#fff0f0",
    deep: "#1a4d3e",
    onDeep: "#f8f4e8",
    glyph: "⬡",
    display: "sans",
  },
  boi: {
    accent: "#8b5cf6",
    ink: "#1e1238",
    soft: "#f3eeff",
    deep: "#3b1d6e",
    onDeep: "#f5f0ff",
    glyph: "☽",
    display: "serif",
  },
};

export function gameTone(id: string): GameTone {
  return GAME_TONES[id] ?? FALLBACK;
}
