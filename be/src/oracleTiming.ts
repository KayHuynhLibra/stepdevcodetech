/**
 * Timing tip rules — gợi ý khung thời gian khi đọc bài (disclaimer giải trí).
 * Nguồn cảm hứng: «Dự đoán thời gian trong Tarot».
 */

export type TimingHint = {
  id: string;
  labelVi: string;
  /** suit match (major/wands/…) hoặc "*" */
  suit?: string;
  /** number match; undefined = any */
  number?: number;
  /** major key match */
  key?: string;
  hint: string;
  sort: number;
};

export const DEFAULT_TIMING_RULES: TimingHint[] = [
  {
    id: "wands-fast",
    labelVi: "Gậy / Lửa",
    suit: "wands",
    hint: "Thường gắn khung ngắn: vài ngày đến khoảng 2 tuần.",
    sort: 1,
  },
  {
    id: "cups-flow",
    labelVi: "Cốc / Nước",
    suit: "cups",
    hint: "Nhịp cảm xúc: khoảng 1–4 tuần, tùy dòng chảy quan hệ.",
    sort: 2,
  },
  {
    id: "swords-mind",
    labelVi: "Kiếm / Khí",
    suit: "swords",
    hint: "Quyết định/tư duy: vài ngày đến khoảng 3 tuần.",
    sort: 3,
  },
  {
    id: "pentacles-slow",
    labelVi: "Tiền / Đất",
    suit: "pentacles",
    hint: "Vật chất/công việc: thường chậm hơn — khoảng 1–3 tháng.",
    sort: 4,
  },
  {
    id: "major-cycle",
    labelVi: "Major",
    suit: "major",
    hint: "Bài học lớn: khung chu kỳ — vài tuần đến vài tháng.",
    sort: 5,
  },
  {
    id: "ace-seed",
    labelVi: "Át",
    number: 1,
    hint: "Khởi đầu: tín hiệu có thể nảy trong 1–2 tuần tới.",
    sort: 6,
  },
  {
    id: "wheel",
    labelVi: "Bánh xe",
    key: "wheel",
    hint: "Đổi vận: bước ngoặt có thể tới trong vòng một tháng.",
    sort: 7,
  },
  {
    id: "tower",
    labelVi: "Tháp",
    key: "tower",
    hint: "Đột biến: thay đổi có thể xảy ra rất nhanh (ngày–tuần).",
    sort: 8,
  },
];

export function pickTimingHint(
  cards: { suit?: string; number?: number; key?: string }[],
  rules: TimingHint[] = DEFAULT_TIMING_RULES,
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
  return scored[0]?.r.hint ?? rules.find((r) => r.suit === "major")?.hint ?? null;
}
