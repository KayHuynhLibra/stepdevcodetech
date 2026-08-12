import type { RitualSpreadCount } from "./oracleDeck";

export type MantraPhase =
  | "center"
  | "shuffle"
  | "pickSpread"
  | "deal"
  | "flip"
  | "closeReading"
  | "hub";

const POOLS: Record<MantraPhase, string[]> = {
  hub: [
    "Xin lửa soi đường, không xin số phận thay mình.",
    "Bài không đoán mệnh — bài soi gương tâm đang hỏi.",
    "Hít sâu một hơi. Đặt ý nguyện vào khoảng lặng giữa hai nhịp thở.",
    "Tay chạm bài như tay chạm nước: không nắm, chỉ lắng.",
  ],
  center: [
    "Đặt câu hỏi vào giữa lòng bàn tay — rồi buông nó cho bộ bài.",
    "Không cầu lời ngọt. Cầu lời thẳng đủ để bước tiếp.",
    "Ý nguyện rõ thì lá mới nói rõ. Mơ hồ thì gương cũng mờ.",
    "Hôm nay chỉ hỏi một việc. Một việc đủ nặng để đáng rút.",
  ],
  shuffle: [
    "Xào cho gió bốn phương lẫn vào từng lá…",
    "Thứ tự cũ tan. Thứ tự mới thành — giữ trọn cả bộ trong tay.",
    "Đừng chọn lá. Hãy để lá chọn đúng chỗ của nó trên bàn.",
    "Mỗi lần xào là một lần cắt mộng tưởng, giữ lại tín hiệu.",
  ],
  pickSpread: [
    "Chọn kiểu trải như chọn khung cửa sổ nhìn vào câu hỏi.",
    "Ít lá thì sắc. Nhiều lá thì rộng. Đừng trải quá sức mình đọc.",
    "Celtic Cross không phải để khoe — chỉ dùng khi chuyện đủ sâu.",
    "Ba lá đủ cho dòng thời gian. Năm lá đủ cho hai phía một mối.",
  ],
  deal: [
    "Rút từ đỉnh chồng — lá đầu là lá đã được gọi.",
    "Đặt lá đúng vị trí. Vị trí mới là miệng nói của bài.",
    "Không đổi chỗ. Không rút lại. Nghi thức bắt đầu khi lá chạm bàn.",
  ],
  flip: [
    "Lật chậm. Nghĩa hiện dần như mực thấm giấy.",
    "Xuôi hay ngược đều là mặt thật của cùng một bài học.",
    "Đọc vị trí trước, đọc lá sau — kẻo lẫn tiếng vọng.",
  ],
  closeReading: [
    "Khép vòng: mang lời bài về đời thật, đừng để lại trên bàn.",
    "Bài đã nói phần nó. Phần còn lại thuộc về lựa chọn của bạn.",
    "Ghi lại một dòng. Ngày sau nhìn lại sẽ thấy đường đã đi.",
    "Cảm ơn bộ bài. Cảm ơn khoảng lặng. Buông nghi thức, giữ sáng suốt.",
  ],
};

const SPREAD_HINT: Partial<Record<RitualSpreadCount, string>> = {
  1: "Một lá — câu hỏi thẳng, một câu trả lời đủ nặng.",
  2: "Hai lá — năng lượng và lời khuyên.",
  3: "Quá khứ · Hiện tại · Tương lai — dòng chảy thời gian.",
  5: "Bạn · Đối phương · Quan hệ · Thách thức · Lời khuyên.",
  10: "Celtic Cross — thập tự trung tâm và cột staff chín–mười.",
};

export const ORACLE_DISCLAIMER =
  "Giải trí chiêm tinh / Tarot — không thay tư vấn y tế, pháp lý hay tài chính.";

function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Chọn khẩu quyết ổn định theo seed (không nhảy mỗi render). */
export function pickMantra(
  phase: MantraPhase,
  seed: string | number = 0,
): string {
  const pool = POOLS[phase];
  if (!pool.length) return "";
  const i = hashSeed(`${phase}:${seed}`) % pool.length;
  return pool[i]!;
}

export function spreadMantraHint(
  spread: RitualSpreadCount | number | string,
  blurb?: string,
): string {
  if (blurb) return blurb;
  const n = typeof spread === "number" ? spread : Number(spread);
  if (Number.isFinite(n) && SPREAD_HINT[n as RitualSpreadCount]) {
    return SPREAD_HINT[n as RitualSpreadCount]!;
  }
  return "Chọn khung trải vừa với độ sâu câu hỏi.";
}

export function formatReadingPlain(opts: {
  title?: string;
  question?: string;
  deckName?: string;
  spread?: string;
  at?: number;
  mantraClose?: string;
  timingHint?: string;
  cards: {
    position?: string;
    nameVi: string;
    reversedDraw: boolean;
    meaning: string;
    keywords?: string[];
  }[];
  notes?: string;
}): string {
  const lines: string[] = [];
  lines.push(opts.title || "Kết quả bói bài");
  if (opts.at) {
    lines.push(new Date(opts.at).toLocaleString("vi-VN"));
  }
  if (opts.deckName) lines.push(`Bộ: ${opts.deckName}`);
  if (opts.spread) {
    const n = Number(opts.spread);
    lines.push(
      Number.isFinite(n) && n > 0
        ? `Trải: ${n} lá`
        : `Trải: ${opts.spread} (${opts.cards.length} lá)`,
    );
  }
  if (opts.question) lines.push(`Câu hỏi: ${opts.question}`);
  lines.push("");
  for (const c of opts.cards) {
    lines.push(
      `• ${c.position ?? "Lá"} — ${c.nameVi} (${c.reversedDraw ? "Ngược" : "Xuôi"})`,
    );
    lines.push(`  ${c.meaning}`);
    if (c.keywords?.length) {
      lines.push(`  Từ khóa: ${c.keywords.slice(0, 6).join(", ")}`);
    }
    lines.push("");
  }
  if (opts.mantraClose) {
    lines.push(`Khép vòng: ${opts.mantraClose}`);
    lines.push("");
  }
  if (opts.timingHint) {
    lines.push(`Gợi ý thời gian: ${opts.timingHint}`);
    lines.push("");
  }
  if (opts.notes) {
    lines.push(`Ghi chú: ${opts.notes}`);
    lines.push("");
  }
  lines.push(ORACLE_DISCLAIMER);
  return lines.join("\n");
}
