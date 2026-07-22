export const DEFAULT_PAYOUT_SCALE = 0.3;

/** Stake tham chiếu khi ước lượng RTP (khớp floor payout thực tế hơn xu đặt nhỏ). */
export const RTP_REFERENCE_STAKE = 10_000;

export interface ArcanaRtpSlot {
  id: number;
  ratio: number;
  weight: number;
}

export interface RtpPickRow {
  pickCount: number;
  /** Xác suất thắng nếu chọn k ô có tổng weight cao nhất (gần đúng với chọn tối ưu) */
  winProbability: number;
  /** RTP kỳ vọng (1 = hòa vốn) — chiến lược chọn k ô đầu tiên theo id */
  rtpSequential: number;
  /** RTP kỳ vọng — chọn k ô có w×ratio cao nhất */
  rtpOptimal: number;
}

export function totalWeight(slots: ArcanaRtpSlot[]): number {
  return slots.reduce((s, x) => s + Math.max(0, x.weight), 0);
}

/** Thưởng khi trúng: stake × ratio ÷ số ô chọn × payoutScale */
export function computeArcanaPayout(
  stake: number,
  ratio: number,
  pickCount: number,
  payoutScale: number,
): number {
  const k = Math.max(1, Math.floor(pickCount));
  const scale = Math.max(0.01, Math.min(2, payoutScale));
  const raw = (stake * ratio * scale) / k;
  return Math.max(0, Math.floor(raw));
}

function rtpForPickIds(
  slots: ArcanaRtpSlot[],
  pickIds: number[],
  payoutScale: number,
): { winProbability: number; rtp: number } {
  const W = totalWeight(slots);
  if (W <= 0 || pickIds.length === 0) {
    return { winProbability: 0, rtp: 0 };
  }
  const k = pickIds.length;
  let winProb = 0;
  let rtpSum = 0;
  const ref = RTP_REFERENCE_STAKE;
  for (const slot of slots) {
    const w = Math.max(0, slot.weight);
    if (!pickIds.includes(slot.id)) continue;
    winProb += w / W;
    rtpSum +=
      ((w / W) * computeArcanaPayout(ref, slot.ratio, k, payoutScale)) / ref;
  }
  return { winProbability: winProb, rtp: rtpSum };
}

/** Chọn k id đầu tiên (1..k) */
function sequentialPickIds(slots: ArcanaRtpSlot[], k: number): number[] {
  return slots
    .slice(0, k)
    .map((s) => s.id)
    .filter((id) => id > 0);
}

/** Chọn k ô có w×ratio cao nhất */
function optimalPickIds(slots: ArcanaRtpSlot[], k: number): number[] {
  return [...slots]
    .sort((a, b) => b.weight * b.ratio - a.weight * a.ratio)
    .slice(0, k)
    .map((s) => s.id);
}

export interface StreakRtpOptions {
  enabled: boolean;
  minStreak: number;
  percentPerStep: number;
  capPercent: number;
}

function streakBonusPct(
  streakBefore: number,
  won: boolean,
  streak: StreakRtpOptions,
): number {
  if (!won || !streak.enabled) return 0;
  const min = Math.max(1, Math.floor(streak.minStreak));
  if (streakBefore < min) return 0;
  const steps = streakBefore - min + 1;
  return Math.min(streak.capPercent, steps * streak.percentPerStep);
}

export function computeRtpPreview(
  slots: ArcanaRtpSlot[],
  pickMin: number,
  pickMax: number,
  payoutScale: number,
  streak?: StreakRtpOptions,
): RtpPickRow[] {
  const min = Math.max(1, Math.floor(pickMin));
  const max = Math.max(min, Math.floor(pickMax));
  const scale = Math.max(0.01, Math.min(2, payoutScale));
  const rows: RtpPickRow[] = [];
  for (let k = min; k <= max; k++) {
    const seq = rtpForPickIds(slots, sequentialPickIds(slots, k), scale);
    const opt = rtpForPickIds(slots, optimalPickIds(slots, k), scale);
    let rtpSeq = seq.rtp;
    let rtpOpt = opt.rtp;
    if (streak?.enabled) {
      rtpSeq =
        simulateRtp(
          slots,
          sequentialPickIds(slots, k),
          scale,
          5000,
          streak,
        ) / 100;
      rtpOpt =
        simulateRtp(slots, optimalPickIds(slots, k), scale, 5000, streak) /
        100;
    }
    rows.push({
      pickCount: k,
      winProbability: Math.round(opt.winProbability * 1000) / 10,
      rtpSequential: Math.round(rtpSeq * 1000) / 10,
      rtpOptimal: Math.round(rtpOpt * 1000) / 10,
    });
  }
  return rows;
}

/** Monte Carlo RTP ước lượng (pickIds cố định). */
export function simulateRtp(
  slots: ArcanaRtpSlot[],
  pickIds: number[],
  payoutScale: number,
  rounds = 10_000,
  streak?: StreakRtpOptions,
): number {
  const W = totalWeight(slots);
  if (W <= 0 || pickIds.length === 0 || rounds <= 0) return 0;
  let payoutTotal = 0;
  const stake = RTP_REFERENCE_STAKE;
  let luckStreak = 0;
  for (let i = 0; i < rounds; i++) {
    const streakBefore = luckStreak;
    let r = Math.floor(Math.random() * W);
    let winSlot = slots[0]!;
    for (const slot of slots) {
      const w = Math.max(0, slot.weight);
      if (r < w) {
        winSlot = slot;
        break;
      }
      r -= w;
    }
    const won = pickIds.includes(winSlot.id);
    if (won) {
      const base = computeArcanaPayout(
        stake,
        winSlot.ratio,
        pickIds.length,
        payoutScale,
      );
      const pct = streak
        ? streakBonusPct(streakBefore, true, streak)
        : 0;
      payoutTotal +=
        pct > 0 ? Math.floor(base * (1 + pct / 100)) : base;
      luckStreak = Math.max(0, luckStreak) + 1;
    } else {
      luckStreak = Math.min(0, luckStreak) - 1;
    }
  }
  return Math.round((payoutTotal / rounds / stake) * 1000) / 10;
}
