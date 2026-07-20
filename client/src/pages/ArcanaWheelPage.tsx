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
import { formatXu } from "../cards";

interface ArcanaSlotPublic {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  ratio: number;
  image: string;
}

interface RecentSpin {
  id: string;
  at: number;
  winId: number;
  pickId: number;
  pickIds?: number[];
  won: boolean;
}

interface SpinResult {
  id: string;
  stake: number;
  pickId: number;
  pickIds: number[];
  winId: number;
  ratio: number;
  won: boolean;
  payout: number;
  profit: number;
  seed: string;
  at?: number;
}

const DEFAULT_PAYOUT_SCALE = 0.3;

function previewArcanaPayout(
  stake: number,
  ratio: number,
  pickCount: number,
  payoutScale: number,
): number {
  const k = Math.max(1, pickCount);
  const scale = Math.max(0.01, Math.min(2, payoutScale));
  return Math.max(0, Math.floor((stake * ratio * scale) / k));
}
const SPIN_MS = 4200;
const FULL_TURNS = 5;
const AUTO_GAP_MS = 600;
const DEFAULT_PICK_MIN = 1;
const DEFAULT_PICK_MAX = 8;

function targetRotationDeg(
  winIndex: number,
  n: number,
  baseDeg: number,
): number {
  const seg = 360 / n;
  const land = winIndex * seg;
  return Math.ceil((baseDeg + 1) / 360) * 360 + FULL_TURNS * 360 - land;
}

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
      className="arcana-wheel-wrap relative mx-auto"
      style={{ width: size, height: size }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-0.5"
        aria-hidden
      >
        <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-[var(--gold)] drop-shadow-md" />
      </div>

      <div
        className="absolute inset-0 rounded-full shadow-xl ring-[6px] ring-[var(--gold)]/70"
        style={{
          boxShadow:
            "0 0 0 3px rgba(6,36,30,0.9), 0 12px 28px rgba(0,0,0,0.35), inset 0 0 24px rgba(212,175,55,0.25)",
        }}
      />

      <div
        className="arcana-wheel-disc absolute inset-[6px] rounded-full"
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
                      ? "ring-2 ring-[var(--jade)] shadow-[0_0_12px_rgba(80,200,160,0.55)]"
                      : isPick
                        ? "ring-2 ring-[var(--gold)]"
                        : "ring-[var(--gold)]/40"
                  }`}
                  style={{ width: 40, height: 40 }}
                >
                  <img
                    src={s.image}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                <span className="mt-0.5 rounded bg-[var(--night)]/75 px-1 font-play text-[9px] font-bold tabular-nums text-[var(--gold-soft)]">
                  1:{s.ratio}
                </span>
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
    300, 800, 1500, 3000, 10_000, 30_000, 100_000,
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
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
      setStreak((prev) =>
        r.spin.won ? Math.max(0, prev) + 1 : Math.min(0, prev) - 1,
      );
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

      <p className="mt-3 text-center text-[11px] font-semibold tracking-wide text-[var(--jade-deep)]">
        CHUỖI VẬN &gt;&gt; {streak} &lt;&lt;
      </p>

      <div className="mt-3">
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
            ? `Trúng · +${formatXu(lastResult.profit)} xu · ${slotById.get(lastResult.winId)?.nameVi ?? ""}`
            : `Trượt · −${formatXu(lastResult.stake)} xu · ra ${slotById.get(lastResult.winId)?.nameVi ?? ""}`}
        </p>
      )}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {recent.length === 0 && (
          <p className="text-[10px] text-[var(--play-muted)]">
            Chưa có lịch sử quay
          </p>
        )}
        {recent.map((r) => {
          const s = slotById.get(r.winId);
          return (
            <img
              key={r.id}
              src={s?.image ?? "/assets/ui/avatar-default.png"}
              alt=""
              title={s?.nameVi}
              className={`h-9 w-9 shrink-0 rounded-full object-cover ring-1 ${
                r.won ? "ring-[var(--jade)]" : "ring-[var(--wood-deep)]/30"
              }`}
            />
          );
        })}
      </div>

      <section className="app-panel mt-3 p-3">
        <p className="play-heading text-center text-sm">
          CHỌN {pickMin}–{pickMax} NHÂN VẬT ({pickIds.length}/{pickMax})
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {slots.map((s) => {
            const selected = pickIds.includes(s.id);
            const order = pickIds.indexOf(s.id);
            return (
              <button
                key={s.id}
                type="button"
                disabled={spinning || !enabled}
                onClick={() => togglePick(s.id)}
                className={`relative flex flex-col items-center rounded-lg p-1.5 transition ${
                  selected
                    ? "bg-[var(--jade)]/25 ring-2 ring-[var(--jade)]"
                    : "bg-white/50 ring-1 ring-[var(--wood-deep)]/15"
                }`}
              >
                {selected && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--jade-deep)] text-[9px] font-bold text-white">
                    {order + 1}
                  </span>
                )}
                <img
                  src={s.image}
                  alt={s.nameVi}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <span className="mt-0.5 line-clamp-2 text-center text-[9px] font-semibold leading-tight text-[var(--play-ink)]">
                  {s.nameVi}
                </span>
                <span className="font-play text-[10px] font-bold text-[var(--gold)]">
                  1:{s.ratio}
                </span>
                {selected && pickIds.length > 0 && (
                  <span className="mt-0.5 text-[8px] font-semibold text-[var(--jade-deep)] tabular-nums">
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

        <p className="mt-3 text-center text-[10px] text-[var(--play-muted)]">
          Thưởng khi trúng = cược × tỷ lệ × {payoutScale} ÷ số ô đã chọn (làm
          tròn xuống). Chọn {pickMin}–{pickMax} nhân vật — trúng đúng 1 ô ra
          thưởng.
        </p>
        {pickIds.length > 0 && (
          <p className="mt-1 text-center text-[10px] font-semibold text-[var(--wood-deep)] tabular-nums">
            Nếu trúng ô tỷ lệ cao nhất trong lựa chọn: nhận tối đa{" "}
            {formatXu(maxWinPreview)} xu (lãi{" "}
            {formatXu(Math.max(0, maxWinPreview - stake))})
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
        open={historyOpen}
        title="Lịch sử quay Arcana"
        onClose={() => setHistoryOpen(false)}
      >
        {historyLoading ? (
          <p className="text-sm text-[var(--play-muted)]">Đang tải…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--play-muted)]">Chưa có lượt quay</p>
        ) : (
          <ul className="space-y-2">
            {history.map((sp) => {
              const win = slotById.get(sp.winId);
              const picks = sp.pickIds?.length
                ? sp.pickIds
                : [sp.pickId];
              return (
                <li
                  key={sp.id}
                  className="rounded-lg bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--play-ink)]">
                        Ra: {win?.nameVi ?? `#${sp.winId}`}
                        <span
                          className={`ml-1 ${
                            sp.won
                              ? "text-[var(--jade-deep)]"
                              : "text-rose-600"
                          }`}
                        >
                          {sp.won ? "Thắng" : "Thua"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                        Chọn:{" "}
                        {picks
                          .map((id) => slotById.get(id)?.nameVi ?? `#${id}`)
                          .join(", ")}
                      </p>
                      <p className="text-[10px] text-[var(--play-muted)]">
                        {sp.at
                          ? new Date(sp.at).toLocaleString("vi-VN")
                          : ""}{" "}
                        · cược {formatXu(sp.stake)}
                      </p>
                    </div>
                    <span
                      className={`font-play shrink-0 font-bold tabular-nums ${
                        sp.profit >= 0
                          ? "text-[var(--jade-deep)]"
                          : "text-rose-600"
                      }`}
                    >
                      {sp.profit >= 0 ? "+" : ""}
                      {formatXu(sp.profit)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {picks.map((id) => (
                      <img
                        key={id}
                        src={
                          slotById.get(id)?.image ??
                          "/assets/ui/avatar-default.png"
                        }
                        alt=""
                        className={`h-7 w-7 rounded-full object-cover ring-1 ${
                          id === sp.winId
                            ? "ring-[var(--jade)]"
                            : "ring-[var(--wood-deep)]/20"
                        }`}
                      />
                    ))}
                    <span className="self-center text-[10px] text-[var(--play-muted)]">
                      →
                    </span>
                    <img
                      src={
                        win?.image ?? "/assets/ui/avatar-default.png"
                      }
                      alt=""
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--gold)]/50"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    </AppShell>
  );
}
