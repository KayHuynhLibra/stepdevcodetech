import { useCallback, useEffect, useMemo, useState } from "react";
import { api, hasCapability, type AuthUser } from "../../../auth";
import { CARDS, formatXu } from "../../../cards";

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
  nameVi?: string;
  liability?: number;
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
  botLogs = [],
  me,
  active,
  onMsg,
  onReload,
}: {
  inter: InterAdminData;
  users: AuthUser[];
  vault?: VaultFlagsPreview;
  vaultArcana?: VaultFlagsPreview;
  botLogs?: {
    id: string;
    botId: string;
    message?: string;
    round: number;
    at: number;
  }[];
  me: AuthUser;
  active: boolean;
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
}) {

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
    return `Ép lá #${mode}`;
  };

  const setInterMode = async (mode: InterMode) => {
    if (interBusy) return;
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      onMsg(`Inter → ${interModeLabel(mode)}`);
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
      onMsg(`ALL: mỗi slot ${m} phút`);
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
            ? `User: WIN ${winPct ?? 100}%`
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
      onMsg(`Win % → ${Math.max(80, Math.min(100, Math.floor(winPct)))}%`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  return (
    <>
              <>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["live", "Quan sát live"],
                      ["room", "Phòng Inter"],
                      ["userWin", "User Win %"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setInterSubTab(id)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        interSubTab === id
                          ? "bg-[var(--wood-deep)] text-white"
                          : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
      
                {interSubTab === "live" && (
                  <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="play-heading text-sm">Inter — quan sát realtime</p>
                        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                          Liability / house profit theo lá · RTP ~50 ván · cảnh báo
                          hút/nhả. Tự refresh ~2.5s.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={interLiveBusy}
                        onClick={() => void loadInterLive()}
                        className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        Làm mới
                      </button>
                    </div>
                    {!interLive ? (
                      <p className="text-xs text-[var(--play-muted)]">Đang tải…</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            [
                              ["Phase", interLive.phase],
                              ["Ván", `#${interLive.roundNumber}`],
                              [
                                "Mode",
                                `${(interLive.primaryTier ?? "mode1").toUpperCase()}·${interLive.storedMode}→${interLive.effectiveMode}`,
                              ],
                              ["Kho net", formatXu(interLive.vaultNet)],
                              ["Auth stake", formatXu(interLive.authStake)],
                              ["Display stake", formatXu(interLive.displayStake)],
                              ["Bias %", String(interLive.winBiasPct)],
                              [
                                "RTP~50",
                                interLive.rolling.rtpPct != null
                                  ? `${interLive.rolling.rtpPct}%`
                                  : "—",
                              ],
                            ] as const
                          ).map(([k, v]) => (
                            <div
                              key={k}
                              className="rounded-lg bg-white/75 px-2.5 py-2 ring-1 ring-[var(--wood-deep)]/10"
                            >
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
                                {k}
                              </p>
                              <p className="mt-0.5 truncate font-play text-xs font-bold text-[var(--play-ink)]">
                                {v}
                              </p>
                            </div>
                          ))}
                        </div>
                        {interLive.alerts.length > 0 && (
                          <ul className="space-y-1">
                            {interLive.alerts.map((a) => (
                              <li
                                key={a.code + a.message}
                                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1 ${
                                  a.level === "critical"
                                    ? "bg-rose-50 text-rose-900 ring-rose-300"
                                    : a.level === "warn"
                                      ? "bg-amber-50 text-amber-950 ring-amber-300"
                                      : "bg-sky-50 text-sky-950 ring-sky-300"
                                }`}
                              >
                                {a.message}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-[10px] text-[var(--play-muted)]">
                          Lá nhà lời max #{interLive.hint.bestHouseCard} (~
                          {formatXu(interLive.hint.bestHouseProfit)}) · rủi ro #
                          {interLive.hint.worstHouseCard} (~
                          {formatXu(interLive.hint.worstHouseProfit)})
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[32rem] text-left text-[11px]">
                            <thead>
                              <tr className="text-[9px] uppercase tracking-wide text-[var(--play-muted)]">
                                <th className="py-1 pr-2">Lá</th>
                                <th className="py-1 pr-2">Xu auth</th>
                                <th className="py-1 pr-2">Liability</th>
                                <th className="py-1 pr-2">House nếu thắng</th>
                                <th className="py-1">P(mode)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {interLive.cards.map((c) => (
                                <tr
                                  key={c.cardId}
                                  className="border-t border-[var(--wood-deep)]/10"
                                >
                                  <td className="py-1.5 pr-2 font-semibold">
                                    #{c.cardId} {c.nameVi}
                                  </td>
                                  <td className="py-1.5 pr-2 tabular-nums">
                                    {formatXu(c.authStake)}
                                  </td>
                                  <td className="py-1.5 pr-2 tabular-nums">
                                    {formatXu(c.liability)}
                                  </td>
                                  <td
                                    className={`py-1.5 pr-2 font-play tabular-nums ${
                                      c.houseProfit >= 0
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }`}
                                  >
                                    {formatXu(Math.round(c.houseProfit))}
                                  </td>
                                  <td className="py-1.5 font-play tabular-nums">
                                    {c.percent}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-[var(--play-muted)]">
                              RTP theo mode (~50 ván)
                            </p>
                            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px]">
                              {interLive.rolling.byMode.length === 0 ? (
                                <li className="text-[var(--play-muted)]">
                                  Chưa có ván ghi nhận sau deploy
                                </li>
                              ) : (
                                interLive.rolling.byMode.map((m) => (
                                  <li
                                    key={m.mode}
                                    className="flex justify-between gap-2 rounded bg-white/70 px-2 py-1 ring-1 ring-[var(--wood-deep)]/10"
                                  >
                                    <span className="font-semibold">{m.mode}</span>
                                    <span className="tabular-nums text-[var(--play-muted)]">
                                      {m.rounds}v · RTP{" "}
                                      {m.rtpPct != null ? `${m.rtpPct}%` : "—"} · nhà{" "}
                                      {formatXu(m.houseProfit)}
                                    </span>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-[var(--play-muted)]">
                              Ván gần đây
                            </p>
                            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px]">
                              {interLive.recent.length === 0 ? (
                                <li className="text-[var(--play-muted)]">
                                  Chờ khóa ván đầu
                                </li>
                              ) : (
                                interLive.recent.map((r) => (
                                  <li
                                    key={`${r.round}-${r.at}`}
                                    className="flex justify-between gap-2 rounded bg-white/70 px-2 py-1 ring-1 ring-[var(--wood-deep)]/10"
                                  >
                                    <span>
                                      #{r.round} · {r.effectiveMode} → lá {r.winCard}
                                    </span>
                                    <span
                                      className={`tabular-nums ${
                                        r.houseProfit >= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }`}
                                    >
                                      {formatXu(Math.round(r.houseProfit))}
                                    </span>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                )}
      
                {interSubTab === "userWin" && (
                  <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
                    <div>
                      <p className="play-heading text-sm">User Win % — ép thắng theo xác suất</p>
                      <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                        Mode Win không còn luôn 100%. Chỉnh <strong>80–100%</strong>:
                        mỗi ván user có đặt xu sẽ được ép thắng với xác suất đó; phần còn
                        lại theo Inter phòng. 100% = như cũ.
                      </p>
                    </div>
                    <input
                      value={winPctFilter}
                      onChange={(e) => setWinPctFilter(e.target.value)}
                      placeholder="Lọc username / ID…"
                      className="app-input w-full !py-1.5 text-xs"
                    />
                    <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                      {[...users]
                        .filter((u) => u.role !== "mainadmin")
                        .filter((u) => {
                          const q = winPctFilter.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            u.username.toLowerCase().includes(q) ||
                            (u.code || "").toLowerCase().includes(q) ||
                            (u.displayName || "").toLowerCase().includes(q)
                          );
                        })
                        .sort((a, b) => {
                          const aw = (a.outcomeMode ?? "normal") === "win" ? 0 : 1;
                          const bw = (b.outcomeMode ?? "normal") === "win" ? 0 : 1;
                          if (aw !== bw) return aw - bw;
                          return a.username.localeCompare(b.username, "vi");
                        })
                        .map((u) => {
                          const om = u.outcomeMode ?? "normal";
                          const pct =
                            winPctDrafts[u.id] !== undefined
                              ? winPctDrafts[u.id]!
                              : String(u.outcomeWinPct ?? 100);
                          const pctNum = Math.max(
                            80,
                            Math.min(100, Math.floor(Number(pct)) || 100),
                          );
                          return (
                            <li
                              key={u.id}
                              className={`rounded-lg px-2.5 py-2 text-xs ring-1 ${
                                om === "win"
                                  ? "bg-emerald-50 ring-emerald-300/70"
                                  : "bg-white/70 ring-[var(--wood-deep)]/10"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-[var(--play-ink)]">
                                    {u.username}{" "}
                                    <span className="text-[10px] font-normal text-[var(--play-muted)]">
                                      ID {u.code || "—"} · {u.role}
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-[var(--play-muted)]">
                                    {om === "win"
                                      ? `Đang WIN @ ${u.outcomeWinPct ?? 100}%`
                                      : om === "lose"
                                        ? "Đang LOSE"
                                        : "Normal (theo phòng)"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(
                                    [
                                      ["lose", "Lose"],
                                      ["normal", "Normal"],
                                      ["win", "Win"],
                                    ] as const
                                  ).map(([mode, label]) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() =>
                                        void setUserOutcome(
                                          u.id,
                                          mode,
                                          mode === "win" ? pctNum : undefined,
                                        )
                                      }
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                        om === mode
                                          ? mode === "win"
                                            ? "bg-emerald-600 text-white"
                                            : mode === "lose"
                                              ? "bg-rose-600 text-white"
                                              : "bg-[var(--wood-deep)] text-white"
                                          : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-end gap-2">
                                <label className="min-w-[10rem] flex-1 text-[10px] font-semibold text-[var(--play-muted)]">
                                  Win % ({pctNum}%)
                                  <input
                                    type="range"
                                    min={80}
                                    max={100}
                                    step={1}
                                    value={pctNum}
                                    onChange={(e) =>
                                      setWinPctDrafts((d) => ({
                                        ...d,
                                        [u.id]: e.target.value,
                                      }))
                                    }
                                    className="mt-1 w-full accent-emerald-600"
                                  />
                                </label>
                                <input
                                  type="number"
                                  min={80}
                                  max={100}
                                  value={pct}
                                  onChange={(e) =>
                                    setWinPctDrafts((d) => ({
                                      ...d,
                                      [u.id]: e.target.value,
                                    }))
                                  }
                                  className="app-input !w-16 !py-1 text-center text-[11px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => void setUserWinPct(u.id, pctNum)}
                                  className="rounded-full bg-emerald-700 px-3 py-1.5 text-[10px] font-bold text-white"
                                >
                                  Lưu % (bật Win)
                                </button>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </section>
                )}
      
                {interSubTab === "room" && (
              <>
                <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="play-heading text-sm">Inter — thuật toán lá thắng</p>
                      <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                        <strong>MODE1/2/3</strong> phủ toàn cục (ALL + mode đơn) →
                        thuật toán phía sau → bias / vault.
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300/60">
                      {(inter.primaryTier ?? "mode1").toUpperCase()}
                      {inter.primaryTier === "mode3"
                        ? " · ÷4#4–8"
                        : inter.primaryTier === "mode2"
                          ? " · ÷2#4–8"
                          : ""}
                      {" · "}
                      {isInterRotating(inter.mode)
                        ? `${inter.mode === "all" ? "ALL" : inter.mode.toUpperCase()}→${(inter.effectiveMode ?? inter.all?.effectiveMode ?? "?").toUpperCase()}`
                        : interModeLabel(inter.mode)}
                    </span>
                  </div>
      
                  {/* ===== Cấp cao: MODE1/2/3 — phủ ALL + mode đơn ===== */}
                  <div className="space-y-1.5 rounded-xl bg-indigo-50/90 p-3 ring-1 ring-indigo-200/70">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-950">
                      1 · Cấp cao — MODE1 / MODE2 / MODE3 (áp mọi thuật toán)
                    </p>
                    <p className="text-[10px] text-indigo-900/75">
                      Độc lập với ALL / mode đơn / Bộ 3–4. MODE2{" "}
                      <strong>×1/2</strong>, MODE3 <strong>×1/4</strong> % lá 4–8 sau
                      mọi thuật toán — phần % đẩy về 1–3.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(
                        inter.primaryTiers ?? [
                          {
                            id: "mode1" as const,
                            label: "MODE1 — bình thường",
                            highCardWeightMul: 1,
                          },
                          {
                            id: "mode2" as const,
                            label: "MODE2 — % lá 4–8 ×1/2",
                            highCardWeightMul: 0.5,
                          },
                          {
                            id: "mode3" as const,
                            label: "MODE3 — % lá 4–8 ×1/4",
                            highCardWeightMul: 0.25,
                          },
                        ]
                      ).map((tier) => {
                        const active =
                          (inter.primaryTier ?? "mode1") === tier.id;
                        const tone =
                          tier.id === "mode3"
                            ? "active-mode3"
                            : tier.id === "mode2"
                              ? "active-mode2"
                              : "active-mode1";
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            disabled={interBusy}
                            onClick={() => void setInterPrimaryTier(tier.id)}
                            className={`rounded-xl px-3 py-3.5 text-left transition ring-2 ${
                              active
                                ? tone === "active-mode3"
                                  ? "bg-fuchsia-800 text-white ring-fuchsia-950 shadow-md"
                                  : tone === "active-mode2"
                                    ? "bg-rose-700 text-white ring-rose-800 shadow-md"
                                    : "bg-indigo-700 text-white ring-indigo-800 shadow-md"
                                : "bg-white text-[var(--play-ink)] ring-indigo-200/80 hover:bg-indigo-50"
                            } ${interBusy ? "opacity-60" : ""}`}
                          >
                            <p className="text-sm font-bold">
                              {tier.id === "mode1"
                                ? "MODE1"
                                : tier.id === "mode2"
                                  ? "MODE2"
                                  : "MODE3"}
                            </p>
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                active ? "text-white/85" : "text-[var(--play-muted)]"
                              }`}
                            >
                              {tier.label}
                            </p>
                            <p
                              className={`mt-1.5 font-mono text-[9px] ${
                                active ? "text-white/70" : "text-[var(--play-muted)]"
                              }`}
                            >
                              lá 4–8 ×{tier.highCardWeightMul}
                              {" · phủ ALL / đơn / pack"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
      
                  <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-[var(--wood-deep)]/15">
                    <p className="text-xs font-bold text-[var(--play-ink)]">
                      Win bias + Vault→Inter
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                      Bias + nghiêng Big (5–8), − nghiêng Small (1–4). Link gộp flag
                      từng kho (tab Kho · interSignal). Combine: any / weighted /
                      priority.
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        winBiasPct (−50…50)
                        <input
                          value={winBiasDraft}
                          onChange={(e) => setWinBiasDraft(e.target.value)}
                          type="number"
                          min={-50}
                          max={50}
                          className="app-input mt-0.5 !w-24 !py-1"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] font-semibold">
                        <input
                          type="checkbox"
                          checked={vaultLinkDraft.enabled}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              enabled: e.target.checked,
                            }))
                          }
                        />
                        Bật vault link
                      </label>
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        Combine
                        <select
                          value={vaultLinkDraft.combine}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              combine: e.target.value as
                                | "any"
                                | "weighted"
                                | "priority",
                            }))
                          }
                          className="app-input mt-0.5 !py-1"
                        >
                          <option value="any">any (lỗ ưu tiên)</option>
                          <option value="weighted">weighted (gộp net)</option>
                          <option value="priority">priority (kho ưu tiên)</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        Ngưỡng lỗ
                        <input
                          value={vaultLinkDraft.lossThresholdXu}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              lossThresholdXu: e.target.value,
                            }))
                          }
                          className="app-input mt-0.5 !w-28 !py-1"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        Ngưỡng lãi
                        <input
                          value={vaultLinkDraft.profitThresholdXu}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              profitThresholdXu: e.target.value,
                            }))
                          }
                          className="app-input mt-0.5 !w-28 !py-1"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        Khi lỗ
                        <select
                          value={vaultLinkDraft.onLossMode}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              onLossMode: e.target.value,
                            }))
                          }
                          className="app-input mt-0.5 !py-1"
                        >
                          <option value="small">small</option>
                          <option value="app">app</option>
                          <option value="fed">fed</option>
                          <option value="cool">cool</option>
                          <option value="vaultguard">vaultguard</option>
                          <option value="vaultpct">vaultpct</option>
                          <option value="flowguard">flowguard</option>
                          <option value="moneysteer">moneysteer</option>
                          <option value="crowdcap">crowdcap</option>
                          <option value="fogbreak">fogbreak</option>
                          <option value="smartai">smartai</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        Khi lãi
                        <select
                          value={vaultLinkDraft.onProfitMode}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              onProfitMode: e.target.value,
                            }))
                          }
                          className="app-input mt-0.5 !py-1"
                        >
                          <option value="big">big</option>
                          <option value="user">user</option>
                          <option value="softuser">softuser</option>
                          <option value="hot">hot</option>
                          <option value="auto">auto</option>
                          <option value="moneysteer">moneysteer</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                        Idle (trung tính)
                        <select
                          value={vaultLinkDraft.idleMode}
                          onChange={(e) =>
                            setVaultLinkDraft((d) => ({
                              ...d,
                              idleMode: e.target.value,
                            }))
                          }
                          className="app-input mt-0.5 !py-1"
                        >
                          <option value="">Giữ mode hiện tại</option>
                          <option value="auto">auto</option>
                          <option value="all">all</option>
                          <option value="flat">flat</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={interBusy}
                        onClick={() => void saveWinBiasAndVaultLink()}
                        className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        Lưu bias / link
                      </button>
                    </div>
                    {(vault?.interFlags || vaultArcana?.interFlags) && (
                      <p className="mt-2 text-[10px] text-[var(--play-muted)]">
                        Tín hiệu: Tarot{" "}
                        <strong>
                          {vault?.interFlags?.interSignal ? "ON" : "OFF"}
                        </strong>
                        {vault?.interFlags
                          ? ` w${vault.interFlags.interWeightPct} p${vault.interFlags.interPriority}`
                          : ""}
                        {" · "}
                        Arcana{" "}
                        <strong>
                          {vaultArcana?.interFlags?.interSignal ? "ON" : "OFF"}
                        </strong>
                        {vaultArcana?.interFlags
                          ? ` w${vaultArcana.interFlags.interWeightPct} p${vaultArcana.interFlags.interPriority}`
                          : ""}
                        {" — chỉnh chi tiết ở tab Kho."}
                      </p>
                    )}
                  </div>
      
                  {isInterRotating(inter.mode) && inter.all && (
                    <div className="rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-300/70">
                      <p className="text-xs font-bold text-amber-950">
                        Đang chạy:{" "}
                        <span className="uppercase">
                          {inter.all.effectiveMode}
                        </span>
                        {" · "}
                        tiếp theo{" "}
                        <span className="uppercase">{inter.all.nextMode}</span>
                        {" · "}
                        còn{" "}
                        {Math.floor(
                          Math.max(0, inter.all.remainingMs) / 60000,
                        )}
                        :
                        {String(
                          Math.floor(
                            (Math.max(0, inter.all.remainingMs) / 1000) % 60,
                          ),
                        ).padStart(2, "0")}
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-200/80">
                        <div
                          className="h-full rounded-full bg-amber-600 transition-[width] duration-1000"
                          style={{
                            width: `${Math.max(
                              2,
                              Math.min(
                                100,
                                (1 -
                                  Math.max(0, inter.all.remainingMs) /
                                    Math.max(1, inter.all.slotMs)) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-amber-900/80">
                        Chuỗi: {inter.all.rotation.join(" → ")} (mỗi{" "}
                        {inter.all.slotMinutes ??
                          Math.round(inter.all.slotMs / 60000)}{" "}
                        phút)
                      </p>
                    </div>
                  )}
      
                  <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-amber-200/80">
                    <label className="min-w-[8rem] flex-1 text-[11px] font-semibold text-[var(--play-ink)]">
                      ALL — phút mỗi slot
                      <select
                        value={allSlotMinutes}
                        onChange={(e) => setAllSlotMinutes(e.target.value)}
                        className="app-input mt-1 w-full"
                        disabled={interBusy}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <option key={n} value={String(n)}>
                            {n} phút
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={interBusy}
                      onClick={() => void applyAllSlotMinutes()}
                      className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Áp dụng
                    </button>
                    <p className="w-full text-[10px] text-[var(--play-muted)]">
                      Đang lưu: {inter.allSlotMinutes ?? 5} phút/slot. Đổi phút
                      khi đang ALL sẽ reset lại slot hiện tại.
                    </p>
                  </div>
      
                  <div className="space-y-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-amber-200/80">
                    <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                      Chuỗi xoay ALL (2–20 bước)
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      Thứ tự mode khi Inter = ALL. Lưu chuỗi sẽ reset slot hiện tại
                      nếu đang chạy ALL.
                    </p>
                    <ul className="space-y-1">
                      {rotationDraft.map((step, i) => (
                        <li
                          key={`${step}-${i}`}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-50/90 px-2 py-1.5 ring-1 ring-amber-200/60"
                        >
                          <span className="w-5 text-center text-[10px] font-bold tabular-nums text-amber-900">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 text-xs font-bold uppercase text-[var(--play-ink)]">
                            {step}
                          </span>
                          <button
                            type="button"
                            disabled={interBusy || i === 0}
                            onClick={() => moveRotationStep(i, -1)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--wood-deep)] disabled:opacity-40"
                            title="Lên"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={interBusy || i >= rotationDraft.length - 1}
                            onClick={() => moveRotationStep(i, 1)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--wood-deep)] disabled:opacity-40"
                            title="Xuống"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={interBusy || rotationDraft.length <= 2}
                            onClick={() => removeRotationStep(i)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-rose-700 disabled:opacity-40"
                            title="Xóa"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[7rem] flex-1 text-[11px] font-semibold text-[var(--play-ink)]">
                        Thêm bước
                        <select
                          value={rotationAddMode}
                          onChange={(e) =>
                            setRotationAddMode(e.target.value as RotateStep)
                          }
                          className="app-input mt-1 w-full"
                          disabled={interBusy}
                        >
                          {interRotateOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={interBusy || rotationDraft.length >= 20}
                        onClick={addRotationStep}
                        className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Thêm
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={interBusy}
                        onClick={() => void saveAllRotation()}
                        className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Lưu chuỗi
                      </button>
                      <button
                        type="button"
                        disabled={interBusy}
                        onClick={() => void resetAllRotationDefault()}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/25 disabled:opacity-50"
                      >
                        Khôi phục mặc định
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      Đang lưu trên server:{" "}
                      {(inter.allRotation ?? DEFAULT_ALL_ROTATION).join(" → ")}
                    </p>
                  </div>
      
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                      2 · Tầng thuật toán — ALL / Bộ 3–4 / chuỗi bias
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      Chạy dưới MODE1/MODE2. Pack1/2 = chuỗi bias; Bộ 3–4 = chuỗi khác.
                    </p>
                  </div>
      
                  <button
                    type="button"
                    disabled={interBusy}
                    onClick={() => setInterMode("all")}
                    className={`w-full rounded-xl px-3 py-3 text-left transition ring-1 ${
                      inter.mode === "all"
                        ? "bg-[var(--wood-deep)] text-white ring-[var(--wood)] shadow-sm"
                        : "bg-white/90 text-[var(--play-ink)] ring-amber-300/50 hover:bg-amber-50"
                    } ${interBusy ? "opacity-60" : ""}`}
                  >
                    <p className="text-sm font-bold">
                      ALL — xoay mode ({inter.allSlotMinutes ?? 5} phút/slot)
                      {inter.primaryTier === "mode3"
                        ? " · +MODE3 ÷4#4–8"
                        : inter.primaryTier === "mode2"
                          ? " · +MODE2 ÷2#4–8"
                          : ""}
                    </p>
                    <p
                      className={`mt-1 text-[10px] leading-snug ${
                        inter.mode === "all"
                          ? "text-white/80"
                          : "text-[var(--play-muted)]"
                      }`}
                    >
                      {(inter.allRotation ?? DEFAULT_ALL_ROTATION).join(" → ")}
                    </p>
                  </button>
      
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(inter.modePacks ?? [])
                      .filter(
                        (p) =>
                          p.id === "pack1" ||
                          p.id === "pack2" ||
                          p.id === "pack3" ||
                          p.id === "pack4",
                      )
                      .map((pack) => {
                        const active = inter.mode === pack.id;
                        return (
                          <button
                            key={pack.id}
                            type="button"
                            disabled={interBusy}
                            onClick={() => setInterMode(pack.id)}
                            className={`rounded-xl px-3 py-3 text-left transition ring-1 ${
                              active
                                ? "bg-slate-700 text-white ring-slate-800 shadow-sm"
                                : "bg-white/90 text-[var(--play-ink)] ring-slate-200/60 hover:bg-slate-50"
                            } ${interBusy ? "opacity-60" : ""}`}
                          >
                            <p className="text-sm font-bold">
                              {pack.id === "pack1"
                                ? "Pack1 · chuỗi bias"
                                : pack.id === "pack2"
                                  ? "Pack2 · chuỗi bias"
                                  : pack.label}
                            </p>
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                active ? "text-white/80" : "text-[var(--play-muted)]"
                              }`}
                            >
                              {pack.rotation.length
                                ? pack.rotation.join(" → ")
                                : "—"}
                            </p>
                          </button>
                        );
                      })}
                  </div>
      
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                      3 · Thuật toán đơn — cố định một mode
                      {inter.primaryTier === "mode3"
                        ? " (vẫn ÷4 lá 4–8)"
                        : inter.primaryTier === "mode2"
                          ? " (vẫn ÷2 lá 4–8)"
                          : ""}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {interRotateOptions.map((m) => {
                        const active = inter.mode === m.id;
                        const stakeHint =
                          m.id === "app" ||
                          m.id === "softapp" ||
                          m.id === "user" ||
                          m.id === "fed" ||
                          m.id === "softfed" ||
                          m.id === "hedge" ||
                          m.id === "contrarian" ||
                          m.id === "momentum" ||
                          m.id === "sparse" ||
                          m.id === "dense" ||
                          m.id === "crowdcap" ||
                          m.id === "fogbreak" ||
                          m.id === "smartai";
                        return (
                          <button
                            key={m.id}
                            type="button"
                            disabled={interBusy}
                            onClick={() => setInterMode(m.id)}
                            className={`rounded-xl px-3 py-2.5 text-left transition ring-1 ${
                              active
                                ? stakeHint
                                  ? "bg-rose-600 text-white ring-rose-700 shadow-sm"
                                  : m.id === "fogbreak" ||
                                      m.id === "smartai" ||
                                      m.id === "cool"
                                    ? "bg-indigo-700 text-white ring-indigo-800 shadow-sm"
                                    : "bg-[var(--wood-deep)] text-white ring-[var(--wood-deep)] shadow-sm"
                                : "bg-white/90 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
                            } ${interBusy ? "opacity-60" : ""}`}
                          >
                            <p className="text-xs font-bold uppercase">{m.id}</p>
                            <p
                              className={`mt-0.5 text-[10px] leading-snug ${
                                active ? "text-white/80" : "text-[var(--play-muted)]"
                              }`}
                            >
                              {m.label.replace(/^[^:]+:\s*/, "")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
      
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                      Force — ép lá thắng (100%)
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {CARDS.map((card) => {
                        const id = String(card.id) as ForceCardMode;
                        const active = inter.mode === id;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            disabled={interBusy}
                            onClick={() => setInterMode(id)}
                            className={`rounded-xl px-2 py-2.5 text-left transition ring-1 ${
                              active
                                ? "bg-amber-500 text-white ring-amber-600 shadow-sm"
                                : "bg-white/90 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
                            } ${interBusy ? "opacity-60" : ""}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <img
                                src={card.image}
                                alt=""
                                className="h-9 w-6 rounded object-cover"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-bold">#{card.id}</p>
                                <p
                                  className={`truncate text-[9px] leading-tight ${
                                    active ? "text-white/80" : "text-[var(--play-muted)]"
                                  }`}
                                >
                                  {card.nameVi}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
      
                  <p className="text-[10px] text-[var(--play-muted)]">
                    {inter.labels[inter.mode] ??
                      interModeLabel(inter.mode)}
                    {inter.updatedBy ? (
                      <>
                        {" "}
                        · cập nhật bởi <strong>{inter.updatedBy}</strong>
                        {inter.updatedAt
                          ? ` · ${new Date(inter.updatedAt).toLocaleString("vi-VN")}`
                          : null}
                      </>
                    ) : null}
                  </p>
                </section>
      
                <section className="app-panel mt-3 space-y-2 p-3">
                  <p className="play-heading text-sm">Cầu auth + lời nhà (ván này)</p>
                  <p className="text-[10px] text-[var(--play-muted)]">
                    Stake user đăng nhập · Lời ước lượng nếu lá đó thắng
                    {inter.recentWins && inter.recentWins.length > 0
                      ? ` · cool gần đây: #${inter.recentWins.join(", #")}`
                      : ""}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                    {CARDS.map((card, i) => {
                      const stake = inter.authStakesRound?.[i] ?? 0;
                      const profit =
                        inter.probabilities.find((p) => p.cardId === card.id)
                          ?.houseProfit ?? 0;
                      return (
                        <div
                          key={card.id}
                          className="rounded-lg bg-white/80 px-1.5 py-1.5 text-center ring-1 ring-[var(--wood-deep)]/10"
                        >
                          <img
                            src={card.image}
                            alt=""
                            className="mx-auto h-8 w-6 rounded object-cover"
                          />
                          <p className="mt-0.5 text-[9px] font-bold text-[var(--play-ink)]">
                            #{card.id}
                          </p>
                          <p className="font-play text-[9px] tabular-nums text-[var(--play-muted)]">
                            {formatXu(stake)}
                          </p>
                          <p
                            className={`font-play text-[9px] font-bold tabular-nums ${
                              profit >= 0
                                ? "text-[var(--jade-deep)]"
                                : "text-rose-600"
                            }`}
                          >
                            {profit > 0 ? "+" : ""}
                            {formatXu(Math.round(profit))}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
      
                <section className="app-panel mt-3 space-y-2 p-3">
                  <p className="play-heading text-sm">
                    Xác suất hiệu dụng
                    {inter.effectiveMode
                      ? ` (${inter.effectiveMode})`
                      : ""}
                  </p>
                  {(inter.mode === "app" ||
                    inter.mode === "softapp" ||
                    inter.mode === "user" ||
                    inter.mode === "softuser" ||
                    inter.mode === "fed" ||
                    inter.mode === "softfed" ||
                    inter.mode === "hedge" ||
                    inter.mode === "contrarian" ||
                    inter.mode === "momentum" ||
                    inter.mode === "sparse" ||
                    inter.mode === "dense" ||
                    inter.mode === "vaultguard" ||
                    inter.mode === "vaultpct" ||
                    inter.mode === "flowguard" ||
                    inter.mode === "moneysteer" ||
                    inter.mode === "crowdcap" ||
                    inter.mode === "fogbreak" ||
                    inter.mode === "smartai" ||
                    inter.effectiveMode === "app" ||
                    inter.effectiveMode === "softapp" ||
                    inter.effectiveMode === "user" ||
                    inter.effectiveMode === "fed" ||
                    inter.effectiveMode === "softfed" ||
                    inter.effectiveMode === "hedge" ||
                    inter.effectiveMode === "contrarian" ||
                    inter.effectiveMode === "momentum" ||
                    inter.effectiveMode === "sparse" ||
                    inter.effectiveMode === "dense" ||
                    inter.effectiveMode === "vaultpct" ||
                    inter.effectiveMode === "flowguard" ||
                    inter.effectiveMode === "moneysteer" ||
                    inter.effectiveMode === "fogbreak" ||
                    inter.effectiveMode === "smartai") && (
                    <p className="text-[10px] text-[var(--play-muted)]">
                      Theo stake user đăng nhập · FogBreak/SmartAI nhìn lịch sử + nhiễu
                      · SmartAI học online nhẹ · Mode % kho: vaultpct / flowguard /
                      moneysteer
                    </p>
                  )}
                  {(() => {
                    const probs = inter.probabilities;
                    const maxPct = Math.max(...probs.map((p) => p.percent), 0);
                    return (
                      <div className="space-y-1.5">
                        {probs.map((p) => {
                          const card = CARDS.find((c) => c.id === p.cardId);
                          const forced = inter.mode === String(p.cardId);
                          const isMax = p.percent === maxPct && maxPct > 0;
                          return (
                            <div key={p.cardId} className="flex items-center gap-2">
                              {card ? (
                                <img
                                  src={card.image}
                                  alt=""
                                  className="h-7 w-5 shrink-0 rounded object-cover"
                                />
                              ) : null}
                              <span className="w-16 shrink-0 truncate text-[10px] font-semibold">
                                #{p.cardId}
                              </span>
                              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--wood-deep)]/10">
                                <div
                                  className={`h-full rounded-full ${
                                    forced || isMax
                                      ? "bg-amber-500"
                                      : "bg-[var(--wood-deep)]/55"
                                  }`}
                                  style={{
                                    width: `${Math.min(100, Math.max(2, p.percent))}%`,
                                  }}
                                />
                              </div>
                              <span className="font-play w-12 shrink-0 text-right text-xs font-bold tabular-nums text-[var(--wood-deep)]">
                                {p.percent}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {inter.probabilities.map((p) => {
                      const card = CARDS.find((c) => c.id === p.cardId);
                      const forced = inter.mode === String(p.cardId);
                      const eff = inter.effectiveMode ?? inter.mode;
                      const policy =
                        eff === "app" ||
                        eff === "user" ||
                        eff === "fed" ||
                        eff === "hedge";
                      const hot =
                        forced ||
                        (eff === "small" && p.group === "small") ||
                        (eff === "big" && p.group === "big") ||
                        (eff === "fed" && p.percent >= 50) ||
                        (eff === "hedge" && p.percent >= 20) ||
                        (policy && eff !== "fed" && p.percent >= 18);
                      return (
                        <div
                          key={p.cardId}
                          className={`rounded-xl px-2 py-2 ring-1 ${
                            forced
                              ? "bg-amber-100 ring-amber-400"
                              : (eff === "app" ||
                                    eff === "fed" ||
                                    eff === "hedge") &&
                                  hot
                                ? "bg-rose-50 ring-rose-300/70"
                                : eff === "user" && hot
                                  ? "bg-emerald-50 ring-emerald-300/70"
                                  : hot
                                    ? "bg-amber-50 ring-amber-300/70"
                                    : "bg-white/80 ring-[var(--wood-deep)]/10"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {card ? (
                              <img
                                src={card.image}
                                alt=""
                                className="h-8 w-6 rounded object-cover"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-semibold">
                                #{p.cardId} {p.nameVi}
                              </p>
                              <p className="font-play text-sm font-bold tabular-nums text-[var(--wood-deep)]">
                                {p.percent}%
                              </p>
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] leading-snug text-[var(--play-muted)]">
                            {forced
                              ? "Ép thẳng"
                              : policy
                                ? `Trả ${formatXu(p.liability ?? 0)} · App ${formatXu(p.houseProfit ?? 0)}`
                                : p.group === "small"
                                  ? "Small 1–4"
                                  : "Big 5–8"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
      
                <section className="app-panel mt-3 space-y-2 p-3">
                  <p className="play-heading text-sm">Log Inter gần đây</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
                    {(botLogs ?? [])
                      .filter(
                        (l) =>
                          l.botId === "system" &&
                          typeof l.message === "string" &&
                          l.message.includes("Inter:"),
                      )
                      .slice(0, 5)
                      .map((l) => (
                        <li
                          key={l.id}
                          className="rounded-lg bg-white/70 px-2 py-1.5 ring-1 ring-[var(--wood-deep)]/10"
                        >
                          <span className="font-semibold text-[var(--wood-deep)]">
                            Ván #{l.round}
                          </span>
                          <span className="text-[var(--play-muted)]">
                            {" "}
                            · {new Date(l.at).toLocaleTimeString("vi-VN")}
                          </span>
                          <p className="mt-0.5 text-[10px] leading-snug text-[var(--play-ink)]">
                            {l.message}
                          </p>
                        </li>
                      ))}
                    {(botLogs ?? []).filter(
                      (l) =>
                        l.botId === "system" &&
                        typeof l.message === "string" &&
                        l.message.includes("Inter:"),
                    ).length === 0 && (
                      <li className="py-3 text-center text-[var(--play-muted)]">
                        Chưa có log Inter — đợi khóa ván sau
                      </li>
                    )}
                  </ul>
                </section>
              </>
                )}
              </>
    </>
  );
}
