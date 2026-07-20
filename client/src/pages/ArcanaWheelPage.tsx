import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  api,
  getStoredUser,
  homePath,
  type AuthUser,
} from "../auth";
import { AppShell } from "../components/AppShell";
import { BottomSheet } from "../components/BottomSheet";
import { ArcanaHowItWorks } from "../components/arcana/ArcanaHowItWorks";
import { ArcanaHistoryList } from "../components/arcana/ArcanaHistoryList";
import { ArcanaInfoButton } from "../components/arcana/ArcanaInfoButton";
import { TarotRecentStrip } from "../components/TarotRecentStrip";
import { ArcanaPaytable } from "../components/arcana/ArcanaPaytable";
import { ArcanaRecentTable } from "../components/arcana/ArcanaRecentTable";
import { ArcanaStreakPanel } from "../components/arcana/ArcanaStreakPanel";
import { ArcanaStreakSummary } from "../components/arcana/ArcanaStreakSummary";
import type { SpinResult } from "../components/arcana/arcanaTypes";
import { formatXu } from "../cards";
import {
  previewArcanaPayout,
  rarityLabel,
  rarityLabelEn,
  rarityTierKey,
  type StreakBonusRules,
} from "../lib/arcanaPayout";

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

import {
  FANTASY_SPARKLE_ANGLES as SPARKLE_ANGLES,
  FANTASY_STAR_ANGLES as STAR_ANGLES,
  fantasyParticleStyle,
} from "../lib/fantasyParticles";

function ArcanaRoulette({
  slots,
  rotationDeg,
  spinning,
  highlightId,
  pickIds,
}: {
  slots: ArcanaSlotPublic[];
  rotationDeg: number;
  spinning: boolean;
  highlightId: number | null;
  pickIds: number[];
}) {
  const n = Math.max(slots.length, 1);
  const seg = 360 / n;
  const size = 280;
  const rInner = 42;

  const conic = useMemo(() => {
    if (!slots.length) return "transparent";
    const colors = [
      "#1a3d36",
      "#2a4a28",
      "#3d3420",
      "#2c3e50",
      "#3a2a45",
      "#1e3a4c",
      "#4a3520",
      "#2a3550",
    ];
    const parts = slots.map((_, i) => {
      const c = colors[i % colors.length]!;
      return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
    });
    return `conic-gradient(from ${-seg / 2}deg, ${parts.join(", ")})`;
  }, [slots, seg]);

  return (
    <div
      className={`arcana-wheel-wrap arcana-wheel-ornate relative mx-auto ${
        spinning ? "arcana-wheel-wrap--spinning" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <div
        className="arcana-aura pointer-events-none absolute rounded-full"
        style={{ inset: -18 }}
        aria-hidden
      />
      <div
        className="arcana-aura-inner pointer-events-none absolute rounded-full"
        style={{ inset: -10 }}
        aria-hidden
      />
      <div
        className="arcana-wheel-ring-shimmer pointer-events-none absolute inset-0 rounded-full"
        aria-hidden
      />
      {SPARKLE_ANGLES.map((deg, i) => (
        <span
          key={`sp-${deg}`}
          className="arcana-sparkle pointer-events-none"
          style={fantasyParticleStyle(deg, 48, i, "sparkle")}
          aria-hidden
        />
      ))}
      {STAR_ANGLES.map((deg, i) => (
        <span
          key={`st-${deg}`}
          className="arcana-star pointer-events-none"
          style={fantasyParticleStyle(deg, 54, i, "star")}
          aria-hidden
        >
          ✦
        </span>
      ))}

      <div
        className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-0.5"
        aria-hidden
      >
        <div className="arcana-pointer h-0 w-0 border-l-[11px] border-r-[11px] border-t-[20px] border-l-transparent border-r-transparent border-t-[var(--gold)]" />
      </div>

      <div className="arcana-wheel-outer-ring pointer-events-none absolute inset-0 rounded-full" />

      <div
        className="arcana-wheel-disc absolute inset-[8px] rounded-full"
        style={{
          background: conic,
          transform: `rotate(${rotationDeg}deg)`,
          transition: spinning
            ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.08, 1)`
            : "none",
        }}
      >
        {slots.map((s, i) => {
          const mid = i * seg;
          const isHi = highlightId === s.id && !spinning;
          const isPick = pickIds.includes(s.id);
          return (
            <div
              key={s.id}
              className="pointer-events-none absolute inset-0"
              style={{ transform: `rotate(${mid}deg)` }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px origin-top -translate-x-1/2 bg-[var(--gold)]/35" />
              <div
                className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
                style={{ top: 14 }}
              >
                <div
                  className={`overflow-hidden rounded-full shadow-md ring-1 ${
                    isHi
                      ? "arcana-seg-label--pulse ring-2 ring-[var(--jade)] shadow-[0_0_12px_rgba(80,200,160,0.55)]"
                      : isPick
                        ? "ring-2 ring-[var(--gold)]"
                        : "ring-[var(--gold)]/40"
                  }`}
                  style={{ width: 44, height: 44 }}
                >
                  <img
                    src={s.image}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                <span className="arcana-wheel-mult mt-0.5 rounded bg-[var(--night)]/90 px-1.5 font-play text-[10px] font-bold tabular-nums shadow-sm ring-1 ring-[var(--gold)]/55">
                  ×{s.ratio}
                </span>
                {typeof s.weightShare === "number" && s.weightShare > 0 && (
                  <span
                    className={`arcana-rarity arcana-rarity--wheel arcana-rarity--${rarityTierKey(s.weightShare)} mt-0.5`}
                  >
                    {rarityLabelEn(s.weightShare)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, transparent 38%, rgba(6,20,18,0.55) 100%)",
          }}
        />
      </div>

      <div
        className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_30%,#3d2a18,#0c1a16)] ring-2 ring-[var(--gold)]/60"
        style={{ width: rInner * 2, height: rInner * 2 }}
      >
        {highlightId != null && slots.find((x) => x.id === highlightId) ? (
          <img
            src={slots.find((x) => x.id === highlightId)!.image}
            alt=""
            className={`h-full w-full object-cover ${
              spinning ? "opacity-40" : "opacity-100"
            }`}
          />
        ) : (
          <span className="font-play text-[10px] font-bold text-[var(--gold-soft)]">
            ARCANA
          </span>
        )}
      </div>

      {spinning && (
        <div
          className="pointer-events-none absolute inset-0 animate-pulse rounded-full"
          style={{ boxShadow: "0 0 28px 6px rgba(212,175,55,0.35)" }}
        />
      )}
    </div>
  );
}

export default function ArcanaWheelPage() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [balance, setBalance] = useState(user?.balance ?? 0);
  const [enabled, setEnabled] = useState(true);
  const [betTiers, setBetTiers] = useState<number[]>([
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
  const [rotationDeg, setRotationDeg] = useState(0);
  const [displayWinId, setDisplayWinId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
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
  const rotationRef = useRef(0);
  const autoRef = useRef(false);
  const spinningRef = useRef(false);
  const pickIdsRef = useRef<number[]>([]);
  const stakeRef = useRef(300);
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
    const u = getStoredUser();
    if (u) {
      const next = { ...u, balance: bal };
      setUser(next);
      localStorage.setItem("tarot_user", JSON.stringify(next));
    }
  };

  const pickCount = Math.max(1, pickIds.length);

  const maxWinPreview = useMemo(() => {
    if (!pickIds.length) return 0;
    let best = 0;
    for (const id of pickIds) {
      const s = slotById.get(id);
      if (!s) continue;
      const p = previewArcanaPayout(stake, s.ratio, pickCount, payoutScale);
      if (p > best) best = p;
    }
    return best;
  }, [pickIds, slotById, stake, pickCount, payoutScale]);

  const load = useCallback(async () => {
    try {
      const r = await api<{
        enabled: boolean;
        betTiers: number[];
        pickMin?: number;
        pickMax?: number;
        maxStake?: number;
        payoutScale?: number;
        luckStreak?: number;
        streakBonus?: StreakBonusRules;
        slots: ArcanaSlotPublic[];
        recent: RecentSpin[];
        balance: number;
      }>("/api/arcana-wheel");
      setEnabled(r.enabled);
      enabledRef.current = r.enabled;
      setBetTiers(r.betTiers);
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
      if (r.betTiers.length && !r.betTiers.includes(stakeRef.current)) {
        setStake(r.betTiers[0]!);
        stakeRef.current = r.betTiers[0]!;
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
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= pickMax) return prev;
      return [...prev, id];
    });
  };

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
    if (balanceRef.current < stakeRef.current) {
      setError("Không đủ xu");
      setAutoSpin(false);
      return false;
    }

    setError("");
    spinningRef.current = true;
    setSpinning(true);
    setLastResult(null);

    try {
      const r = await api<{
        spin: SpinResult;
        slot: ArcanaSlotPublic;
        balance: number;
        luckStreak: number;
        streakBonus: StreakBonusRules;
        recent: RecentSpin[];
      }>("/api/arcana-wheel/spin", {
        method: "POST",
        body: JSON.stringify({
          stake: stakeRef.current,
          pickIds: picks,
        }),
      });

      const winIndex = slots.findIndex((s) => s.id === r.spin.winId);
      const idx = winIndex >= 0 ? winIndex : 0;
      const nextRot = targetRotationDeg(idx, slots.length, rotationRef.current);
      rotationRef.current = nextRot;
      setRotationDeg(nextRot);
      setDisplayWinId(null);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SPIN_MS + 80);
      });

      setDisplayWinId(r.spin.winId);
      setLastResult(r.spin);
      setRecent(r.recent);
      syncUserBalance(r.balance);
      setLuckStreak(r.luckStreak);
      if (r.streakBonus) setStreakBonus(r.streakBonus);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quay thất bại");
      setAutoSpin(false);
      return false;
    } finally {
      spinningRef.current = false;
      setSpinning(false);
    }
  }, [slots, pickMin, pickMax]);

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
          badge: r.winId,
          title: s?.nameVi,
          ringClass: r.won
            ? "ring-[var(--jade)]/55"
            : "ring-[var(--wood-deep)]/25",
        };
      }),
    [recentRows, slotById],
  );


  const slotLabel = useCallback(
    (id: number) => slotById.get(id)?.nameVi ?? `#${id}`,
    [slotById],
  );

  if (!user) {
    return (
      <AppShell>
        <p className="text-center text-sm">Chưa đăng nhập</p>
        <Link to="/login" className="app-btn-primary mt-3 block text-center">
          Đăng nhập
        </Link>
      </AppShell>
    );
  }

  const canSpin =
    !spinning &&
    enabled &&
    pickIds.length >= pickMin &&
    pickIds.length <= pickMax &&
    !loading &&
    balance >= stake;

  return (
    <AppShell maxWidth="md">
      <header className="flex items-center gap-2">
        <Link
          to={homePath(user)}
          className="rounded-lg bg-[var(--wood-deep)]/80 px-2 py-1 text-xs text-[var(--cream)] ring-1 ring-[var(--gold)]/30"
        >
          ← Hub
        </Link>
        <div className="min-w-0 flex-1">
          <p className="play-heading truncate text-sm">Bánh xe Arcana</p>
          <p className="truncate text-[10px] text-[var(--play-muted)]">
            {user.username} · {user.code}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setHistoryOpen(true);
            void loadHistory();
          }}
          className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
        >
          Lịch sử
        </button>
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--night)]/70 px-2.5 py-1 ring-1 ring-[var(--gold)]/35">
          <img
            src="/assets/ui/icon-coin-xu.png"
            alt=""
            className="h-4 w-4 object-contain"
          />
          <span className="font-play text-sm font-bold tabular-nums text-[var(--gold-soft)]">
            {formatXu(balance)}
          </span>
        </div>
      </header>

      <ArcanaStreakSummary
        luckStreak={luckStreak}
        streakBonus={streakBonus}
        onDetail={() => setDetailSheet("streak")}
      />

      <div className="mt-2">
        <ArcanaRoulette
          slots={slots}
          rotationDeg={rotationDeg}
          spinning={spinning}
          highlightId={displayWinId}
          pickIds={pickIds}
        />
      </div>

      {lastResult && !spinning && (
        <p
          className={`mt-3 text-center text-sm font-bold ${
            lastResult.won ? "text-[var(--jade-deep)]" : "text-rose-700"
          }`}
        >
          {lastResult.won
            ? `Trúng · +${formatXu(lastResult.profit)} xu${
                (lastResult.streakBonusPercent ?? 0) > 0
                  ? ` (gồm +${lastResult.streakBonusPercent}% chuỗi vận)`
                  : ""
              } · ${slotById.get(lastResult.winId)?.nameVi ?? ""}`
            : `Trượt · −${formatXu(lastResult.stake)} xu · ra ${slotById.get(lastResult.winId)?.nameVi ?? ""}`}
        </p>
      )}

      <TarotRecentStrip
        title="Kết quả gần đây"
        items={recentStripItems}
        emptyText="Chưa có lịch sử quay"
        headerExtra={
          <ArcanaInfoButton
            onClick={() => setDetailSheet("recent")}
            ariaLabel="Xem bảng kết quả gần đây"
          >
            Bảng
          </ArcanaInfoButton>
        }
      />

      <section className="arcana-pick-section app-panel mt-3 p-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="play-heading text-center text-sm">
            CHỌN {pickMin}–{pickMax} NHÂN VẬT ({pickIds.length}/{pickMax})
          </p>
          <ArcanaInfoButton
            onClick={() => setDetailSheet("paytable")}
            ariaLabel="Bảng hệ số và thưởng"
          >
            Bảng thưởng
          </ArcanaInfoButton>
          <ArcanaInfoButton
            onClick={() => setDetailSheet("howto")}
            ariaLabel="Hướng dẫn cách tính thưởng"
          >
            ?
          </ArcanaInfoButton>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
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
                className={`arcana-pick-card arcana-pick-card--${tier} relative flex flex-col items-center p-1.5 transition ${
                  selected
                    ? "arcana-pick-card--selected"
                    : ""
                }`}
              >
                {selected && (
                  <span className="arcana-pick-badge">
                    {order + 1}
                  </span>
                )}
                <div className="arcana-pick-avatar">
                  <img
                    src={s.image}
                    alt={s.nameVi}
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
                <span className="mt-0.5 line-clamp-2 text-center text-[9px] font-semibold leading-tight text-[var(--play-ink)]">
                  {s.nameVi}
                </span>
                <span className="arcana-pick-ratio font-play text-[10px] font-bold">
                  ×{s.ratio}
                </span>
                {typeof s.weightShare === "number" && s.weightShare > 0 && (
                  <span
                    className={`arcana-rarity arcana-rarity--${tier}`}
                  >
                    {rarityLabel(s.weightShare)}
                  </span>
                )}
                {selected && pickIds.length > 0 && (
                  <span className="mt-0.5 text-[8px] font-bold text-emerald-300 tabular-nums drop-shadow-sm">
                    +{formatXu(
                      previewArcanaPayout(
                        stake,
                        s.ratio,
                        pickIds.length,
                        payoutScale,
                      ),
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {pickIds.length > 0 && (
          <p className="mt-2 text-center text-[10px] font-semibold text-[var(--wood-deep)] tabular-nums">
            Trúng ô cao nhất trong lựa chọn: tối đa {formatXu(maxWinPreview)}{" "}
            xu (lãi {formatXu(Math.max(0, maxWinPreview - stake))})
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {betTiers.map((t) => (
            <button
              key={t}
              type="button"
              disabled={spinning}
              onClick={() => setStake(t)}
              className={`rounded-full px-3 py-1.5 font-play text-xs font-bold tabular-nums ${
                stake === t
                  ? "bg-[var(--wood-deep)] text-[var(--gold-soft)] ring-1 ring-[var(--gold)]"
                  : "bg-white/70 text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
              }`}
            >
              {formatXu(t)}
            </button>
          ))}
        </div>

        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs font-semibold text-[var(--play-ink)]">
          <input
            type="checkbox"
            checked={autoSpin}
            disabled={spinning && !autoSpin}
            onChange={(e) => {
              const on = e.target.checked;
              if (on && (pickIds.length < pickMin || pickIds.length > pickMax)) {
                setError(`Chọn từ ${pickMin}–${pickMax} nhân vật trước khi Auto`);
                return;
              }
              setAutoSpin(on);
              setError("");
            }}
            className="h-4 w-4 accent-[var(--jade-deep)]"
          />
          Auto quay (dừng khi hết xu / tắt Auto)
        </label>

        <div className="mt-3 flex gap-2">
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
                    ? `Chọn thêm ${pickMin - pickIds.length} NV`
                    : `Quay số phận · ${formatXu(stake)} xu`}
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
            stake={stake}
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
    </AppShell>
  );
}
