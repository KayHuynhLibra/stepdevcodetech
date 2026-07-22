import {
  cardLiabilities,
  cardProbabilities,
  CARDS,
  houseProfitByCard,
} from "./cards.js";
import {
  interStore,
  isPolicyMode,
  type InterMode,
} from "./interStore.js";
import { vaultArcana, vaultStore } from "./vaultStore.js";

const RECENT_CAP = 80;
const AUTH_STAKE_WARN = 200_000;

export type InterRoundObs = {
  at: number;
  round: number;
  storedMode: string;
  effectiveMode: string;
  winCard: number;
  authStake: number;
  displayStake: number;
  houseProfit: number;
  liabilityOnWin: number;
  userBiasCount: number;
  winBiasPct: number;
  vaultNet: number;
};

export type InterAlert = {
  level: "info" | "warn" | "critical";
  code: string;
  message: string;
};

class InterObserveStore {
  private recent: InterRoundObs[] = [];

  record(obs: InterRoundObs) {
    this.recent.unshift(obs);
    if (this.recent.length > RECENT_CAP) this.recent.length = RECENT_CAP;
  }

  getRecent(limit = 40): InterRoundObs[] {
    return this.recent.slice(0, Math.max(1, Math.min(RECENT_CAP, limit)));
  }

  rollingStats(limit = 50) {
    const rows = this.getRecent(limit);
    let stake = 0;
    let house = 0;
    const byMode = new Map<
      string,
      { n: number; stake: number; house: number }
    >();
    for (const r of rows) {
      stake += r.authStake;
      house += r.houseProfit;
      const key = r.effectiveMode;
      const cur = byMode.get(key) ?? { n: 0, stake: 0, house: 0 };
      cur.n += 1;
      cur.stake += r.authStake;
      cur.house += r.houseProfit;
      byMode.set(key, cur);
    }
    const payoutApprox = stake - house;
    const rtp =
      stake > 0 ? Math.round((payoutApprox / stake) * 1000) / 10 : null;
    return {
      rounds: rows.length,
      authStakeSum: stake,
      houseProfitSum: Math.round(house),
      playerPayoutApprox: Math.round(payoutApprox),
      rtpPct: rtp,
      byMode: [...byMode.entries()]
        .map(([mode, v]) => ({
          mode,
          rounds: v.n,
          authStake: v.stake,
          houseProfit: Math.round(v.house),
          rtpPct:
            v.stake > 0
              ? Math.round(((v.stake - v.house) / v.stake) * 1000) / 10
              : null,
        }))
        .sort((a, b) => b.rounds - a.rounds),
    };
  }

  buildLive(opts: {
    phase: string;
    roundNumber: number;
    authStakes: number[];
    realStakes: number[];
    displayStake: number;
    recentWins: number[];
  }) {
    const snap = interStore.getSnapshot();
    const authStake = opts.authStakes.reduce((a, b) => a + Math.max(0, b), 0);
    const effective = interStore.getEffectiveMode({
      authStake,
      displayStake: opts.displayStake,
    }) as Exclude<InterMode, "all" | "pack1" | "pack2" | "pack3" | "pack4">;
    const policyStakes = isPolicyMode(effective) ? opts.authStakes : opts.realStakes;
    const probs = cardProbabilities(effective, policyStakes, opts.recentWins);
    const liab = cardLiabilities(opts.authStakes);
    const profits = houseProfitByCard(opts.authStakes);
    const vault = vaultStore.getSnapshot();
    const vaultArcanaSnap = vaultArcana.getSnapshot();
    const vaultNet = vault.netFromPlay ?? vault.netHouse ?? 0;
    const arcanaNet =
      vaultArcanaSnap.netFromPlay ?? vaultArcanaSnap.netHouse ?? 0;
    const link = snap.vaultInterLink;

    const alerts: InterAlert[] = [];
    if (
      authStake >= AUTH_STAKE_WARN &&
      (effective === "fed" ||
        effective === "app" ||
        effective === "hedge" ||
        effective === "vaultguard")
    ) {
      alerts.push({
        level: "warn",
        code: "high_stake_absorb",
        message: `Auth stake ${authStake.toLocaleString("vi-VN")} + mode ${effective} — đang thiên hút/giữ xu`,
      });
    }
    if (
      authStake >= AUTH_STAKE_WARN &&
      (effective === "user" || effective === "softuser")
    ) {
      alerts.push({
        level: "warn",
        code: "high_stake_release",
        message: `Auth stake cao + mode ${effective} — đang thiên nhả xu`,
      });
    }
    if (link?.enabled) {
      const tarotFlags = vault.interFlags;
      const arcFlags = vaultArcanaSnap.interFlags;
      if (tarotFlags?.interSignal) {
        const lossTh =
          tarotFlags.lossThresholdXu > 0
            ? tarotFlags.lossThresholdXu
            : link.lossThresholdXu;
        const profitTh =
          tarotFlags.profitThresholdXu > 0
            ? tarotFlags.profitThresholdXu
            : link.profitThresholdXu;
        if (vaultNet <= -Math.abs(lossTh || 0)) {
          alerts.push({
            level: "critical",
            code: "vault_loss",
            message: `Kho Tarot net ${Math.round(vaultNet).toLocaleString("vi-VN")} ≤ −ngưỡng — có thể ép ${tarotFlags.onLossMode || link.onLossMode}`,
          });
        }
        if (vaultNet >= Math.abs(profitTh || 0)) {
          alerts.push({
            level: "info",
            code: "vault_profit",
            message: `Kho Tarot net ${Math.round(vaultNet).toLocaleString("vi-VN")} ≥ ngưỡng — có thể ép ${tarotFlags.onProfitMode || link.onProfitMode}`,
          });
        }
      }
      if (arcFlags?.interSignal) {
        const lossTh =
          arcFlags.lossThresholdXu > 0
            ? arcFlags.lossThresholdXu
            : link.lossThresholdXu;
        const profitTh =
          arcFlags.profitThresholdXu > 0
            ? arcFlags.profitThresholdXu
            : link.profitThresholdXu;
        if (arcanaNet <= -Math.abs(lossTh || 0)) {
          alerts.push({
            level: "critical",
            code: "vault_arcana_loss",
            message: `Kho Arcana net ${Math.round(arcanaNet).toLocaleString("vi-VN")} ≤ −ngưỡng — tín hiệu Inter`,
          });
        }
        if (arcanaNet >= Math.abs(profitTh || 0)) {
          alerts.push({
            level: "info",
            code: "vault_arcana_profit",
            message: `Kho Arcana net ${Math.round(arcanaNet).toLocaleString("vi-VN")} ≥ ngưỡng — tín hiệu Inter`,
          });
        }
      }
    }
    if (Math.abs(snap.winBiasPct ?? 0) >= 30) {
      alerts.push({
        level: "info",
        code: "win_bias",
        message: `winBiasPct = ${snap.winBiasPct} (lệch nhóm Small/Big mạnh)`,
      });
    }

    const bestHouse = profits.reduce(
      (best, p, i) => (p > best.p ? { p, i } : best),
      { p: -Infinity, i: 0 },
    );
    const worstHouse = profits.reduce(
      (worst, p, i) => (p < worst.p ? { p, i } : worst),
      { p: Infinity, i: 0 },
    );

    return {
      at: Date.now(),
      phase: opts.phase,
      roundNumber: opts.roundNumber,
      storedMode: snap.mode,
      effectiveMode: effective,
      winBiasPct: snap.winBiasPct,
      vaultNet: Math.round(vaultNet),
      vaultArcanaNet: Math.round(arcanaNet),
      vaultFlags: {
        tarot: vault.interFlags,
        arcana: vaultArcanaSnap.interFlags,
      },
      vaultLink: link,
      authStake,
      displayStake: opts.displayStake,
      authStakes: opts.authStakes,
      cards: CARDS.map((c, i) => ({
        cardId: c.id,
        nameVi: c.nameVi,
        multiplier: c.multiplier,
        authStake: opts.authStakes[i] ?? 0,
        liability: liab[i]!,
        houseProfit: profits[i]!,
        percent: probs[i]?.percent ?? 0,
        weight: probs[i]?.weight ?? 0,
      })),
      hint: {
        bestHouseCard: CARDS[bestHouse.i]!.id,
        bestHouseProfit: Math.round(bestHouse.p),
        worstHouseCard: CARDS[worstHouse.i]!.id,
        worstHouseProfit: Math.round(worstHouse.p),
      },
      alerts,
      rolling: this.rollingStats(50),
      recent: this.getRecent(25),
    };
  }
}

export const interObserveStore = new InterObserveStore();
