import fs from "node:fs";
import path from "node:path";

const root = path.resolve("fe/src/components/admin/panels");
const interJsxRaw = fs.readFileSync(path.join(root, "_inter_jsx.txt"), "utf8");
const vaultJsxRaw = fs.readFileSync(path.join(root, "_vault_jsx.txt"), "utf8");

function xInter(s) {
  return s
    .replaceAll("data.inter!", "inter")
    .replaceAll("data.inter", "inter")
    .replaceAll("data.users", "users")
    .replaceAll("data.vaultArcana", "vaultArcana")
    .replaceAll("data.vault", "vault");
}

function xVault(s) {
  return s.replaceAll("data.users", "users");
}

const interHeader = `import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, hasCapability, type AuthUser } from "../../../auth";
import { CARDS, formatXu } from "../../../cards";
import type { AdminUserRow } from "./UsersAdminPanel";

type ForceCardMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type PackMode = "pack1" | "pack2" | "pack3" | "pack4";
type RotateStep =
  | "auto"
  | "small"
  | "big"
  | "flat"
  | "cool"
  | "hot"
  | "mid"
  | "lowmult"
  | "highmult"
  | "app"
  | "softapp"
  | "hedge"
  | "softfed"
  | "fed"
  | "user"
  | "softuser"
  | "contrarian"
  | "momentum"
  | "sparse"
  | "dense"
  | "wild"
  | "vaultguard"
  | "vaultpct"
  | "flowguard"
  | "moneysteer"
  | "crowdcap"
  | "fogbreak"
  | "smartai";

type InterMode = "all" | PackMode | RotateStep | ForceCardMode;

const PACK_MODES: PackMode[] = ["pack1", "pack2", "pack3", "pack4"];

const FALLBACK_ROTATE_CATALOG: { id: RotateStep; label: string }[] = [
  { id: "auto", label: "Auto — weight gốc" },
  { id: "small", label: "Small — ưu tiên lá 1–4" },
  { id: "big", label: "Big — ưu tiên lá 5–8" },
  { id: "flat", label: "Flat — ~12.5% mỗi lá" },
  { id: "cool", label: "Cool — giảm 3 lá thắng gần nhất" },
  { id: "hot", label: "Hot — tăng lá vừa thắng gần đây" },
  { id: "mid", label: "Mid — ưu tiên lá 3–6" },
  { id: "lowmult", label: "LowMult — thiên hệ số thấp (1–4)" },
  { id: "highmult", label: "HighMult — thiên hệ số cao (5–8)" },
  { id: "app", label: "App — hút xu (mềm)" },
  { id: "softapp", label: "SoftApp — hút xu rất nhẹ" },
  { id: "hedge", label: "Hedge — lệch profit² nhà" },
  { id: "softfed", label: "SoftFed — giữ xu vừa phải" },
  { id: "fed", label: "Fed — lá nhà lời tối đa" },
  { id: "user", label: "User — nhả xu (đặt cao)" },
  { id: "softuser", label: "SoftUser — nhả xu nhẹ" },
  { id: "contrarian", label: "Contrarian — ưu tiên lá ít người đặt" },
  { id: "momentum", label: "Momentum — theo lá nhiều người đặt" },
  { id: "sparse", label: "Sparse — boost lá chưa ai đánh" },
  { id: "dense", label: "Dense — boost lá đông người đặt" },
  { id: "wild", label: "Wild — ngẫu nhiên 2 lá trọng số cao" },
  { id: "vaultguard", label: "VaultGuard — kho lỗ→hút, lãi→nhả nhẹ (xu)" },
  { id: "vaultpct", label: "VaultPct — theo % edge kho Tarot" },
  { id: "flowguard", label: "FlowGuard — theo % dòng tiền 1h/24h" },
  { id: "moneysteer", label: "MoneySteer — gộp % cả 2 kho + flow" },
  { id: "crowdcap", label: "CrowdCap — giảm lá bị đám đông pile" },
  { id: "fogbreak", label: "FogBreak — bẻ cầu mềm (nhiễu, không lộ)" },
  { id: "smartai", label: "SmartAI — học online từ cầu/stake/kho (nhẹ)" },
];

const DEFAULT_ALL_ROTATION: RotateStep[] = [
  "auto",
  "small",
  "big",
  "flat",
  "cool",
  "hot",
  "mid",
  "lowmult",
  "highmult",
];

function isInterRotating(mode: string): mode is "all" | PackMode {
  return mode === "all" || PACK_MODES.includes(mode as PackMode);
}

function isRotateStep(v: string): v is RotateStep {
  return FALLBACK_ROTATE_CATALOG.some((o) => o.id === v);
}

type InterProb = {
  cardId: number;
  percent: number;
  group?: string;
  houseProfit?: number;
};

export type InterAdminData = {
  mode: InterMode;
  primaryTier?: "mode1" | "mode2" | "mode3";
  effectiveMode?: string;
  allSlotMinutes?: number;
  allRotation?: string[];
  defaultRotation?: string[];
  winBiasPct?: number;
  vaultInterLink?: {
    enabled: boolean;
    lossThresholdXu: number;
    profitThresholdXu: number;
    onLossMode: string;
    onProfitMode: string;
    combine?: "any" | "weighted" | "priority";
    idleMode?: string | null;
  };
  rotateCatalog?: { id: RotateStep; label: string }[];
  modePacks?: {
    id: PackMode;
    label: string;
    rotation: string[];
    tier?: "primary" | "secondary";
    highCardWeightMul?: number;
  }[];
  primaryTiers?: {
    id: "mode1" | "mode2" | "mode3";
    label: string;
    highCardWeightMul: number;
  }[];
  updatedAt: number;
  updatedBy: string;
  labels: Record<string, string>;
  probabilities: InterProb[];
  probabilitiesByMode: Partial<Record<InterMode, InterProb[]>>;
  authStakesRound?: number[];
  recentWins?: number[];
  all?: {
    effectiveMode: string;
    nextMode: string;
    remainingMs: number;
    slotMs: number;
    slotMinutes?: number;
    rotation: string[];
  };
  recentInterLog?: {
    at: number;
    round: number;
    mode: string;
    effectiveMode: string;
    winCard: number;
    authStake: number;
    houseProfit: number;
  }[];
};

type VaultFlagsPreview = {
  interFlags?: {
    interSignal: boolean;
    interWeightPct: number;
    interPriority: number;
  };
};

export function InterAdminPanel({
  inter,
  users,
  vault,
  vaultArcana,
  me,
  active,
  onMsg,
  onReload,
}: {
  inter: InterAdminData;
  users: AdminUserRow[];
  vault?: VaultFlagsPreview;
  vaultArcana?: VaultFlagsPreview;
  me: AuthUser;
  active: boolean;
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
}) {
`;

const interLogic = `
  const [interBusy, setInterBusy] = useState(false);
  const [interSubTab, setInterSubTab] = useState<"live" | "room" | "userWin">(
    "live",
  );
  const [interLive, setInterLive] = useState<{
    at: number;
    phase: string;
    roundNumber: number;
    storedMode: string;
    primaryTier?: string;
    effectiveMode: string;
    winBiasPct: number;
    vaultNet: number;
    authStake: number;
    displayStake: number;
    alerts: { level: string; code: string; message: string }[];
    cards: {
      cardId: number;
      nameVi: string;
      authStake: number;
      liability: number;
      houseProfit: number;
      percent: number;
    }[];
    hint: {
      bestHouseCard: number;
      bestHouseProfit: number;
      worstHouseCard: number;
      worstHouseProfit: number;
    };
    rolling: {
      rounds: number;
      authStakeSum: number;
      houseProfitSum: number;
      playerPayoutApprox: number;
      rtpPct: number | null;
      byMode: {
        mode: string;
        rounds: number;
        authStake: number;
        houseProfit: number;
        rtpPct: number | null;
      }[];
    };
    recent: {
      at: number;
      round: number;
      effectiveMode: string;
      winCard: number;
      authStake: number;
      houseProfit: number;
      vaultNet: number;
    }[];
  } | null>(null);
  const [interLiveBusy, setInterLiveBusy] = useState(false);
  const [winPctDrafts, setWinPctDrafts] = useState<Record<string, string>>({});
  const [winPctFilter, setWinPctFilter] = useState("");
  const [allSlotMinutes, setAllSlotMinutes] = useState("5");
  const [rotationDraft, setRotationDraft] = useState<RotateStep[]>([
    ...DEFAULT_ALL_ROTATION,
  ]);
  const [rotationAddMode, setRotationAddMode] = useState<RotateStep>("auto");
  const [winBiasDraft, setWinBiasDraft] = useState("0");
  const [vaultLinkDraft, setVaultLinkDraft] = useState({
    enabled: false,
    lossThresholdXu: "50000",
    profitThresholdXu: "50000",
    onLossMode: "small",
    onProfitMode: "big",
    combine: "any" as "any" | "weighted" | "priority",
    idleMode: "" as string,
  });

  useEffect(() => {
    if (inter.allSlotMinutes != null) {
      setAllSlotMinutes(String(inter.allSlotMinutes));
    }
  }, [inter.allSlotMinutes]);

  useEffect(() => {
    const r = inter.allRotation;
    if (r?.length) {
      setRotationDraft(r.filter((x): x is RotateStep => isRotateStep(x)));
    }
  }, [inter.allRotation]);

  useEffect(() => {
    if (inter.winBiasPct != null) {
      setWinBiasDraft(String(inter.winBiasPct));
    }
    const v = inter.vaultInterLink;
    if (v) {
      setVaultLinkDraft({
        enabled: !!v.enabled,
        lossThresholdXu: String(v.lossThresholdXu),
        profitThresholdXu: String(v.profitThresholdXu),
        onLossMode: v.onLossMode || "small",
        onProfitMode: v.onProfitMode || "big",
        combine:
          v.combine === "weighted" || v.combine === "priority"
            ? v.combine
            : "any",
        idleMode: v.idleMode ?? "",
      });
    }
  }, [inter.winBiasPct, inter.vaultInterLink]);

  const interRotateOptions = useMemo(
    () =>
      inter.rotateCatalog?.length ? inter.rotateCatalog : FALLBACK_ROTATE_CATALOG,
    [inter.rotateCatalog],
  );

  const loadInterLive = useCallback(async () => {
    if (!hasCapability(me, "inter_control")) return;
    setInterLiveBusy(true);
    try {
      const r = await api<{ ok: true; live: NonNullable<typeof interLive> }>(
        "/api/mainadmin/inter/live",
      );
      setInterLive(r.live);
    } catch {
      /* ignore poll errors */
    } finally {
      setInterLiveBusy(false);
    }
  }, [me]);

  useEffect(() => {
    if (!active || interSubTab !== "live" || !hasCapability(me, "inter_control"))
      return;
    void loadInterLive();
    const id = window.setInterval(() => {
      void loadInterLive();
    }, 2500);
    return () => window.clearInterval(id);
  }, [active, interSubTab, me, loadInterLive]);

  useEffect(() => {
    if (!active || !isInterRotating(inter.mode)) return;
    const id = window.setInterval(() => {
      void onReload();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [active, inter.mode, onReload]);

  const interModeLabel = (mode: string) => {
    const fromServer = inter.labels?.[mode];
    if (fromServer) return fromServer.split(" — ")[0] ?? fromServer;
    if (mode === "all") return "ALL (xoay slot)";
    if (PACK_MODES.includes(mode as PackMode)) return mode.toUpperCase();
    if (mode.startsWith("pack")) return mode;
    return \`Ép lá #\${mode}\`;
  };

  const setInterMode = async (mode: InterMode) => {
    if (interBusy) return;
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      onMsg(\`Inter → \${interModeLabel(mode)}\`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi Inter");
    } finally {
      setInterBusy(false);
    }
  };

  const setInterPrimaryTier = async (tier: "mode1" | "mode2" | "mode3") => {
    if (interBusy) return;
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ primaryTier: tier }),
      });
      onMsg(
        tier === "mode3"
          ? "MODE3 — % lá 4–8 ×1/4 (áp ALL + mode đơn)"
          : tier === "mode2"
            ? "MODE2 — % lá 4–8 ×1/2 (áp ALL + mode đơn)"
            : "MODE1 — bình thường",
      );
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi MODE tier");
    } finally {
      setInterBusy(false);
    }
  };

  const applyAllSlotMinutes = async () => {
    if (interBusy) return;
    const m = Math.floor(Number(allSlotMinutes));
    if (!Number.isFinite(m) || m < 1 || m > 9) {
      onMsg("Chọn 1–9 phút mỗi slot ALL (< 10 phút)");
      return;
    }
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ allSlotMinutes: m }),
      });
      onMsg(\`ALL: mỗi slot \${m} phút\`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi cấu hình ALL");
    } finally {
      setInterBusy(false);
    }
  };

  const saveAllRotation = async () => {
    if (interBusy) return;
    if (rotationDraft.length < 2) {
      onMsg("Chuỗi xoay cần ít nhất 2 bước");
      return;
    }
    if (rotationDraft.length > 20) {
      onMsg("Chuỗi xoay tối đa 20 bước");
      return;
    }
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ rotation: rotationDraft }),
      });
      onMsg("Đã lưu chuỗi xoay ALL");
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu chuỗi xoay");
    } finally {
      setInterBusy(false);
    }
  };

  const resetAllRotationDefault = async () => {
    const def =
      (inter.defaultRotation?.filter((x): x is RotateStep =>
        isRotateStep(x),
      ) as RotateStep[] | undefined) ?? DEFAULT_ALL_ROTATION;
    setRotationDraft([...def]);
    if (interBusy) return;
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ rotation: def }),
      });
      onMsg("Đã khôi phục chuỗi xoay mặc định");
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi khôi phục chuỗi");
    } finally {
      setInterBusy(false);
    }
  };

  const moveRotationStep = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= rotationDraft.length) return;
    setRotationDraft((steps) => {
      const copy = [...steps];
      const t = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = t;
      return copy;
    });
  };

  const removeRotationStep = (index: number) => {
    setRotationDraft((steps) => steps.filter((_, i) => i !== index));
  };

  const addRotationStep = () => {
    if (rotationDraft.length >= 20) {
      onMsg("Tối đa 20 bước");
      return;
    }
    setRotationDraft((steps) => [...steps, rotationAddMode]);
  };

  const saveWinBiasAndVaultLink = async () => {
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({
          winBiasPct: Number(winBiasDraft),
          vaultInterLink: {
            enabled: vaultLinkDraft.enabled,
            lossThresholdXu: Number(vaultLinkDraft.lossThresholdXu),
            profitThresholdXu: Number(vaultLinkDraft.profitThresholdXu),
            onLossMode: vaultLinkDraft.onLossMode,
            onProfitMode: vaultLinkDraft.onProfitMode,
            combine: vaultLinkDraft.combine,
            idleMode: vaultLinkDraft.idleMode || null,
          },
        }),
      });
      onMsg("Đã lưu winBias + Vault→Inter link");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi lưu Inter bias");
    } finally {
      setInterBusy(false);
    }
  };

  const setUserOutcome = async (
    userId: string,
    mode: "normal" | "win" | "lose",
    winPct?: number,
  ) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({
          userId,
          mode,
          ...(mode === "win" && winPct != null ? { winPct } : {}),
        }),
      });
      onMsg(
        mode === "normal"
          ? "Đã về Normal"
          : mode === "win"
            ? \`User: WIN \${winPct ?? 100}%\`
            : "User: ưu tiên LOSE",
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserWinPct = async (userId: string, winPct: number) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({ userId, winPct }),
      });
      onMsg(\`Win % → \${Math.max(80, Math.min(100, Math.floor(winPct)))}%\`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  return (
    <>
`;

const interFooter = `
    </>
  );
}
`;

const interPanel =
  interHeader +
  interLogic +
  xInter(interJsxRaw)
    .split("\n")
    .map((l) => "      " + l)
    .join("\n") +
  interFooter;

fs.writeFileSync(path.join(root, "InterAdminPanel.tsx"), interPanel);
console.log("Wrote InterAdminPanel.tsx", interPanel.split("\n").length, "lines");

const vaultHeader = `import { FormEvent, useEffect, useState } from "react";
import { api } from "../../../auth";
import { formatXu } from "../../../cards";
import { formatGem } from "../../../gem";
import type { AdminUserRow } from "./UsersAdminPanel";

export type ManagedGame = "tarot" | "arcana" | "gem";

type VaultInterFlags = {
  interSignal: boolean;
  interWeightPct: number;
  interPriority: number;
  lossThresholdXu: number;
  profitThresholdXu: number;
  onLossMode: string;
  onProfitMode: string;
  usePercent?: boolean;
  lossPct?: number;
  profitPct?: number;
};

export type VaultSnapshot = {
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  totalMinted: number;
  totalBurned: number;
  netHouse: number;
  netFromPlay?: number;
  interFlags?: VaultInterFlags;
  health?: {
    edgePct: number;
    blendEdgePct: number;
    flowHourEdgePct: number;
    flowDayEdgePct: number;
    netVsBalancePct: number;
    band: string;
    steerIntensity: number;
  };
  breakdown?: Record<string, { count: number; sum: number }>;
  ledger?: VaultLedgerRow[];
};

type VaultLedgerRow = {
  id: string;
  at: number;
  type: string;
  amount: number;
  balanceAfter: number;
  username?: string;
  userId?: string;
  byUsername?: string;
  note?: string;
};

const LEDGER_LABEL: Record<string, string> = {
  stake_in: "Xu vào",
  stake_refund: "Hoàn xu",
  payout_out: "Trả xu",
  mint: "Bơm kho",
  burn: "Rút kho",
  grant_user: "Cấp user",
  seize_user: "Thu user",
  set_balance: "Đặt số dư",
  coupon_mint: "Coupon",
  admin_adjust: "Admin chỉnh xu",
  chat_fee: "Phí chat",
  cultivation_fee: "Phí cảnh giới",
  ring_fee: "Nhẫn / cầu hôn",
  pocket_fee: "Fee Pocket → Kho",
};

function vaultLabel(g: ManagedGame): string {
  if (g === "arcana") return "Kho Arcana";
  if (g === "gem") return "Kho Gem";
  return "Kho Tarot";
}

function vaultApiBase(g: ManagedGame): string {
  if (g === "arcana") return "/api/mainadmin/vault-arcana";
  if (g === "gem") return "/api/mainadmin/vault-gem";
  return "/api/mainadmin/vault";
}

function vaultKeyOf(g: ManagedGame): "tarot" | "arcana" | "gem" {
  return g;
}

function defaultVaultFlags(managedGame: ManagedGame): VaultInterFlags {
  if (managedGame === "arcana") {
    return {
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
  }
  if (managedGame === "gem") {
    return {
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
  }
  return {
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
}

export function VaultAdminPanel({
  activeVault,
  managedGame,
  users,
  onMsg,
  onReload,
}: {
  activeVault: VaultSnapshot;
  managedGame: ManagedGame;
  users: AdminUserRow[];
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
}) {
  const [vaultDelta, setVaultDelta] = useState("10000");
  const [vaultSet, setVaultSet] = useState("");
  const [vaultNote, setVaultNote] = useState("");
  const [vaultUser, setVaultUser] = useState({
    userId: "",
    amount: "1000",
  });
  const [vaultFlagsDraft, setVaultFlagsDraft] = useState<VaultInterFlags>(
    defaultVaultFlags(managedGame),
  );
  const [vaultFlagsBusy, setVaultFlagsBusy] = useState(false);
  const [vaultLedgerFilter, setVaultLedgerFilter] = useState<string>("all");
  const [vaultRowDetail, setVaultRowDetail] = useState<VaultLedgerRow | null>(
    null,
  );

  useEffect(() => {
    setVaultSet(String(activeVault.balance));
    if (activeVault.interFlags) {
      setVaultFlagsDraft({
        usePercent: true,
        lossPct: 8,
        profitPct: 12,
        ...activeVault.interFlags,
      });
    } else {
      setVaultFlagsDraft(defaultVaultFlags(managedGame));
    }
  }, [activeVault, managedGame]);

  const vaultAdjust = async (delta: number) => {
    try {
      await api(\`\${vaultApiBase(managedGame)}/adjust\`, {
        method: "POST",
        body: JSON.stringify({ delta, note: vaultNote }),
      });
      onMsg(
        delta > 0
          ? \`Đã bơm \${vaultLabel(managedGame)}\`
          : \`Đã rút \${vaultLabel(managedGame)}\`,
      );
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const vaultSetBalance = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(\`\${vaultApiBase(managedGame)}/set\`, {
        method: "POST",
        body: JSON.stringify({
          balance: Number(vaultSet),
          note: vaultNote,
        }),
      });
      onMsg(\`Đã đặt số dư \${vaultLabel(managedGame)}\`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const vaultGrant = async () => {
    if (managedGame === "arcana") {
      onMsg("Cấp/thu xu chỉ dùng Kho Tarot (ví vận hành chung)");
      return;
    }
    try {
      const unit = managedGame === "gem" ? "Gem" : "xu";
      await api(\`\${vaultApiBase(managedGame)}/grant\`, {
        method: "POST",
        body: JSON.stringify({
          userId: vaultUser.userId,
          amount: Number(vaultUser.amount),
          note: vaultNote,
        }),
      });
      onMsg(\`Đã cấp \${unit} từ kho cho user\`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const vaultSeize = async () => {
    if (managedGame === "arcana") {
      onMsg("Cấp/thu xu chỉ dùng Kho Tarot (ví vận hành chung)");
      return;
    }
    try {
      const unit = managedGame === "gem" ? "Gem" : "xu";
      await api(\`\${vaultApiBase(managedGame)}/seize\`, {
        method: "POST",
        body: JSON.stringify({
          userId: vaultUser.userId,
          amount: Number(vaultUser.amount),
          note: vaultNote,
        }),
      });
      onMsg(\`Đã thu \${unit} user về kho\`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const saveVaultInterFlags = async () => {
    setVaultFlagsBusy(true);
    try {
      await api("/api/mainadmin/vault-flags", {
        method: "POST",
        body: JSON.stringify({
          vaultKey: vaultKeyOf(managedGame),
          flags: vaultFlagsDraft,
        }),
      });
      onMsg(\`Đã lưu flag Inter · \${vaultLabel(managedGame)}\`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi lưu flag kho");
    } finally {
      setVaultFlagsBusy(false);
    }
  };

  return (
    <>
`;

const vaultDetailModal = `
      {vaultRowDetail && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setVaultRowDetail(null)}
        >
          <div
            className="app-panel w-full max-w-md p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="play-heading text-sm">Chi tiết giao dịch kho</p>
              <button
                type="button"
                className="app-btn-soft !px-2.5 !py-0.5 !text-[10px]"
                onClick={() => setVaultRowDetail(null)}
              >
                Đóng
              </button>
            </div>
            <dl className="space-y-1.5 text-[11px]">
              {(
                [
                  ["Loại", LEDGER_LABEL[vaultRowDetail.type] ?? vaultRowDetail.type],
                  ["Số xu", \`\${vaultRowDetail.amount >= 0 ? "+" : ""}\${formatXu(vaultRowDetail.amount)}\`],
                  ["Số dư sau", formatXu(vaultRowDetail.balanceAfter)],
                  ["Thời gian", new Date(vaultRowDetail.at).toLocaleString("vi-VN")],
                  ["User", vaultRowDetail.username || "—"],
                  ["User ID", vaultRowDetail.userId || "—"],
                  ["Bởi", vaultRowDetail.byUsername],
                  ["Ghi chú", vaultRowDetail.note || "—"],
                  ["ID GD", vaultRowDetail.id],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-[var(--wood-deep)]/8 py-1"
                >
                  <dt className="shrink-0 text-[var(--play-muted)]">{k}</dt>
                  <dd className="text-right font-semibold text-[var(--play-ink)] break-all">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
`;

const vaultFooter = `
    </>
  );
}
`;

const vaultPanel =
  vaultHeader +
  xVault(vaultJsxRaw)
    .split("\n")
    .map((l) => "      " + l)
    .join("\n") +
  vaultDetailModal +
  vaultFooter;

fs.writeFileSync(path.join(root, "VaultAdminPanel.tsx"), vaultPanel);
console.log("Wrote VaultAdminPanel.tsx", vaultPanel.split("\n").length, "lines");
