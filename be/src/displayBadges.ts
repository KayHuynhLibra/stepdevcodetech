/** Huy hiệu cosmetic — không liên quan role / grants. */

export const DISPLAY_BADGE_IDS = [
  "star",
  "crown",
  "flame",
  "moon",
  "spark",
  "shield",
  "heart",
  "rose",
  "diamond",
  "fox",
  "lotus",
  "bolt",
] as const;

export type DisplayBadgeId = (typeof DISPLAY_BADGE_IDS)[number];

export interface DisplayBadgeDef {
  id: DisplayBadgeId;
  label: string;
  glyph: string;
  tone: string;
}

export const DISPLAY_BADGE_PRESETS: DisplayBadgeDef[] = [
  { id: "star", label: "Sao", glyph: "★", tone: "gold" },
  { id: "crown", label: "Vương", glyph: "♛", tone: "royal" },
  { id: "flame", label: "Lửa", glyph: "🔥", tone: "fire" },
  { id: "moon", label: "Trăng", glyph: "☾", tone: "moon" },
  { id: "spark", label: "Tia", glyph: "✦", tone: "spark" },
  { id: "shield", label: "Khiên", glyph: "⛨", tone: "steel" },
  { id: "heart", label: "Tim", glyph: "♥", tone: "heart" },
  { id: "rose", label: "Hồng", glyph: "❀", tone: "rose" },
  { id: "diamond", label: "Kim", glyph: "◆", tone: "ice" },
  { id: "fox", label: "Hồ", glyph: "🦊", tone: "fox" },
  { id: "lotus", label: "Sen", glyph: "🪷", tone: "lotus" },
  { id: "bolt", label: "Sét", glyph: "⚡", tone: "bolt" },
];

const ID_SET = new Set<string>(DISPLAY_BADGE_IDS);
export const DISPLAY_BADGE_MAX = 4;

export function normalizeDisplayBadge(raw: unknown): DisplayBadgeId | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return ID_SET.has(s) ? (s as DisplayBadgeId) : null;
}

export function normalizeDisplayBadges(raw: unknown): DisplayBadgeId[] {
  if (!Array.isArray(raw)) return [];
  const out: DisplayBadgeId[] = [];
  const seen = new Set<DisplayBadgeId>();
  for (const item of raw) {
    const id = normalizeDisplayBadge(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= DISPLAY_BADGE_MAX) break;
  }
  return out;
}

export function displayBadgeDef(id: string): DisplayBadgeDef | undefined {
  return DISPLAY_BADGE_PRESETS.find((b) => b.id === id);
}
