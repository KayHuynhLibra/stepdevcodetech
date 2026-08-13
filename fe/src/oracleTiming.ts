/**
 * Client-side timing tip (mirrors server oracleTiming).
 */

export type TimingHint = {
  id: string;
  labelVi: string;
  suit?: string;
  number?: number;
  key?: string;
  hint: string;
  sort: number;
};

export function pickTimingHint(
  cards: { suit?: string; number?: number; key?: string }[],
  rules: TimingHint[],
): string | null {
  if (!cards.length || !rules.length) return null;
  const focus = cards[0]!;
  const scored = rules
    .map((r) => {
      let score = 0;
      if (r.key && focus.key === r.key) score += 10;
      if (r.number != null && focus.number === r.number) score += 5;
      if (r.suit && (focus.suit ?? "major") === r.suit) score += 3;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.sort - b.r.sort);
  return scored[0]?.r.hint ?? null;
}
