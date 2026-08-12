import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  api,
  getStoredUser,
  type AuthUser,
} from "../auth";
import { ensureGuestCode, getGuestCode } from "../guest";
import { AppShell } from "../components/AppShell";
import { GameChrome } from "../components/GameChrome";
import { BottomSheet } from "../components/BottomSheet";
import { ArcanaHowItWorks } from "../components/arcana/ArcanaHowItWorks";
import { ArcanaHistoryList } from "../components/arcana/ArcanaHistoryList";
import { ArcanaInfoButton } from "../components/arcana/ArcanaInfoButton";
import { TarotRecentStrip } from "../components/TarotRecentStrip";
import { ArcanaPaytable } from "../components/arcana/ArcanaPaytable";
import { ArcanaRecentTable } from "../components/arcana/ArcanaRecentTable";
import { ArcanaStreakPanel } from "../components/arcana/ArcanaStreakPanel";
import type { SpinResult } from "../components/arcana/arcanaTypes";
import { formatXu } from "../cards";
import {
  raritySegmentColor,
  rarityTierKey,
  type RarityTierKey,
  type StreakBonusRules,
} from "../lib/arcanaPayout";
import { onArcanaImgError } from "../lib/arcanaImages";
import { useApplyPlayMediaPresets } from "../hooks/useApplyPlayMediaPresets";
import { useSfx } from "../hooks/useSfx";
import { PlayPrefsSheet } from "../components/PlayPrefsSheet";
import { VirtualPlayFooter } from "../components/VirtualPlayFooter";
import {
  EU_WHEEL_ORDER,
  outerPickLabelVi,
  outerIndexOnWheel,
  pocketColor,
  pocketHex,
  type OuterEvenMoneyPick,
} from "../lib/europeanRoulette";
import { usePlaySocket } from "../socket/PlaySocketContext";

interface ArcanaSlotPublic {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  ratio: number;
  image: string;
  weightShare?: number;
}

interface RecentSpin {
  id: string;
  at: number;
  winId: number;
  pickId: number;
  pickIds?: number[];
  won: boolean;
  stake?: number;
  payout?: number;
  profit?: number;
  outerNumber?: number;
  outerPick?: OuterEvenMoneyPick;
  outerWon?: boolean;
}

const DEFAULT_PAYOUT_SCALE = 0.3;

const DEFAULT_STREAK_BONUS: StreakBonusRules = {
  enabled: true,
  minStreak: 3,
  percentPerStep: 5,
  capPercent: 15,
  nextWinBonusPercent: 0,
};

const SPIN_MS = 4200;
const SPIN_MS_OUTER = 4600;
const FULL_TURNS = 5;
const AUTO_GAP_MS = 600;
const DEFAULT_PICK_MIN = 1;
const DEFAULT_PICK_MAX = 8;

type ArcanaDetailSheet = "streak" | "recent" | "paytable" | "howto";

const DETAIL_SHEET_TITLES: Record<ArcanaDetailSheet, string> = {
  streak: "Chuỗi vận",
  recent: "Kết quả gần đây",
  paytable: "Bảng hệ số & thưởng",
  howto: "Cách tính thưởng",
};

function targetRotationDeg(
  winIndex: number,
  n: number,
  baseDeg: number,
): number {
  const seg = 360 / n;
  const land = winIndex * seg;
  return Math.ceil((baseDeg + 1) / 360) * 360 + FULL_TURNS * 360 - land;
}

/** Opposite spin direction for inner Arcana disc. */
function targetRotationDegOpposite(
  winIndex: number,
  n: number,
  baseDeg: number,
): number {
  const seg = 360 / n;
  const land = winIndex * seg;
  return Math.floor((baseDeg - 1) / 360) * 360 - FULL_TURNS * 360 - land;
}

import {
  FANTASY_SPARKLE_ANGLES as SPARKLE_ANGLES,
  fantasyParticleStyle,
} from "../lib/fantasyParticles";

function DoubleArcanaRoulette({
  slots,
  rotationOuterDeg,
  rotationInnerDeg,
  spinning,
  highlightId,
  highlightOuter,
  pickIds,
}: {
  slots: ArcanaSlotPublic[];
  rotationOuterDeg: number;
  rotationInnerDeg: number;
  spinning: boolean;
  highlightId: number | null;
  highlightOuter: number | null;
  pickIds: number[];
}) {
  const nInner = Math.max(slots.length, 1);
  const segInner = 360 / nInner;
  const nOuter = EU_WHEEL_ORDER.length;
  const segOuter = 360 / nOuter;
  const rHub = 42;
  const innerInset = 92;
  const sizeCss = "min(360px, 92vw)";

  const outerConic = useMemo(() => {
    const parts = EU_WHEEL_ORDER.map((num, i) => {
      const c = pocketHex(num);
      return `${c} ${i * segOuter}deg ${(i + 1) * segOuter}deg`;
    });
    return `conic-gradient(from ${-segOuter / 2}deg, ${parts.join(", ")})`;
  }, [segOuter]);

  const innerConic = useMemo(() => {
    if (!slots.length) return "transparent";
    const parts = slots.map((s, i) => {
      const c = raritySegmentColor(s.weightShare ?? 99);
      return `${c} ${i * segInner}deg ${(i + 1) * segInner}deg`;
    });
    return `conic-gradient(from ${-segInner / 2}deg, ${parts.join(", ")})`;
  }, [slots, segInner]);

  return (
    <div
      className={`arcana-wheel-wrap arcana-wheel-ornate relative mx-auto ${
        spinning ? "arcana-wheel-wrap--spinning" : ""
      }`}
      style={{ width: sizeCss, height: sizeCss }}
    >
      <div
        className="arcana-aura pointer-events-none absolute rounded-full"
        style={{ inset: -12 }}
        aria-hidden
      />
      {SPARKLE_ANGLES.slice(0, 4).map((deg, i) => (
        <span
          key={`sp-${deg}`}
          className="arcana-sparkle pointer-events-none"
          style={fantasyParticleStyle(deg, 42, i, "sparkle")}
          aria-hidden
        />
      ))}

      <div
        className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-0.5"
        aria-hidden
      >
        <div className="arcana-pointer h-0 w-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-[var(--gold)]" />
      </div>

      <div className="arcana-wheel-outer-ring pointer-events-none absolute inset-0 rounded-full" />

      {/* Outer European 37 */}
      <div
        className="absolute inset-[5px] overflow-hidden rounded-full"
        style={{
          background: outerConic,
          transform: `rotate(${rotationOuterDeg}deg)`,
          transition: spinning
            ? `transform ${SPIN_MS_OUTER}ms cubic-bezier(0.12, 0.75, 0.08, 1)`
            : "none",
        }}
      >
        {EU_WHEEL_ORDER.map((num, i) => {
          const mid = i * segOuter;
          const hi = highlightOuter === num && !spinning;
          return (
            <div
              key={`eu-${num}`}
              className="pointer-events-none absolute inset-0"
              style={{ transform: `rotate(${mid}deg)` }}
            >
              <span
                className={`absolute left-1/2 top-2 -translate-x-1/2 font-play text-[10px] font-bold tabular-nums ${
                  hi
                    ? "rounded bg-[var(--gold)] px-0.5 text-[var(--night)]"
                    : "text-[#f5e6c8]"
                }`}
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
              >
                {num}
              </span>
            </div>
          );
        })}
      </div>

      {/* Inner Arcana 8 */}
      <div
        className="absolute overflow-hidden rounded-full ring-2 ring-[var(--gold)]/50"
        style={{
          inset: innerInset,
          background: innerConic,
          transform: `rotate(${rotationInnerDeg}deg)`,
          transition: spinning
            ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.08, 1)`
            : "none",
        }}
      >
        {slots.map((s, i) => {
          const mid = i * segInner;
          const isHi = highlightId === s.id && !spinning;
          const isPick = pickIds.includes(s.id);
          return (
            <div
              key={s.id}
              className="pointer-events-none absolute inset-0"
              style={{ transform: `rotate(${mid}deg)` }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px origin-top -translate-x-1/2 bg-[var(--gold)]/25" />
              <div
                className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
                style={{ top: 8 }}
              >
                <div
                  className={`overflow-hidden rounded-full shadow-md ring-1 ${
                    isHi
                      ? "arcana-seg-label--pulse ring-2 ring-[var(--jade)]"
                      : isPick
                        ? "ring-2 ring-[var(--gold)]"
                        : "ring-[var(--gold)]/40"
                  }`}
                  style={{ width: 36, height: 36 }}
                >
                  <img
                    src={s.image}
                    alt=""
                    className="h-full w-full object-cover object-top"
                    draggable={false}
                    onError={(e) => onArcanaImgError(e, s.id)}
                  />
                </div>
                <span className="arcana-wheel-mult mt-0.5 rounded bg-[var(--night)]/90 px-1 font-play text-[9px] font-bold tabular-nums">
                  ×{s.ratio}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_30%,#3d2a18,#0c1a16)] ring-2 ring-[var(--gold)]/60"
        style={{ width: rHub * 2, height: rHub * 2 }}
      >
        {highlightId != null && slots.find((x) => x.id === highlightId) ? (
          <img
            src={slots.find((x) => x.id === highlightId)!.image}
            alt=""
            className={`h-full w-full object-cover object-top ${
              spinning ? "opacity-40" : "opacity-100"
            }`}
            onError={(e) =>
              onArcanaImgError(
                e,
                slots.find((x) => x.id === highlightId)?.id,
              )
            }
          />
        ) : (
          <span className="font-play text-[10px] font-bold text-[var(--gold-soft)]">
            ARCANA
          </span>
        )}
      </div>
    </div>
  );
}

export default function ArcanaWheelPage() {
  useApplyPlayMediaPresets("arcana");
  const { play: playSfx, muted: sfxMuted, toggleMute } = useSfx(
    "tarot",
    "arcana",
  );
  const playSock = usePlaySocket();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const guestCode = !user ? getGuestCode() || ensureGuestCode() : null;
  const guestMode = !user;
  const [balance, setBalance] = useState(user?.balance ?? 0);
  const [enabled, setEnabled] = useState(true);
  const [stakeTiers, setStakeTiers] = useState<number[]>([
    300, 800, 1500, 3000, 10_000, 30_000, 100_000, 1_000_000,
  ]);
  const [pickMin, setPickMin] = useState(DEFAULT_PICK_MIN);
  const [pickMax, setPickMax] = useState(DEFAULT_PICK_MAX);
  const [payoutScale, setPayoutScale] = useState(DEFAULT_PAYOUT_SCALE);
  const [slots, setSlots] = useState<ArcanaSlotPublic[]>([]);
  const [recent, setRecent] = useState<RecentSpin[]>([]);
  const [stake, setStake] = useState(300);
  const [pickIds, setPickIds] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotationOuterDeg, setRotationOuterDeg] = useState(0);
  const [rotationInnerDeg, setRotationInnerDeg] = useState(0);
  const [displayWinId, setDisplayWinId] = useState<number | null>(null);
  const [displayOuter, setDisplayOuter] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [outerPick, setOuterPick] = useState<OuterEvenMoneyPick | null>(null);
  const [luckStreak, setLuckStreak] = useState(0);
  const [streakBonus, setStreakBonus] = useState<StreakBonusRules>(
    DEFAULT_STREAK_BONUS,
  );
  const [historyView, setHistoryView] = useState<"list" | "table">("table");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<ArcanaDetailSheet | null>(
    null,
  );
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mission, setMission] = useState({
    count: 0,
    target: 3,
    bonusSpins: 0,
    stakeMin: 10_000,
    bonusStake: 300,
    windowHours: 24,
  });
  const [useBonusSpin, setUseBonusSpin] = useState(false);
  const rotationOuterRef = useRef(0);
  const rotationInnerRef = useRef(0);
  const autoRef = useRef(false);
  const spinningRef = useRef(false);
  const pickIdsRef = useRef<number[]>([]);
  const stakeRef = useRef(300);
  const outerPickRef = useRef<OuterEvenMoneyPick | null>(null);
  const enabledRef = useRef(true);
  const balanceRef = useRef(0);

  useEffect(() => {
    autoRef.current = autoSpin;
  }, [autoSpin]);
  useEffect(() => {
    pickIdsRef.current = pickIds;
  }, [pickIds]);
  useEffect(() => {
    stakeRef.current = stake;
  }, [stake]);
  useEffect(() => {
    outerPickRef.current = outerPick;
  }, [outerPick]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  const slotById = useMemo(() => {
    const m = new Map<number, ArcanaSlotPublic>();
    for (const s of slots) m.set(s.id, s);
    return m;
  }, [slots]);

  const syncUserBalance = (bal: number) => {
    setBalance(bal);
    balanceRef.current = bal;
    if (guestMode) return;
    const u = getStoredUser();
    if (u) {
      const next = { ...u, balance: bal };
      setUser(next);
      localStorage.setItem("tarot_user", JSON.stringify(next));
    }
  };

  const arcanaStakePreview =
    outerPick && !useBonusSpin
      ? stake - Math.floor(stake / 2)
      : stake;
  const outerStakePreview =
    outerPick && !useBonusSpin ? Math.floor(stake / 2) : 0;

  const load = useCallback(async () => {
    try {
      const r = await api<{
        enabled: boolean;
        stakeTiers: number[];
        pickMin?: number;
        pickMax?: number;
        maxStake?: number;
        payoutScale?: number;
        luckStreak?: number;
        streakBonus?: StreakBonusRules;
        slots: ArcanaSlotPublic[];
        recent: RecentSpin[];
        balance: number;
        mission?: typeof mission;
      }>("/api/arcana-wheel");
      setEnabled(r.enabled);
      enabledRef.current = r.enabled;
      setStakeTiers(r.stakeTiers);
      setPickMin(r.pickMin ?? DEFAULT_PICK_MIN);
      setPickMax(r.pickMax ?? DEFAULT_PICK_MAX);
      setPayoutScale(
        typeof r.payoutScale === "number" && r.payoutScale > 0
          ? r.payoutScale
          : DEFAULT_PAYOUT_SCALE,
      );
      setSlots(r.slots);
      setRecent(r.recent);
      setLuckStreak(typeof r.luckStreak === "number" ? r.luckStreak : 0);
      if (r.streakBonus) {
        setStreakBonus({
          enabled: r.streakBonus.enabled,
          minStreak: r.streakBonus.minStreak,
          percentPerStep: r.streakBonus.percentPerStep,
          capPercent: r.streakBonus.capPercent,
          nextWinBonusPercent: r.streakBonus.nextWinBonusPercent ?? 0,
        });
      }
      syncUserBalance(r.balance);
      if (r.mission) setMission(r.mission);
      if (r.stakeTiers.length && !r.stakeTiers.includes(stakeRef.current)) {
        setStake(r.stakeTiers[0]!);
        stakeRef.current = r.stakeTiers[0]!;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được bàn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const r = await api<{ spins: SpinResult[] }>(
        "/api/arcana-wheel/history?limit=50",
      );
      setHistory(r.spins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải lịch sử");
    } finally {
      setHistoryLoading(false);
    }
  };

  const togglePick = (id: number) => {
    if (spinning) return;
    setPickIds((prev) => {
      if (prev.includes(id)) {
        playSfx("ui");
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= pickMax) return prev;
      playSfx("ui");
      return [...prev, id];
    });
  };

  const OUTSIDE_TIERS: {
    key: RarityTierKey;
    en: string;
    vi: string;
  }[] = [
    { key: "low", en: "COMMON", vi: "Thường" },
    { key: "mid", en: "RARE", vi: "Hiếm" },
    { key: "high", en: "EPIC", vi: "Epic" },
  ];

  const applyOutsideTier = (tier: RarityTierKey) => {
    if (spinning) return;
    const inTier = slots
      .filter((s) => rarityTierKey(s.weightShare ?? 99) === tier)
      .sort((a, b) => (b.weightShare ?? 0) - (a.weightShare ?? 0));
    if (!inTier.length) return;
    let targetIds = inTier.map((s) => s.id);
    let truncated = false;
    if (targetIds.length > pickMax) {
      targetIds = targetIds.slice(0, pickMax);
      truncated = true;
    }
    const same =
      pickIds.length === targetIds.length &&
      targetIds.every((id) => pickIds.includes(id));
    if (same) {
      setPickIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      setError("");
      return;
    }
    setPickIds(targetIds);
    setError(
      truncated
        ? `Nhóm ${tier === "high" ? "Epic" : tier === "mid" ? "Rare" : "Common"} vượt ${pickMax} ô — đã chọn ${pickMax} ô weight cao nhất`
        : "",
    );
  };

  const outsideTierActive = (tier: RarityTierKey): boolean => {
    const ids = slots
      .filter((s) => rarityTierKey(s.weightShare ?? 99) === tier)
      .sort((a, b) => (b.weightShare ?? 0) - (a.weightShare ?? 0))
      .map((s) => s.id)
      .slice(0, pickMax);
    return (
      ids.length > 0 &&
      pickIds.length === ids.length &&
      ids.every((id) => pickIds.includes(id))
    );
  };

  const useBonusRef = useRef(false);
  useEffect(() => {
    useBonusRef.current = useBonusSpin;
  }, [useBonusSpin]);

  const runSpin = useCallback(async (): Promise<boolean> => {
    const picks = pickIdsRef.current;
    if (
      spinningRef.current ||
      picks.length < pickMin ||
      picks.length > pickMax ||
      !slots.length
    ) {
      return false;
    }
    if (!enabledRef.current) {
      setError("Bàn đang khóa");
      setAutoSpin(false);
      return false;
    }
    const bonus = useBonusRef.current;
    if (
      !bonus &&
      balanceRef.current < stakeRef.current
    ) {
      setError("Không đủ xu");
      setAutoSpin(false);
      return false;
    }

    setError("");
    spinningRef.current = true;
    setSpinning(true);
    setLastResult(null);
    playSfx("spin");

    try {
      const r = await api<{
        spin: SpinResult;
        slot: ArcanaSlotPublic;
        balance: number;
        luckStreak: number;
        streakBonus: StreakBonusRules;
        recent: RecentSpin[];
        mission?: typeof mission;
      }>("/api/arcana-wheel/spin", {
        method: "POST",
        body: JSON.stringify({
          stake: bonus ? mission.bonusStake : stakeRef.current,
          pickIds: picks,
          useBonusSpin: bonus,
          outerPick: bonus ? null : outerPickRef.current,
        }),
      });

      // Always land on the true Arcana result (winId). Do not use
      // wheelDisplayWinId — that near-miss override desynced the pointer
      // from the hub image / result text on the double wheel.
      const animWinId = r.spin.winId;
      const winIndex = slots.findIndex((s) => s.id === animWinId);
      const idx = winIndex >= 0 ? winIndex : 0;
      const nextInner = targetRotationDegOpposite(
        idx,
        slots.length,
        rotationInnerRef.current,
      );
      rotationInnerRef.current = nextInner;
      setRotationInnerDeg(nextInner);

      const outerNum =
        typeof r.spin.outerNumber === "number" ? r.spin.outerNumber : 0;
      const outerIdx = outerIndexOnWheel(outerNum);
      const nextOuter = targetRotationDeg(
        outerIdx,
        EU_WHEEL_ORDER.length,
        rotationOuterRef.current,
      );
      rotationOuterRef.current = nextOuter;
      setRotationOuterDeg(nextOuter);
      setDisplayWinId(null);
      setDisplayOuter(null);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SPIN_MS_OUTER + 80);
      });

      setDisplayWinId(animWinId);
      setDisplayOuter(outerNum);
      setLastResult(r.spin);
      playSfx("land");
      if ((r.spin.payout ?? 0) > 0) playSfx("win");
      else playSfx("lose");
      setRecent(r.recent);
      syncUserBalance(r.balance);
      setLuckStreak(r.luckStreak);
      if (r.streakBonus) setStreakBonus(r.streakBonus);
      if (r.mission) setMission(r.mission);
      if (r.spin.missionCompleted) {
        setError("Hoàn thành nhiệm vụ — +1 lượt quay thưởng!");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quay thất bại");
      setAutoSpin(false);
      return false;
    } finally {
      spinningRef.current = false;
      setSpinning(false);
    }
  }, [slots, pickMin, pickMax, playSfx]);

  // Auto loop
  useEffect(() => {
    if (!autoSpin || spinning || loading) return;
    if (pickIds.length < pickMin || pickIds.length > pickMax) {
      setAutoSpin(false);
      setError(`Chọn từ ${pickMin}–${pickMax} nhân vật để Auto`);
      return;
    }
    const t = window.setTimeout(() => {
      if (!autoRef.current) return;
      void runSpin();
    }, AUTO_GAP_MS);
    return () => window.clearTimeout(t);
  }, [
    autoSpin,
    spinning,
    loading,
    pickIds.length,
    pickMin,
    pickMax,
    lastResult,
    runSpin,
  ]);

  const recentRows = useMemo(() => recent.slice(0, 12), [recent]);

  const recentStripItems = useMemo(
    () =>
      recentRows.map((r) => {
        const s = slotById.get(r.winId);
        return {
          key: r.id,
          image: s?.image ?? "/assets/ui/avatar-default.png",
          badge:
            typeof r.outerNumber === "number" ? r.outerNumber : r.winId,
          title:
            typeof r.outerNumber === "number"
              ? `Số ${r.outerNumber} · ${s?.nameVi ?? ""}`
              : s?.nameVi,
          ringClass: r.won || r.outerWon
            ? "ring-[var(--jade)]/55"
            : "ring-[var(--wood-deep)]/25",
        };
      }),
    [recentRows, slotById],
  );

  const hotCold = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of slots) counts.set(s.id, 0);
    for (const r of recent) {
      counts.set(r.winId, (counts.get(r.winId) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] - b[0];
    });
    const hot = ranked.slice(0, 3).filter(([, n]) => n > 0);
    const cold = [...ranked].reverse().slice(0, 3);
    return { hot, cold };
  }, [recent, slots]);

  const slotLabel = useCallback(
    (id: number) => slotById.get(id)?.nameVi ?? `#${id}`,
    [slotById],
  );

  const canSpin =
    !spinning &&
    enabled &&
    pickIds.length >= pickMin &&
    pickIds.length <= pickMax &&
    !loading &&
    (useBonusSpin ? mission.bonusSpins > 0 : balance >= stake);

  return (
    <AppShell maxWidth="md">
      <GameChrome
        title="Arcana"
        active="arcana"
        user={user}
        guestCode={guestCode}
        playBalance={balance}
        tools={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => playSock.openVoiceRoom()}
              className="rounded-lg bg-[var(--wood-deep)]/80 px-2 py-1 text-[10px] font-bold text-amber-100 ring-1 ring-[var(--gold)]/35"
              title="Phòng voice — giữ ghế khi đổi bàn"
            >
              {playSock.voiceStatus.inRoom && playSock.voiceStatus.roomId
                ? `Room ${playSock.voiceStatus.roomId}`
                : "Room"}
            </button>
            <button
              type="button"
              onClick={() => setDetailSheet("streak")}
              className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold tabular-nums text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
              title="Chuỗi vận"
            >
              ×{luckStreak}
              {(streakBonus.nextWinBonusPercent ?? 0) > 0
                ? ` +${streakBonus.nextWinBonusPercent}%`
                : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                setHistoryOpen(true);
                void loadHistory();
              }}
              className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
            >
              LS
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ring-1 ${
                sfxMuted
                  ? "bg-white/40 text-[var(--play-muted)] ring-[var(--wood-deep)]/15 line-through"
                  : "bg-white/70 text-[var(--wood-deep)] ring-[var(--wood-deep)]/20"
              }`}
              title="Tắt / mở âm bàn"
            >
              {sfxMuted ? "Tắt" : "Âm"}
            </button>
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
              title="Âm thanh & hiệu ứng"
            >
              Cài
            </button>
          </div>
        }
      />

      <p className="mt-1 text-center text-[10px] text-[var(--play-muted)]">
        {guestMode ? (
          <>Khách · xu ảo phiên</>
        ) : (
          <>
            NV {mission.count}/{mission.target}
            {mission.bonusSpins > 0 ? ` · ${mission.bonusSpins} thưởng` : ""}
          </>
        )}
      </p>

      <div className="mt-1">
        <DoubleArcanaRoulette
          slots={slots}
          rotationOuterDeg={rotationOuterDeg}
          rotationInnerDeg={rotationInnerDeg}
          spinning={spinning}
          highlightId={displayWinId}
          highlightOuter={displayOuter}
          pickIds={pickIds}
        />
      </div>

      {lastResult && !spinning && (
        <p
          className={`mt-2 text-center text-xs font-bold ${
            lastResult.profit > 0
              ? "text-[var(--jade-deep)]"
              : "text-rose-700"
          }`}
        >
          {(() => {
            const n = lastResult.outerNumber;
            const col =
              typeof n === "number"
                ? pocketColor(n) === "red"
                  ? "Đ"
                  : pocketColor(n) === "black"
                    ? "N"
                    : "0"
                : "";
            const outer =
              typeof n === "number" ? `${n}${col !== "0" ? col : ""}` : "";
            const oPick =
              lastResult.outerPick && (lastResult.outerStake ?? 0) > 0
                ? lastResult.outerWon
                  ? ` · ${outerPickLabelVi(lastResult.outerPick)}+`
                  : ` · ${outerPickLabelVi(lastResult.outerPick)}−`
                : "";
            const arc = lastResult.won
              ? ` · ${slotById.get(lastResult.winId)?.nameVi ?? "Arcana"}+`
              : ` · ${slotById.get(lastResult.winId)?.nameVi ?? "Arcana"}−`;
            const sign = lastResult.profit >= 0 ? "+" : "−";
            return `${outer}${oPick}${arc} ${sign}${formatXu(Math.abs(lastResult.profit))}`;
          })()}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
          {recentRows.slice(0, 10).map((r) => {
            const n = r.outerNumber;
            const c =
              typeof n === "number"
                ? pocketColor(n)
                : ("black" as const);
            return (
              <span
                key={r.id}
                className={`inline-flex h-6 min-w-[1.4rem] shrink-0 items-center justify-center rounded px-1 font-play text-[10px] font-bold tabular-nums ${
                  c === "red"
                    ? "bg-[#8b1a1a] text-[#f5e6c8]"
                    : c === "green"
                      ? "bg-[#0d5c2e] text-[#f5e6c8]"
                      : "bg-[#1a1a1a] text-[#f5e6c8]"
                }`}
                title={slotById.get(r.winId)?.nameVi}
              >
                {typeof n === "number" ? n : "·"}
              </span>
            );
          })}
          {recentRows.length === 0 && (
            <span className="text-[10px] text-[var(--play-muted)]">
              Chưa có kết quả
            </span>
          )}
        </div>
        <ArcanaInfoButton
          onClick={() => setDetailSheet("recent")}
          ariaLabel="Bảng kết quả"
        >
          +
        </ArcanaInfoButton>
      </div>

      <section className="arcana-pick-section app-panel mt-2 p-2.5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {(
            [
              { key: "red" as const, label: "Đỏ" },
              { key: "black" as const, label: "Đen" },
              { key: "even" as const, label: "Chẵn" },
              { key: "odd" as const, label: "Lẻ" },
            ] as const
          ).map((t) => {
            const active = outerPick === t.key;
            return (
              <button
                key={t.key}
                type="button"
                disabled={spinning || !enabled || useBonusSpin}
                onClick={() =>
                  setOuterPick((prev) => (prev === t.key ? null : t.key))
                }
                className={`arcana-eu-chip arcana-eu-chip--${t.key} ${
                  active ? "arcana-eu-chip--active" : ""
                }`}
              >
                {t.label}
              </button>
            );
          })}
          <span className="mx-0.5 h-4 w-px bg-[var(--wood-deep)]/20" />
          {OUTSIDE_TIERS.map((t) => {
            const active = outsideTierActive(t.key);
            return (
              <button
                key={t.key}
                type="button"
                disabled={spinning || !enabled}
                onClick={() => applyOutsideTier(t.key)}
                className={`arcana-outside-chip arcana-outside-chip--${t.key} ${
                  active ? "arcana-outside-chip--active" : ""
                }`}
              >
                {t.en}
              </button>
            );
          })}
          <ArcanaInfoButton
            onClick={() => setDetailSheet("howto")}
            ariaLabel="Hướng dẫn"
          >
            ?
          </ArcanaInfoButton>
        </div>
        {outerPick && !useBonusSpin && (
          <p className="mt-1 text-center text-[9px] text-[var(--play-muted)]">
            ½ ngoài {formatXu(outerStakePreview)} · ½ Arcana{" "}
            {formatXu(arcanaStakePreview)}
          </p>
        )}

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {slots.map((s) => {
            const selected = pickIds.includes(s.id);
            const order = pickIds.indexOf(s.id);
            const tier = rarityTierKey(s.weightShare ?? 99);
            return (
              <button
                key={s.id}
                type="button"
                disabled={spinning || !enabled}
                onClick={() => togglePick(s.id)}
                title={s.nameVi}
                className={`arcana-pick-card arcana-pick-card--${tier} relative flex flex-col items-center p-1 transition ${
                  selected ? "arcana-pick-card--selected" : ""
                }`}
              >
                {selected && (
                  <span className="arcana-pick-badge">{order + 1}</span>
                )}
                <div className="arcana-pick-avatar">
                  <img
                    src={s.image}
                    alt={s.nameVi}
                    className="h-full w-full rounded-full object-cover object-top"
                    onError={(e) => onArcanaImgError(e, s.id)}
                  />
                </div>
                <span className="arcana-pick-ratio font-play text-[10px] font-bold">
                  ×{s.ratio}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {stakeTiers.map((t) => (
            <button
              key={t}
              type="button"
              disabled={spinning}
              onClick={() => {
                playSfx("ui");
                setStake(t);
              }}
              className={`rounded-full px-2.5 py-1 font-play text-[11px] font-bold tabular-nums ${
                stake === t
                  ? "bg-[var(--wood-deep)] text-[var(--gold-soft)] ring-1 ring-[var(--gold)]"
                  : "bg-white/70 text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
              }`}
            >
              {formatXu(t)}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--play-ink)]">
          {!guestMode && (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={useBonusSpin}
                disabled={spinning || mission.bonusSpins <= 0}
                onChange={(e) => setUseBonusSpin(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--jade-deep)]"
              />
              Thưởng ({mission.bonusSpins})
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoSpin}
              disabled={spinning && !autoSpin}
              onChange={(e) => {
                const on = e.target.checked;
                if (
                  on &&
                  (pickIds.length < pickMin || pickIds.length > pickMax)
                ) {
                  setError(
                    `Chọn từ ${pickMin}–${pickMax} nhân vật trước khi Auto`,
                  );
                  return;
                }
                setAutoSpin(on);
                setError("");
              }}
              className="h-3.5 w-3.5 accent-[var(--jade-deep)]"
            />
            Auto
          </label>
          <button
            type="button"
            onClick={() => setDetailSheet("paytable")}
            className="text-[10px] font-bold text-[var(--wood-deep)] underline-offset-2 hover:underline"
          >
            Bảng thưởng
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={!canSpin && !autoSpin}
            onClick={() => {
              if (autoSpin) {
                setAutoSpin(false);
                return;
              }
              void runSpin();
            }}
            className="app-btn-primary flex-1 disabled:opacity-50"
          >
            {!enabled
              ? "Bàn đang khóa"
              : spinning
                ? "Đang quay…"
                : autoSpin
                  ? "Dừng Auto"
                  : pickIds.length < pickMin
                    ? `Chọn ${pickMin - pickIds.length} NV`
                    : `Quay · ${formatXu(stake)}`}
          </button>
        </div>
      </section>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs text-rose-800 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      <BottomSheet
        open={detailSheet !== null}
        title={detailSheet ? DETAIL_SHEET_TITLES[detailSheet] : ""}
        onClose={() => setDetailSheet(null)}
      >
        {detailSheet === "streak" && (
          <ArcanaStreakPanel
            variant="sheet"
            luckStreak={luckStreak}
            streakBonus={streakBonus}
          />
        )}
        {detailSheet === "recent" && (
          <>
            <TarotRecentStrip
              className="mt-0 mb-3"
              title="Kết quả gần đây"
              items={recentStripItems}
              emptyText="Chưa có lịch sử quay"
            />
            {hotCold.hot.length > 0 && (
              <div className="mb-3 flex flex-wrap justify-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-rose-700">Nóng</span>
                  {hotCold.hot.map(([id, n]) => (
                    <span key={`h-${id}`} className="tabular-nums">
                      {slotById.get(id)?.nameVi?.slice(0, 8) ?? id}({n})
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sky-800">Lạnh</span>
                  {hotCold.cold.map(([id, n]) => (
                    <span key={`c-${id}`} className="tabular-nums">
                      {slotById.get(id)?.nameVi?.slice(0, 8) ?? id}({n})
                    </span>
                  ))}
                </div>
              </div>
            )}
            <ArcanaRecentTable
              rows={recentRows}
              slotName={slotLabel}
              highlightId={lastResult?.id}
            />
          </>
        )}
        {detailSheet === "paytable" && (
          <ArcanaPaytable
            bare
            slots={slots}
            pickIds={pickIds}
            stake={arcanaStakePreview}
            payoutScale={payoutScale}
          />
        )}
        {detailSheet === "howto" && (
          <ArcanaHowItWorks
            mode="sheet"
            payoutScale={payoutScale}
            pickCount={pickIds.length || 2}
            stake={stake}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={historyOpen}
        title="Lịch sử quay Arcana"
        onClose={() => setHistoryOpen(false)}
      >
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setHistoryView("table")}
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              historyView === "table"
                ? "bg-[var(--wood-deep)] text-[var(--gold-soft)]"
                : "bg-white/70 text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
            }`}
          >
            Bảng
          </button>
          <button
            type="button"
            onClick={() => setHistoryView("list")}
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              historyView === "list"
                ? "bg-[var(--wood-deep)] text-[var(--gold-soft)]"
                : "bg-white/70 text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
            }`}
          >
            Chi tiết
          </button>
        </div>
        {historyLoading ? (
          <p className="text-sm text-[var(--play-muted)]">Đang tải…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--play-muted)]">Chưa có lượt quay</p>
        ) : (
          <ArcanaHistoryList
            spins={history}
            slotName={slotLabel}
            view={historyView}
          />
        )}
      </BottomSheet>

      <PlayPrefsSheet
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
      />
      <VirtualPlayFooter className="mt-3 px-3 pb-3" />
    </AppShell>
  );
}
