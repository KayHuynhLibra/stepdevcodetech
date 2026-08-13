/** Gợi ý UX rule-based cho bàn Tarot (không LLM). */

export type PlayTipContext = {
  phase: "placing" | "revealing" | "payout";
  secondsLeft: number;
  lossStreak: number;
  winStreak: number;
  warmActive: boolean;
  hotCardIds: number[];
  coldCardIds: number[];
  isVip: boolean;
};

const CHAT_SUGGESTS_POOL = [
  "Chúc cả phòng may mắn",
  "Ván này theo cảm",
  "Ai cũng vui là được",
  "Từ từ thôi bạn ơi",
  "Cầu đẹp quá",
];

export function buildPlayTips(ctx: PlayTipContext): string[] {
  const tips: string[] = [];

  // Tip ổn định trước (tránh đổi dòng 1 mỗi giây vì countdown)
  if (ctx.lossStreak >= 3) {
    tips.push(
      ctx.warmActive
        ? "Chuỗi thua dài — cân nhắc giảm cược hoặc nghỉ ngắn."
        : "Đang thua liên tiếp — chơi nhẹ tay hơn một chút.",
    );
  }
  if (ctx.winStreak >= 3) {
    tips.push("Chuỗi thắng tốt — giữ nhịp, đừng tăng quá nhanh.");
  }
  if (ctx.hotCardIds.length > 0 && ctx.phase === "placing") {
    tips.push(`Lá đang nóng: #${ctx.hotCardIds.slice(0, 2).join(", #")}.`);
  }
  if (ctx.coldCardIds.length > 0 && ctx.phase === "placing" && tips.length < 2) {
    tips.push(`Lá đang lạnh: #${ctx.coldCardIds.slice(0, 2).join(", #")}.`);
  }
  if (ctx.isVip && ctx.phase === "placing" && tips.length === 0) {
    tips.push("VIP: bạn có thể chat bay (mode VIP) khi muốn.");
  }
  // Countdown chỉ khi chưa có tip khác — giảm nhảy chữ mỗi tick
  if (
    tips.length === 0 &&
    ctx.phase === "placing" &&
    ctx.secondsLeft <= 8 &&
    ctx.secondsLeft > 0
  ) {
    tips.push("Sắp khóa ván — kiểm tra lại lá đã đặt.");
  }
  if (tips.length === 0 && ctx.phase === "placing") {
    tips.push("Đặt xu trước khi hết giờ — tối đa vài lá mỗi ván.");
  }

  return tips.slice(0, 2);
}

export function buildChatSuggests(ctx: PlayTipContext): string[] {
  const out: string[] = [];
  if (ctx.winStreak >= 2) out.push("May quá!");
  if (ctx.lossStreak >= 2) out.push("Từ từ thôi bạn ơi");
  if (ctx.phase === "placing" && ctx.secondsLeft <= 10) {
    out.push("Nhanh còn kịp");
  }
  // Fill từ pool
  for (const s of CHAT_SUGGESTS_POOL) {
    if (out.length >= 3) break;
    if (!out.includes(s) && Math.random() < 0.55) out.push(s);
  }
  while (out.length < 2) {
    const s =
      CHAT_SUGGESTS_POOL[Math.floor(Math.random() * CHAT_SUGGESTS_POOL.length)]!;
    if (!out.includes(s)) out.push(s);
    else break;
  }
  return out.slice(0, 3);
}
