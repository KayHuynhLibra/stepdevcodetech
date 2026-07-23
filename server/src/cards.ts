import {
  applyWinBiasToWeights,
  effectiveWeights,
  interStore,
  isPackMode,
  isPolicyMode,
  type InterMode,
  type PolicyMode,
} from "./interStore.js";
import {
  applyEngagementToWeights,
  computeCardHeat,
  type PickEngagement,
} from "./tarotEngagement.js";
import { smartAiStore } from "./smartAiStore.js";
import type { CardDef, RoundResult } from "./types.js";
import { vaultArcana, vaultStore } from "./vaultStore.js";

export type { PickEngagement } from "./tarotEngagement.js";

/** Cường độ −2…+2 → weight hút / nhả theo liability. */
function steerByIntensity(liab: number[], intensity: number): number[] {
  const i = Math.max(-2, Math.min(2, intensity));
  if (i === 0) return CARDS.map((c) => c.weight);
  if (i <= -2) {
    return liab.map((L) => 1 / Math.pow(1 + L / 55, 3.2));
  }
  if (i === -1) {
    return liab.map((L) => 1 / Math.pow(1 + L / 70, 2.2));
  }
  if (i === 1) {
    return liab.map((L) => Math.pow(1 + L / 70, 1.6));
  }
  return liab.map((L) => Math.pow(1 + L / 55, 2.4));
}

export const CARDS: CardDef[] = [
  {
    id: 1,
    key: "magician",
    name: "The Magician",
    nameVi: "Nhà Ảo Thuật",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-01-magician.webp",
  },
  {
    id: 2,
    key: "priestess",
    name: "The High Priestess",
    nameVi: "Nữ Tư Tế",
    multiplier: 5,
    weight: 18,
    image: "/assets/cards/card-02-priestess.webp",
  },
  {
    id: 3,
    key: "empress",
    name: "The Empress",
    nameVi: "Nữ Hoàng",
    multiplier: 6,
    weight: 15,
    image: "/assets/cards/card-03-empress.webp",
  },
  {
    id: 4,
    key: "emperor",
    name: "The Emperor",
    nameVi: "Hoàng Đế",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-04-emperor.webp",
  },
  {
    id: 5,
    key: "lovers",
    name: "The Lovers",
    nameVi: "Đôi Tình Nhân",
    multiplier: 8,
    weight: 12,
    image: "/assets/cards/card-05-lovers.webp",
  },
  {
    id: 6,
    key: "chariot",
    name: "The Chariot",
    nameVi: "Chiến Xa",
    multiplier: 10,
    weight: 10,
    image: "/assets/cards/card-06-chariot.webp",
  },
  {
    id: 7,
    key: "star",
    name: "The Star",
    nameVi: "Ngôi Sao",
    multiplier: 15,
    weight: 8,
    image: "/assets/cards/card-07-star.webp",
  },
  {
    id: 8,
    key: "sun",
    name: "The Sun",
    nameVi: "Mặt Trời",
    multiplier: 20,
    weight: 7,
    image: "/assets/cards/card-08-sun.webp",
  },
];

export function getCard(id: number): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}

/** Liability = stake × hệ số nhân nếu lá đó thắng. */
export function cardLiabilities(realStakes: number[] = []): number[] {
  return CARDS.map((c, i) => Math.max(0, realStakes[i] ?? 0) * c.multiplier);
}

/** Lời nhà game nếu lá i thắng = tổng stake − trả xu lá đó. */
export function houseProfitByCard(realStakes: number[] = []): number[] {
  const totalStake = realStakes.reduce((a, b) => a + Math.max(0, b), 0);
  return cardLiabilities(realStakes).map((L) => totalStake - L);
}

/**
 * App = hút xu mềm (weight cao khi liability thấp, vẫn random).
 * Fed = đọc cầu → 100% lá app lời tối đa (min liability).
 * Hedge = soft-Fed — weight ∝ max(houseProfit,0)^2.
 * User = nhả xu (weight cao khi liability cao).
 * Không có đặt xu → fallback weight gốc.
 */
export function policyWeights(
  mode: PolicyMode,
  realStakes: number[] = [],
): number[] {
  const liab = cardLiabilities(realStakes);
  const totalStake = realStakes.reduce((a, b) => a + Math.max(0, b), 0);
  if (totalStake <= 0) return CARDS.map((c) => c.weight);

  const modeKey = mode as PolicyMode;

  if (modeKey === "fed" || modeKey === "softfed") {
    const profits = houseProfitByCard(realStakes);
    const maxProfit = Math.max(...profits);
    const mask = profits.map((p) => (p === maxProfit ? 1 : 0));
    const n = mask.reduce<number>((a, b) => a + b, 0) || 1;
    let w = mask.map((m) => (m / n) * 100);
    if (modeKey === "softfed") {
      w = w.map((x, i) => x * 0.55 + CARDS[i]!.weight * 0.45);
    }
    return w;
  }

  if (modeKey === "hedge") {
    const profits = houseProfitByCard(realStakes);
    return profits.map((p) => Math.pow(Math.max(p, 0) + 1, 2));
  }

  if (modeKey === "app") {
    return liab.map((L) => 1 / Math.pow(1 + L / 50, 3.5));
  }
  if (modeKey === "softapp") {
    return liab.map((L) => 1 / Math.pow(1 + L / 80, 2));
  }
  if (modeKey === "contrarian" || modeKey === "sparse") {
    return liab.map((L) => 1 / (1 + L));
  }
  if (modeKey === "dense" || modeKey === "momentum") {
    return liab.map((L) => Math.pow(1 + L / 30, 2));
  }
  if (modeKey === "softuser") {
    return liab.map((L) => Math.pow(1 + L / 60, 1.8));
  }
  if (modeKey === "crowdcap") {
    const totalL = liab.reduce((a, b) => a + b, 0) || 1;
    return liab.map((L) => {
      const share = L / totalL;
      const antiCrowd = Math.pow(1 - Math.min(0.85, share), 2.2);
      return (1 / (1 + L / 45)) * antiCrowd + 0.08;
    });
  }
  if (modeKey === "vaultguard") {
    const net = vaultStore.getSnapshot().netFromPlay ?? 0;
    if (net < -50_000) {
      return liab.map((L) => 1 / Math.pow(1 + L / 65, 2.6));
    }
    if (net > 80_000) {
      return liab.map((L) => Math.pow(1 + L / 65, 1.7));
    }
    return CARDS.map((c) => c.weight);
  }
  if (modeKey === "vaultpct") {
    const h = vaultStore.getHealth();
    return steerByIntensity(liab, h.steerIntensity);
  }
  if (modeKey === "flowguard") {
    const h = vaultStore.getHealth();
    // Ưu tiên dòng 1h; nếu giờ trung tính thì nhìn 24h
    let intensity = 0;
    if (h.flowHourEdgePct <= -8) intensity = -2;
    else if (h.flowHourEdgePct <= -3) intensity = -1;
    else if (h.flowHourEdgePct >= 15) intensity = 2;
    else if (h.flowHourEdgePct >= 6) intensity = 1;
    else if (h.flowDayEdgePct <= -10) intensity = -1;
    else if (h.flowDayEdgePct >= 12) intensity = 1;
    return steerByIntensity(liab, intensity);
  }
  if (modeKey === "moneysteer") {
    const tarot = vaultStore.getHealth();
    const arc = vaultArcana.getHealth();
    const tarotFlags = vaultStore.getInterFlags();
    const arcFlags = vaultArcana.getInterFlags();
    let sum = 0;
    let wSum = 0;
    if (tarotFlags.interSignal) {
      const w = tarotFlags.interWeightPct / 100;
      sum += tarot.steerIntensity * w;
      wSum += w;
    }
    if (arcFlags.interSignal) {
      const w = arcFlags.interWeightPct / 100;
      sum += arc.steerIntensity * w;
      wSum += w;
    }
    if (wSum <= 0) {
      // không flag → chỉ Tarot
      return steerByIntensity(liab, tarot.steerIntensity);
    }
    const blended = Math.round(sum / wSum);
    return steerByIntensity(liab, blended);
  }
  return liab.map((L) => Math.pow(1 + L / 50, 3.5));
}

/** Hot: tăng lá vừa thắng (ngược cool nhẹ). */
export function hotWeights(
  baseWeights: number[],
  recentWins: number[] = [],
): number[] {
  const hotIds = new Set(recentWins.slice(0, 3));
  return baseWeights.map((w, i) => {
    const id = CARDS[i]!.id;
    return hotIds.has(id) ? w * 1.85 : w;
  });
}

/** Wild: 2 lá ngẫu nhiên chiếm ~90% xác suất. */
export function wildWeights(baseWeights: number[]): number[] {
  const i1 = Math.floor(Math.random() * CARDS.length);
  let i2 = Math.floor(Math.random() * CARDS.length);
  if (i2 === i1) i2 = (i2 + 1) % CARDS.length;
  return baseWeights.map((w, i) => {
    if (i === i1 || i === i2) return w * 8;
    return w * 0.15;
  });
}

/** Cool: giảm mạnh weight các lá thắng gần nhất. */
export function coolWeights(
  baseWeights: number[],
  recentWins: number[] = [],
): number[] {
  const coolIds = new Set(recentWins.slice(0, 3));
  return baseWeights.map((w, i) => {
    const id = CARDS[i]!.id;
    return coolIds.has(id) ? w * 0.12 : w;
  });
}

/**
 * FogBreak — bẻ cầu mềm, nhìn như ngẫu nhiên:
 * - Giảm nhẹ lá thắng gần đây (nhẹ hơn cool)
 * - Giảm nhẹ lá đang bị pile stake (nhẹ hơn crowdcap)
 * - Nhiễu nhân từng ván
 * - ~18% ván “thả cầu” gần như không can thiệp → không lộ pattern luôn bẻ
 */
export function fogBreakWeights(
  baseWeights: number[],
  realStakes: number[] = [],
  recentWins: number[] = [],
): number[] {
  // Thỉnh thoảng để cầu chạy — tránh cảm giác “cứ ngược”
  if (Math.random() < 0.18) {
    return baseWeights.map((w) => w * (0.85 + Math.random() * 0.35));
  }

  const recent = recentWins.slice(0, 5);
  const streakMul = (cardId: number): number => {
    const pos = recent.indexOf(cardId);
    if (pos < 0) return 1;
    // pos 0 = vừa thắng → giảm nhẹ; càng xa càng ít
    if (pos === 0) return 0.55;
    if (pos === 1) return 0.7;
    if (pos === 2) return 0.82;
    return 0.92;
  };

  const totalStake = realStakes.reduce((a, b) => a + Math.max(0, b), 0);
  return baseWeights.map((w, i) => {
    const id = CARDS[i]!.id;
    let m = streakMul(id);
    if (totalStake > 0) {
      const share = Math.max(0, realStakes[i] ?? 0) / totalStake;
      // Đám đông theo cầu → hạ nhẹ, không cắt sạch
      if (share >= 0.35) m *= 0.62;
      else if (share >= 0.22) m *= 0.78;
      else if (share <= 0.04) m *= 1.18; // lá vắng → nhích lên
    }
    // Nhiễu — mỗi ván khác nhau
    const noise = 0.78 + Math.random() * 0.5;
    return Math.max(0.05, w * m * noise);
  });
}

/**
 * SmartAI — online weights từ affinity + feature (cầu/stake/heat/kho).
 * ~15% thả cầu gần như base+noise để không lộ pattern.
 */
export function smartAiWeights(
  baseWeights: number[],
  realStakes: number[] = [],
  recentWins: number[] = [],
  history: RoundResult[] = [],
): number[] {
  if (Math.random() < 0.15) {
    return baseWeights.map((w) => w * (0.85 + Math.random() * 0.4));
  }

  const affinity = smartAiStore.getAffinity();
  const coeffs = smartAiStore.getCoeffs();
  const heat = computeCardHeat(
    history.length > 0
      ? history
      : recentWins.map((win, i) => ({ round: i, win })),
  );
  const totalStake = realStakes.reduce((a, b) => a + Math.max(0, b), 0);
  const liab = cardLiabilities(realStakes);
  const maxLiab = Math.max(1, ...liab);
  const vaultNet =
    vaultStore.getSnapshot().netFromPlay ??
    vaultStore.getSnapshot().netHouse ??
    0;
  // −1 (kho lỗ nặng) … +1 (kho lãi)
  const vaultEdge = Math.max(-1, Math.min(1, vaultNet / 200_000));

  const recent = recentWins.slice(0, 5);
  const coolMul = (cardId: number): number => {
    const pos = recent.indexOf(cardId);
    if (pos < 0) return 1;
    if (pos === 0) return 1 - 0.45 * coeffs.cool;
    if (pos === 1) return 1 - 0.3 * coeffs.cool;
    if (pos === 2) return 1 - 0.15 * coeffs.cool;
    return 1;
  };

  return baseWeights.map((w, i) => {
    const id = CARDS[i]!.id;
    let m = (affinity[i] ?? 1) * coolMul(id);

    const h = heat[i]?.level ?? "neutral";
    if (h === "hot") m *= 1 + 0.25 * coeffs.heat;
    else if (h === "cold") m *= 1 - 0.2 * coeffs.heat;

    if (totalStake > 0) {
      const share = Math.max(0, realStakes[i] ?? 0) / totalStake;
      if (share >= 0.35) m *= 1 - 0.45 * coeffs.crowd;
      else if (share >= 0.22) m *= 1 - 0.25 * coeffs.crowd;
      else if (share <= 0.05) m *= 1 + 0.2 * coeffs.crowd;
    }

    const liabNorm = liab[i]! / maxLiab;
    // Kho lỗ → thích liability thấp; kho lãi → cho phép liability cao hơn
    const liabSteer =
      vaultEdge < 0
        ? 1 - liabNorm * coeffs.liability * Math.abs(vaultEdge)
        : 1 + liabNorm * coeffs.liability * vaultEdge * 0.35;
    m *= Math.max(0.25, liabSteer);

    m *= 1 + vaultEdge * coeffs.vault * 0.15 * (1 - liabNorm);

    const noise = 0.82 + Math.random() * 0.4;
    return Math.max(0.05, w * m * noise);
  });
}

function resolveWeights(
  mode: InterMode,
  realStakes?: number[],
  recentWins?: number[],
  history?: RoundResult[],
): number[] {
  let weights: number[];
  if (isPackMode(mode)) {
    weights = CARDS.map((c) => c.weight);
  } else if (mode === "flat") {
    weights = CARDS.map(() => 12.5);
  } else if (mode === "cool") {
    weights = coolWeights(
      CARDS.map((c) => c.weight),
      recentWins ?? [],
    );
  } else if (mode === "fogbreak") {
    weights = fogBreakWeights(
      CARDS.map((c) => c.weight),
      realStakes ?? [],
      recentWins ?? [],
    );
  } else if (mode === "smartai") {
    weights = smartAiWeights(
      CARDS.map((c) => c.weight),
      realStakes ?? [],
      recentWins ?? [],
      history ?? [],
    );
  } else if (mode === "hot") {
    weights = hotWeights(
      CARDS.map((c) => c.weight),
      recentWins ?? [],
    );
  } else if (mode === "wild") {
    weights = wildWeights(CARDS.map((c) => c.weight));
  } else if (isPolicyMode(mode)) {
    weights = policyWeights(mode, realStakes ?? []);
  } else {
    weights = effectiveWeights(
      CARDS.map((c) => c.weight),
      mode,
      CARDS.map((c) => c.id),
    );
  }
  return applyWinBiasToWeights(
    weights,
    CARDS.map((c) => c.id),
    interStore.getWinBiasPct(),
  );
}

/** Lớp MODE cấp cao (MODE2 ×½ / MODE3 ×¼ lá 4–8) — áp sau thuật toán slot. */
function withPackOverlay(weights: number[]): number[] {
  return interStore.applyPackOverlayToWeights(
    weights,
    CARDS.map((c) => c.id),
  );
}

function weightedPick(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return CARDS[CARDS.length - 1]!.id;
  let roll = Math.random() * total;
  for (let i = 0; i < CARDS.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return CARDS[i]!.id;
  }
  return CARDS[CARDS.length - 1]!.id;
}

/**
 * Weighted random theo mode Inter (mainadmin).
 * auto / small / big / flat / cool / ép lá — không nhìn stake (cool dùng history).
 * app / user / fed / hedge — nhìn stake user đăng nhập (auth stakes).
 */
export function pickWinningCard(
  mode: InterMode = "auto",
  realStakes?: number[],
  recentWins?: number[],
  engagement?: PickEngagement,
  history?: RoundResult[],
): number {
  let weights = withPackOverlay(
    resolveWeights(mode, realStakes, recentWins, history),
  );
  if (engagement) {
    weights = applyEngagementToWeights(weights, engagement);
  }
  return weightedPick(weights);
}

export type UserRoundBias = {
  /** Stake theo 8 lá (index 0 = lá 1) */
  stakes: number[];
  mode: "win" | "lose";
  /** Khi mode=win: outcomeWinPct (80–100) — ưu tiên người % cao hơn */
  winPct?: number;
};

function biasTotalStake(stakes: number[]): number {
  let t = 0;
  for (const x of stakes) t += x;
  return t;
}

/**
 * Ưu tiên mode win/lose từng user (admin) trước Inter phòng.
 * win → chọn lá user đó đã xu đặt; lose → tránh lá họ xu đặt.
 * Nhiều win cùng lúc: chỉ nhóm % cao nhất quyết định lá (tie → tổng stake).
 */
export function pickWinningCardWithUserBias(
  mode: InterMode,
  policyStakes: number[],
  biases: UserRoundBias[],
  recentWins?: number[],
  engagement?: PickEngagement,
  history?: RoundResult[],
): number {
  const winBiases = biases.filter(
    (b) => b.mode === "win" && b.stakes.some((x) => x > 0),
  );
  const loseBiases = biases.filter(
    (b) => b.mode === "lose" && b.stakes.some((x) => x > 0),
  );

  if (winBiases.length > 0) {
    let maxPct = 0;
    for (const b of winBiases) {
      const pct = typeof b.winPct === "number" ? b.winPct : 100;
      if (pct > maxPct) maxPct = pct;
    }
    const primaryWins = winBiases.filter(
      (b) => (typeof b.winPct === "number" ? b.winPct : 100) >= maxPct,
    );
    // Cùng % cao nhất: ưu tiên người đặt nhiều hơn (ổn định hơn cộng ngang)
    primaryWins.sort(
      (a, b) => biasTotalStake(b.stakes) - biasTotalStake(a.stakes),
    );

    const winStake = new Array(CARDS.length).fill(0) as number[];
    const loseLiab = new Array(CARDS.length).fill(0) as number[];
    for (const b of primaryWins) {
      const weight = typeof b.winPct === "number" ? b.winPct : 100;
      for (let i = 0; i < CARDS.length; i++) {
        winStake[i]! += (b.stakes[i] ?? 0) * weight;
      }
    }
    for (const b of loseBiases) {
      for (let i = 0; i < CARDS.length; i++) {
        const amt = b.stakes[i] ?? 0;
        if (amt > 0) loseLiab[i]! += amt * CARDS[i]!.multiplier;
      }
    }
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < CARDS.length; i++) {
      if (winStake[i]! <= 0) continue;
      const score = winStake[i]! * 1e9 - loseLiab[i]!;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) return CARDS[best]!.id;
  }

  if (loseBiases.length > 0) {
    const loseStake = new Array(CARDS.length).fill(0) as number[];
    for (const b of loseBiases) {
      for (let i = 0; i < CARDS.length; i++) {
        loseStake[i]! += b.stakes[i] ?? 0;
      }
    }
    const base = withPackOverlay(
      resolveWeights(mode, policyStakes, recentWins, history),
    );
    let safeWeights = base.map((w, i) => (loseStake[i]! <= 0 ? w : 0));
    if (engagement) {
      safeWeights = applyEngagementToWeights(safeWeights, engagement);
    }
    const safeTotal = safeWeights.reduce((a, b) => a + b, 0);
    if (safeTotal > 0) {
      let roll = Math.random() * safeTotal;
      for (let i = 0; i < CARDS.length; i++) {
        roll -= safeWeights[i]!;
        if (roll <= 0) return CARDS[i]!.id;
      }
      return CARDS[0]!.id;
    }
    let best = 0;
    let bestLiab = Infinity;
    for (let i = 0; i < CARDS.length; i++) {
      let liab = 0;
      for (const b of loseBiases) {
        const amt = b.stakes[i] ?? 0;
        if (amt > 0) liab += amt * CARDS[i]!.multiplier;
      }
      if (liab < bestLiab) {
        bestLiab = liab;
        best = i;
      }
    }
    return CARDS[best]!.id;
  }

  return pickWinningCard(mode, policyStakes, recentWins, engagement, history);
}

/** Xác suất hiển thị cho tab Inter (%). Policy modes cần auth stakes ván hiện tại. */
export function cardProbabilities(
  mode: InterMode = "auto",
  realStakes?: number[],
  recentWins?: number[],
  opts?: { applyPackOverlay?: boolean },
): {
  cardId: number;
  nameVi: string;
  weight: number;
  percent: number;
  group: "small" | "big";
  liability: number;
  houseProfit: number;
}[] {
  const stakes = realStakes ?? [];
  let weights = resolveWeights(mode, stakes, recentWins);
  if (opts?.applyPackOverlay) {
    weights = withPackOverlay(weights);
  }
  const liab = cardLiabilities(stakes);
  const profits = houseProfitByCard(stakes);
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  return CARDS.map((c, i) => ({
    cardId: c.id,
    nameVi: c.nameVi,
    weight: Math.round(weights[i]! * 100) / 100,
    percent: Math.round((weights[i]! / total) * 1000) / 10,
    group: c.id <= 4 ? ("small" as const) : ("big" as const),
    liability: liab[i]!,
    houseProfit: profits[i]!,
  }));
}
