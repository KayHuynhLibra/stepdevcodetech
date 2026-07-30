import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { dualWriteVaultLedgerEntry } from "./db/dualWrite.js";

export type VaultLedgerType =
  | "stake_in"
  | "stake_refund"
  | "payout_out"
  | "mint"
  | "burn"
  | "grant_user"
  | "seize_user"
  | "set_balance"
  | "coupon_mint"
  | "admin_adjust"
  | "chat_fee"
  | "cultivation_fee"
  | "ring_fee"
  | "pocket_fee";

/** Loại ghi sổ thường làm hao hụt / xu ra khỏi kho. */
export const VAULT_OUTFLOW_TYPES: readonly VaultLedgerType[] = [
  "payout_out",
  "coupon_mint",
  "grant_user",
  "burn",
  "stake_refund",
] as const;

export function isVaultOutflowEntry(e: {
  type: string;
  amount: number;
}): boolean {
  if (e.amount < 0) return true;
  return (VAULT_OUTFLOW_TYPES as readonly string[]).includes(e.type);
}
export interface VaultLedgerEntry {
  id: string;
  at: number;
  type: VaultLedgerType;
  amount: number;
  balanceAfter: number;
  note: string;
  byUsername: string;
  userId?: string;
  username?: string;
}

/**
 * Flag từng kho → tín hiệu Inter auto.
 * Ngưỡng/mode = 0 / "" → dùng VaultInterLink global.
 * Có thể dùng % (edge) thay vì xu tuyệt đối.
 */
export interface VaultInterFlags {
  /** Kho này tham gia vault→Inter */
  interSignal: boolean;
  /** Trọng số gộp net (0–100) khi combine = weighted */
  interWeightPct: number;
  /** Ưu tiên khi conflict (cao hơn thắng) */
  interPriority: number;
  /** Ngưỡng lỗ xu; 0 = global (khi không dùng %) */
  lossThresholdXu: number;
  /** Ngưỡng lãi xu; 0 = global */
  profitThresholdXu: number;
  /** Mode khi lỗ; "" = global onLossMode */
  onLossMode: string;
  /** Mode khi lãi; "" = global onProfitMode */
  onProfitMode: string;
  /** true = nhận diện theo % edge thay vì xu */
  usePercent: boolean;
  /** |edgePct| lỗ ≥ lossPct → band loss (vd 8 = −8%) */
  lossPct: number;
  /** edgePct ≥ profitPct → band profit */
  profitPct: number;
}

export type VaultHealthBand =
  | "deep_loss"
  | "soft_loss"
  | "neutral"
  | "soft_profit"
  | "deep_profit";

/** Chỉ số % lỗ/lãi + gợi ý cường độ hút/nhả (−2…+2). */
export interface VaultHealth {
  label: string;
  netFromPlay: number;
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  /** (stake−payout)/stake × 100 — edge nhà game all-time chơi */
  edgePct: number;
  /** netFromPlay / balance × 100 */
  netVsBalancePct: number;
  /** Edge ledger 1h (stakeIn vs payoutOut) */
  flowHourEdgePct: number;
  /** Edge ledger 24h */
  flowDayEdgePct: number;
  /** Blend edge all-time + flow giờ */
  blendEdgePct: number;
  band: VaultHealthBand;
  /** −2 hút mạnh … 0 trung tính … +2 nhả mạnh */
  steerIntensity: number;
}

export const DEFAULT_TAROT_INTER_FLAGS: VaultInterFlags = {
  interSignal: true,
  interWeightPct: 100,
  interPriority: 10,
  lossThresholdXu: 0,
  profitThresholdXu: 0,
  onLossMode: "",
  onProfitMode: "",
  usePercent: true,
  lossPct: 8,
  profitPct: 12,
};

export const DEFAULT_ARCANA_INTER_FLAGS: VaultInterFlags = {
  interSignal: false,
  interWeightPct: 50,
  interPriority: 5,
  lossThresholdXu: 0,
  profitThresholdXu: 0,
  onLossMode: "",
  onProfitMode: "",
  usePercent: true,
  lossPct: 10,
  profitPct: 15,
};

/** Kho Gem — Inter tắt mặc định (bàn Gem chưa ship). */
export const DEFAULT_GEM_INTER_FLAGS: VaultInterFlags = {
  interSignal: false,
  interWeightPct: 0,
  interPriority: 0,
  lossThresholdXu: 0,
  profitThresholdXu: 0,
  onLossMode: "",
  onProfitMode: "",
  usePercent: true,
  lossPct: 10,
  profitPct: 15,
};

function edgePctFrom(stake: number, payout: number): number {
  const s = Math.max(0, stake);
  if (s <= 0) return 0;
  return ((s - Math.max(0, payout)) / s) * 100;
}

function bandFromEdge(
  edgePct: number,
  softLoss = -5,
  deepLoss = -12,
  softProfit = 8,
  deepProfit = 18,
): VaultHealthBand {
  if (edgePct <= deepLoss) return "deep_loss";
  if (edgePct <= softLoss) return "soft_loss";
  if (edgePct >= deepProfit) return "deep_profit";
  if (edgePct >= softProfit) return "soft_profit";
  return "neutral";
}

function intensityFromBand(band: VaultHealthBand): number {
  switch (band) {
    case "deep_loss":
      return -2;
    case "soft_loss":
      return -1;
    case "soft_profit":
      return 1;
    case "deep_profit":
      return 2;
    default:
      return 0;
  }
}

export function mergeVaultInterFlags(
  raw: Partial<VaultInterFlags> | null | undefined,
  defaults: VaultInterFlags,
): VaultInterFlags {
  const r = raw && typeof raw === "object" ? raw : {};
  const w = Math.floor(Number(r.interWeightPct ?? defaults.interWeightPct));
  const prio = Math.floor(Number(r.interPriority ?? defaults.interPriority));
  const lossPct = Number(r.lossPct ?? defaults.lossPct);
  const profitPct = Number(r.profitPct ?? defaults.profitPct);
  return {
    interSignal:
      r.interSignal !== undefined ? !!r.interSignal : defaults.interSignal,
    interWeightPct: Math.max(0, Math.min(100, Number.isFinite(w) ? w : 0)),
    interPriority: Math.max(
      0,
      Math.min(100, Number.isFinite(prio) ? prio : defaults.interPriority),
    ),
    lossThresholdXu: Math.max(
      0,
      Math.floor(
        Number(r.lossThresholdXu ?? defaults.lossThresholdXu) || 0,
      ),
    ),
    profitThresholdXu: Math.max(
      0,
      Math.floor(
        Number(r.profitThresholdXu ?? defaults.profitThresholdXu) || 0,
      ),
    ),
    onLossMode: String(r.onLossMode ?? defaults.onLossMode ?? "").trim(),
    onProfitMode: String(r.onProfitMode ?? defaults.onProfitMode ?? "").trim(),
    usePercent:
      r.usePercent !== undefined ? !!r.usePercent : defaults.usePercent,
    lossPct: Math.max(
      0.5,
      Math.min(80, Number.isFinite(lossPct) ? lossPct : defaults.lossPct),
    ),
    profitPct: Math.max(
      0.5,
      Math.min(80, Number.isFinite(profitPct) ? profitPct : defaults.profitPct),
    ),
  };
}

interface VaultFile {
  version: 1;
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  totalMinted: number;
  totalBurned: number;
  /** Xu đã phát qua coupon (all-time) */
  totalCouponOut?: number;
  /** Xu admin cấp user (all-time) */
  totalGrantOut?: number;
  /** Xu thu về từ user (all-time) */
  totalSeizeIn?: number;
  /** Phí chat + duy trì cảnh giới (all-time) */
  totalFeesIn?: number;
  ledger: VaultLedgerEntry[];
  interFlags?: Partial<VaultInterFlags>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const LEDGER_CAP = 200;
const START_BALANCE = 500_000;

export class VaultStore {
  private balance = START_BALANCE;
  private totalStakeIn = 0;
  private totalPayoutOut = 0;
  private totalMinted = 0;
  private totalBurned = 0;
  private totalCouponOut = 0;
  private totalGrantOut = 0;
  private totalSeizeIn = 0;
  private totalFeesIn = 0;
  private ledger: VaultLedgerEntry[] = [];
  private interFlags: VaultInterFlags;
  private readonly defaultFlags: VaultInterFlags;
  private readonly filePath: string;
  private readonly tmpPath: string;
  private readonly label: string;
  private readonly vaultKey: string;

  constructor(
    fileName = "vault.json",
    label = "Kho Tarot",
    defaultFlags: VaultInterFlags = DEFAULT_TAROT_INTER_FLAGS,
  ) {
    this.filePath = join(DATA_DIR, fileName);
    this.tmpPath = join(DATA_DIR, `${fileName}.tmp`);
    this.label = label;
    this.vaultKey = fileName.replace(/\.json$/i, "") || "tarot";
    this.defaultFlags = defaultFlags;
    this.interFlags = { ...defaultFlags };
    this.load();
  }

  private load() {
    try {
      if (!existsSync(this.filePath)) {
        this.save();
        return;
      }
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as VaultFile;
      if (parsed?.version !== 1) return;
      if (typeof parsed.balance === "number") this.balance = parsed.balance;
      if (typeof parsed.totalStakeIn === "number")
        this.totalStakeIn = parsed.totalStakeIn;
      if (typeof parsed.totalPayoutOut === "number")
        this.totalPayoutOut = parsed.totalPayoutOut;
      if (typeof parsed.totalMinted === "number")
        this.totalMinted = parsed.totalMinted;
      if (typeof parsed.totalBurned === "number")
        this.totalBurned = parsed.totalBurned;
      const hasLifetimeOps =
        typeof parsed.totalCouponOut === "number" ||
        typeof parsed.totalGrantOut === "number" ||
        typeof parsed.totalSeizeIn === "number" ||
        typeof parsed.totalFeesIn === "number";
      if (typeof parsed.totalCouponOut === "number")
        this.totalCouponOut = parsed.totalCouponOut;
      if (typeof parsed.totalGrantOut === "number")
        this.totalGrantOut = parsed.totalGrantOut;
      if (typeof parsed.totalSeizeIn === "number")
        this.totalSeizeIn = parsed.totalSeizeIn;
      if (typeof parsed.totalFeesIn === "number")
        this.totalFeesIn = parsed.totalFeesIn;
      if (Array.isArray(parsed.ledger)) {
        this.ledger = parsed.ledger.slice(0, LEDGER_CAP);
      }
      if (!hasLifetimeOps) {
        this.hydrateLifetimeOpsFromLedger();
      }
      if (parsed.interFlags && typeof parsed.interFlags === "object") {
        this.interFlags = mergeVaultInterFlags(
          parsed.interFlags,
          this.defaultFlags,
        );
      }
      console.log(
        `[vault:${this.label}] Loaded · balance ${Math.round(this.balance)} · interSignal=${this.interFlags.interSignal}`,
      );
    } catch (err) {
      console.warn(`[vault:${this.label}] Failed to load:`, err);
    }
  }

  /** Seed bộ đếm ops từ ledger còn giữ (lần đầu migrate). */
  private hydrateLifetimeOpsFromLedger() {
    let coupon = 0;
    let grant = 0;
    let seize = 0;
    let fees = 0;
    for (const e of this.ledger) {
      const a = Math.abs(e.amount);
      switch (e.type) {
        case "coupon_mint":
          coupon += a;
          break;
        case "grant_user":
          grant += a;
          break;
        case "seize_user":
          seize += Math.max(0, e.amount);
          break;
        case "chat_fee":
        case "cultivation_fee":
        case "ring_fee":
        case "pocket_fee":
          fees += e.amount;
          break;
        default:
          break;
      }
    }
    this.totalCouponOut = coupon;
    this.totalGrantOut = grant;
    this.totalSeizeIn = seize;
    this.totalFeesIn = fees;
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: VaultFile = {
        version: 1,
        balance: this.balance,
        totalStakeIn: this.totalStakeIn,
        totalPayoutOut: this.totalPayoutOut,
        totalMinted: this.totalMinted,
        totalBurned: this.totalBurned,
        totalCouponOut: this.totalCouponOut,
        totalGrantOut: this.totalGrantOut,
        totalSeizeIn: this.totalSeizeIn,
        totalFeesIn: this.totalFeesIn,
        ledger: this.ledger.slice(0, LEDGER_CAP),
        interFlags: { ...this.interFlags },
      };
      writeFileSync(this.tmpPath, JSON.stringify(payload, null, 2), "utf8");
      renameSync(this.tmpPath, this.filePath);
    } catch (err) {
      console.warn(`[vault:${this.label}] Failed to save:`, err);
    }
  }

  private push(
    type: VaultLedgerType,
    amount: number,
    byUsername: string,
    note: string,
    extra?: { userId?: string; username?: string },
  ) {
    const id = randomBytes(6).toString("hex");
    this.ledger.unshift({
      id,
      at: Date.now(),
      type,
      amount,
      balanceAfter: this.balance,
      note,
      byUsername,
      userId: extra?.userId,
      username: extra?.username,
    });
    if (this.ledger.length > LEDGER_CAP) this.ledger.length = LEDGER_CAP;
    this.save();
    dualWriteVaultLedgerEntry({
      id,
      vaultKey: this.vaultKey,
      at: Date.now(),
      kind: type,
      amount,
      balanceAfter: this.balance,
      userId: extra?.userId,
      byUsername,
      note,
    });
  }

  /**
   * Dòng tiền kho theo cửa sổ thời gian (từ ledger gần đây, cap 200).
   * Không phải all-time — chỉ phản ánh sổ cái còn giữ.
   */
  getFlowWindows(now = Date.now()) {
    const windows = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    } as const;
    type Flow = {
      stakeIn: number;
      stakeRefund: number;
      payoutOut: number;
      couponOut: number;
      grantOut: number;
      seizeIn: number;
      feesIn: number;
      mint: number;
      burn: number;
      adminAdjust: number;
      net: number;
      rows: number;
    };
    const empty = (): Flow => ({
      stakeIn: 0,
      stakeRefund: 0,
      payoutOut: 0,
      couponOut: 0,
      grantOut: 0,
      seizeIn: 0,
      feesIn: 0,
      mint: 0,
      burn: 0,
      adminAdjust: 0,
      net: 0,
      rows: 0,
    });
    const out: Record<keyof typeof windows, Flow> = {
      hour: empty(),
      day: empty(),
      week: empty(),
      month: empty(),
    };
    const apply = (flow: Flow, e: VaultLedgerEntry) => {
      flow.rows += 1;
      flow.net += e.amount;
      switch (e.type) {
        case "stake_in":
          flow.stakeIn += e.amount;
          break;
        case "stake_refund":
          flow.stakeRefund += Math.abs(e.amount);
          break;
        case "payout_out":
          flow.payoutOut += Math.abs(e.amount);
          break;
        case "coupon_mint":
          flow.couponOut += Math.abs(e.amount);
          break;
        case "grant_user":
          flow.grantOut += Math.abs(e.amount);
          break;
        case "seize_user":
          flow.seizeIn += e.amount;
          break;
        case "chat_fee":
        case "cultivation_fee":
        case "ring_fee":
        case "pocket_fee":
          flow.feesIn += e.amount;
          break;
        case "mint":
          flow.mint += e.amount;
          break;
        case "burn":
          flow.burn += Math.abs(e.amount);
          break;
        case "admin_adjust":
        case "set_balance":
          flow.adminAdjust += e.amount;
          break;
        default:
          break;
      }
    };
    for (const e of this.ledger) {
      const age = now - e.at;
      for (const [key, ms] of Object.entries(windows) as [
        keyof typeof windows,
        number,
      ][]) {
        if (age < ms) apply(out[key], e);
      }
    }
    return {
      note: "Từ ledger gần đây (tối đa 200 dòng) — không phải all-time",
      ledgerRows: this.ledger.length,
      windows: out,
    };
  }

  getSnapshot() {
    const breakdown: Record<string, { count: number; sum: number }> = {};
    for (const e of this.ledger) {
      const row = breakdown[e.type] ?? { count: 0, sum: 0 };
      row.count += 1;
      row.sum += e.amount;
      breakdown[e.type] = row;
    }
    return {
      label: this.label,
      balance: this.balance,
      totalStakeIn: this.totalStakeIn,
      totalPayoutOut: this.totalPayoutOut,
      totalMinted: this.totalMinted,
      totalBurned: this.totalBurned,
      totalCouponOut: this.totalCouponOut,
      totalGrantOut: this.totalGrantOut,
      totalSeizeIn: this.totalSeizeIn,
      totalFeesIn: this.totalFeesIn,
      /** Xu lấy về từ user (stake + thu + phí) */
      inflowFromUsers:
        this.totalStakeIn + this.totalSeizeIn + this.totalFeesIn,
      /** Xu phát ra cho user (trả thưởng + coupon + cấp) */
      outflowToUsers:
        this.totalPayoutOut + this.totalCouponOut + this.totalGrantOut,
      netHouse:
        this.totalStakeIn -
        this.totalPayoutOut +
        this.totalMinted -
        this.totalBurned,
      /** Lãi/lỗ thuần từ xu user (không gồm mint/burn admin) */
      netFromPlay: this.totalStakeIn - this.totalPayoutOut,
      breakdown,
      ledger: this.ledger.slice(0, 100),
      flows: this.getFlowWindows(),
      interFlags: this.getInterFlags(),
      health: this.getHealth(),
    };
  }

  /**
   * Lọc sổ cái cho admin (hao hụt / theo loại).
   * Trả rows mới nhất trước + tổng |amount| trong tập đã lọc (trước khi cắt limit).
   */
  listLedger(opts?: {
    type?: string;
    limit?: number;
    onlyOutflow?: boolean;
  }): {
    rows: VaultLedgerEntry[];
    sumAbs: number;
    filteredCount: number;
    totalLedger: number;
  } {
    const lim = Math.min(
      200,
      Math.max(1, Math.floor(Number(opts?.limit) || 80)),
    );
    const typeKey = String(opts?.type ?? "").trim();
    let filtered = this.ledger;
    if (typeKey) {
      filtered = filtered.filter((e) => e.type === typeKey);
    }
    if (opts?.onlyOutflow) {
      filtered = filtered.filter((e) => isVaultOutflowEntry(e));
    }
    let sumAbs = 0;
    for (const e of filtered) sumAbs += Math.abs(e.amount);
    return {
      rows: filtered.slice(0, lim),
      sumAbs,
      filteredCount: filtered.length,
      totalLedger: this.ledger.length,
    };
  }

  /**
   * % lỗ/lãi kho — all-time edge + flow giờ/ngày + band + steerIntensity.
   */
  getHealth(): VaultHealth {
    const netFromPlay = this.totalStakeIn - this.totalPayoutOut;
    const edgePct = edgePctFrom(this.totalStakeIn, this.totalPayoutOut);
    const bal = Math.max(1, this.balance);
    const netVsBalancePct = (netFromPlay / bal) * 100;
    const flows = this.getFlowWindows();
    const h = flows.windows.hour;
    const d = flows.windows.day;
    const flowHourEdgePct = edgePctFrom(h.stakeIn, h.payoutOut);
    const flowDayEdgePct = edgePctFrom(d.stakeIn, d.payoutOut);
    const blendEdgePct = edgePct * 0.55 + flowHourEdgePct * 0.3 + flowDayEdgePct * 0.15;
    const flags = this.interFlags;
    const softLoss = flags.usePercent ? -flags.lossPct * 0.55 : -5;
    const deepLoss = flags.usePercent ? -flags.lossPct : -12;
    const softProfit = flags.usePercent ? flags.profitPct * 0.55 : 8;
    const deepProfit = flags.usePercent ? flags.profitPct : 18;
    const band = bandFromEdge(
      blendEdgePct,
      softLoss,
      deepLoss,
      softProfit,
      deepProfit,
    );
    return {
      label: this.label,
      netFromPlay,
      balance: this.balance,
      totalStakeIn: this.totalStakeIn,
      totalPayoutOut: this.totalPayoutOut,
      edgePct: Math.round(edgePct * 100) / 100,
      netVsBalancePct: Math.round(netVsBalancePct * 100) / 100,
      flowHourEdgePct: Math.round(flowHourEdgePct * 100) / 100,
      flowDayEdgePct: Math.round(flowDayEdgePct * 100) / 100,
      blendEdgePct: Math.round(blendEdgePct * 100) / 100,
      band,
      steerIntensity: intensityFromBand(band),
    };
  }

  getInterFlags(): VaultInterFlags {
    return { ...this.interFlags };
  }

  setInterFlags(
    partial: Partial<VaultInterFlags>,
  ): { ok: true; interFlags: VaultInterFlags } {
    this.interFlags = mergeVaultInterFlags(
      { ...this.interFlags, ...partial },
      this.defaultFlags,
    );
    this.save();
    return { ok: true, interFlags: this.getInterFlags() };
  }

  /** User thật đặt xu → xu vào kho */
  recordStakeIn(amount: number, username: string, userId: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance += amt;
    this.totalStakeIn += amt;
    this.push("stake_in", amt, "system", `Xu vào kho`, {
      userId,
      username,
    });
  }

  /** Hoàn xu (disconnect lúc đặt xu) — trừ lại stake_in. */
  recordStakeRefund(amount: number, username: string, userId: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance -= amt;
    this.totalStakeIn = Math.max(0, this.totalStakeIn - amt);
    this.push("stake_refund", -amt, "system", `Hoàn xu (thoát bàn)`, {
      userId,
      username,
    });
  }

  /** Trả xu user thật → trừ kho (cho phép âm — nợ nhà game). */
  recordPayoutOut(amount: number, username: string, userId: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance -= amt;
    this.totalPayoutOut += amt;
    if (this.balance < 0) {
      console.warn(
        `[vault:${this.label}] Kho âm ${this.balance} sau trả ${amt} cho ${username}`,
      );
    }
    this.push("payout_out", -amt, "system", `Trả xu từ kho`, {
      userId,
      username,
    });
  }

  adjust(
    delta: number,
    byUsername: string,
    note: string,
  ): { ok: true; balance: number } | { ok: false; reason: string } {
    const d = Math.floor(delta);
    if (!Number.isFinite(d) || d === 0) {
      return { ok: false, reason: "Delta không hợp lệ" };
    }
    const next = this.balance + d;
    if (next < 0) return { ok: false, reason: "Kho xu không đủ" };
    this.balance = next;
    if (d > 0) this.totalMinted += d;
    else this.totalBurned += -d;
    this.push(
      d > 0 ? "mint" : "burn",
      d,
      byUsername,
      note || (d > 0 ? "Bơm kho" : "Rút kho"),
    );
    return { ok: true, balance: this.balance };
  }

  setBalance(
    balance: number,
    byUsername: string,
    note: string,
  ): { ok: true; balance: number } | { ok: false; reason: string } {
    const next = Math.floor(balance);
    if (!Number.isFinite(next) || next < 0) {
      return { ok: false, reason: "Số dư kho không hợp lệ" };
    }
    const delta = next - this.balance;
    this.balance = next;
    if (delta > 0) this.totalMinted += delta;
    else if (delta < 0) this.totalBurned += -delta;
    this.push("set_balance", delta, byUsername, note || `Đặt kho = ${next}`);
    return { ok: true, balance: this.balance };
  }

  /** Cấp xu cho user từ kho (trừ kho) */
  prepareGrant(
    amount: number,
  ): { ok: true; amount: number } | { ok: false; reason: string } {
    const amt = Math.floor(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, reason: "Số xu không hợp lệ" };
    }
    if (this.balance < amt) return { ok: false, reason: "Kho xu không đủ" };
    return { ok: true, amount: amt };
  }

  commitGrant(
    amount: number,
    byUsername: string,
    userId: string,
    username: string,
    note: string,
  ) {
    this.balance -= amount;
    this.totalGrantOut += amount;
    this.push("grant_user", -amount, byUsername, note || "Cấp xu từ kho", {
      userId,
      username,
    });
  }

  commitSeize(
    amount: number,
    byUsername: string,
    userId: string,
    username: string,
    note: string,
  ) {
    this.balance += amount;
    this.totalSeizeIn += amount;
    this.push("seize_user", amount, byUsername, note || "Thu xu về kho", {
      userId,
      username,
    });
  }

  /**
   * Coupon redeem: trừ kho (cho phép âm — nợ nạp xu).
   * Xu user lấy từ kho nhà game.
   */
  recordCouponMint(
    amount: number,
    userId: string,
    username: string,
    code: string,
  ) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance -= amt;
    this.totalMinted += amt;
    this.totalCouponOut += amt;
    this.push("coupon_mint", -amt, "system", `Coupon ${code}`, {
      userId,
      username,
    });
  }

  /**
   * Admin chỉnh số dư user: +delta trừ kho, -delta cộng kho.
   * Cho phép kho âm khi cấp nhiều.
   */
  recordAdminAdjust(
    delta: number,
    byUsername: string,
    userId: string,
    username: string,
  ) {
    const d = Math.floor(delta);
    if (!Number.isFinite(d) || d === 0) return;
    this.balance -= d;
    if (d > 0) this.totalMinted += d;
    else this.totalBurned += -d;
    this.push(
      "admin_adjust",
      -d,
      byUsername,
      d > 0 ? "Admin cộng xu" : "Admin trừ xu",
      { userId, username },
    );
  }

  /**
   * @deprecated Phí phải qua feePocketStore.collectFee.
   * Không ghi vault — tránh lệch khi feature cũ còn gọi.
   */
  recordChatFee(
    _amount: number,
    _userId: string,
    _username: string,
    _mode: string,
    _rank?: string | null,
  ) {
    console.warn(
      "[vault] recordChatFee deprecated — dùng feePocketStore.collectFee",
    );
  }

  /** Chỉ gọi từ feePocketStore.releaseToVault */
  recordFeeFromPocket(amount: number, byUsername: string, note?: string) {
    const amt = Math.floor(amount);
    if (amt <= 0) return;
    this.balance += amt;
    this.totalMinted += amt;
    this.totalFeesIn += amt;
    this.push(
      "pocket_fee",
      amt,
      byUsername.trim() || "admin",
      note?.trim() || "Fee Pocket → Kho Tarot",
    );
  }

  /** @deprecated Dùng feePocketStore.collectFee({ source: "cultivation" }) */
  recordCultivationFee(
    _amount: number,
    _userId: string,
    _username: string,
    _rank: string,
  ) {
    console.warn(
      "[vault] recordCultivationFee deprecated — dùng feePocketStore.collectFee",
    );
  }

  /** @deprecated Dùng feePocketStore.collectFee({ source: "ring" }) */
  recordRingFee(
    _amount: number,
    _userId: string,
    _username: string,
    _ringKey: string,
    _ringNameVi?: string,
  ) {
    console.warn(
      "[vault] recordRingFee deprecated — dùng feePocketStore.collectFee",
    );
  }

  /** @deprecated Dùng feePocketStore.refundFee({ source: "ring" }) */
  refundRingFee(
    _amount: number,
    _userId: string,
    _username: string,
    _ringKey: string,
  ) {
    console.warn(
      "[vault] refundRingFee deprecated — dùng feePocketStore.refundFee",
    );
  }
}

/** Kho bàn Tarot + vận hành ví (coupon/grant/seize) */
export const vaultTarot = new VaultStore(
  "vault.json",
  "Kho Tarot",
  DEFAULT_TAROT_INTER_FLAGS,
);
/** Alias cũ — game.ts / coupon vẫn import vaultStore */
export const vaultStore = vaultTarot;
/** Kho bàn Bánh xe Arcana — độc lập */
export const vaultArcana = new VaultStore(
  "vault-arcana.json",
  "Kho Arcana",
  DEFAULT_ARCANA_INTER_FLAGS,
);
/** Kho Gem (Kim Cương) — độc lập xu / Arcana; bàn Gem để sau */
export const vaultGem = new VaultStore(
  "vault-gem.json",
  "Kho Gem",
  DEFAULT_GEM_INTER_FLAGS,
);
