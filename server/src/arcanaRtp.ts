export const DEFAULT_PAYOUT_SCALE = 0.3;

/** Stake tham chiếu khi ước lượng RTP (khớp floor payout thực tế hơn cược nhỏ). */
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

export function computeRtpPreview(
  slots: ArcanaRtpSlot[],
  pickMin: number,
  pickMax: number,
  payoutScale: number,
): RtpPickRow[] {
  const min = Math.max(1, Math.floor(pickMin));
  const max = Math.max(min, Math.floor(pickMax));
  const scale = Math.max(0.01, Math.min(2, payoutScale));
  const rows: RtpPickRow[] = [];
  for (let k = min; k <= max; k++) {
    const seq = rtpForPickIds(slots, sequentialPickIds(slots, k), scale);
    const opt = rtpForPickIds(slots, optimalPickIds(slots, k), scale);
    rows.push({
      pickCount: k,
      winProbability: Math.round(opt.winProbability * 1000) / 10,
      rtpSequential: Math.round(seq.rtp * 1000) / 10,
      rtpOptimal: Math.round(opt.rtp * 1000) / 10,
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
): number {
  const W = totalWeight(slots);
  if (W <= 0 || pickIds.length === 0 || rounds <= 0) return 0;
  let payoutTotal = 0;
  const stake = RTP_REFERENCE_STAKE;
  for (let i = 0; i < rounds; i++) {
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
    if (pickIds.includes(winSlot.id)) {
      payoutTotal += computeArcanaPayout(
        stake,
        winSlot.ratio,
        pickIds.length,
        payoutScale,
      );
    }
  }
  return Math.round((payoutTotal / rounds / stake) * 1000) / 10;
}
