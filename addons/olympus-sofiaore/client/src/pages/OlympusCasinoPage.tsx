import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { getToken } from "../auth";
import { ensureGuestCode } from "../guest";
import "../platform/olympus.css";

type Cell = string | null;

type TumbleStep = {
  grid: Cell[][];
  removed: { r: number; c: number }[];
  win: number;
  multAdded: number[];
  orbs?: { r: number; c: number; value: number }[];
};

type FreeSpinsState = {
  left: number;
  totalAwarded: number;
  accumMult: number;
  bet: number;
};

type Mechanic = {
  id: string;
  status: "full" | "partial" | "missing";
  note: string;
};

type SpinResult = {
  spinId: string;
  bet: number;
  grid: Cell[][];
  tumbles: TumbleStep[];
  totalWin: number;
  totalMult: number;
  balance: number;
  jackpotPool?: number;
  jackpotHit?: { tier: string; amount: number } | null;
  mode?: "base" | "free";
  payMode?: "scatter" | "cluster";
  accumMult?: number;
  freeSpins?: FreeSpinsState | null;
  fsAwarded?: number;
  holdTriggered?: boolean;
  storage: {
    postgres: boolean;
    redis: boolean;
    minio: string;
    mode: string;
  };
};

type AutoMode = 0 | 10 | 25 | 50 | -1;
type PayMode = "scatter" | "cluster";

const ROWS = 5;
const COLS = 6;

const SYM = [
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "topaz",
  "pearl",
  "crown",
  "bolt",
  "zeus",
] as const;

const SYM_SRC: Record<string, string> = Object.fromEntries(
  SYM.map((s) => [s, `/assets/olympus/${s}.svg`]),
);

const SYM_LABEL: Record<string, string> = {
  ruby: "Ruby",
  sapphire: "Sapphire",
  emerald: "Emerald",
  amethyst: "Amethyst",
  topaz: "Topaz",
  pearl: "Pearl",
  crown: "Crown",
  bolt: "Bolt ×",
  zeus: "Zeus FS",
};

function randSym(): string {
  return SYM[Math.floor(Math.random() * SYM.length)];
}

function previewGrid(): Cell[][] {
  const bag = [
    ...SYM,
    ...SYM,
    "ruby",
    "sapphire",
    "emerald",
    "bolt",
    "zeus",
  ];
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => bag[(r * COLS + c * 3) % bag.length]),
  );
}

function colOf(grid: Cell[][], c: number): string[] {
  return Array.from({ length: ROWS }, (_, r) => grid[r]?.[c] || randSym());
}

function buildSpinStrip(finalCol: string[], blurCount: number): string[] {
  const blur = Array.from({ length: blurCount }, () => randSym());
  return [...blur, ...finalCol];
}

function SymImg({
  id,
  win,
  mult,
}: {
  id: string;
  win?: boolean;
  mult?: number;
}) {
  const src = SYM_SRC[id];
  if (!src) return <span className="oly-fallback">?</span>;
  return (
    <span className="oly-gem-wrap">
      <img
        src={src}
        alt={SYM_LABEL[id] || id}
        className={`oly-gem ${win ? "oly-gem-win" : ""}`}
        draggable={false}
        loading="eager"
      />
      {id === "bolt" && mult != null && mult > 0 && (
        <span className="oly-orb-tag">×{mult}</span>
      )}
    </span>
  );
}

function guestHeaders(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const tok = getToken();
  if (tok) {
    h.Authorization = `Bearer ${tok}`;
  } else {
    h["x-guest-id"] = ensureGuestCode();
  }
  return h;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function OlympusCasinoPage() {
  const [balance, setBalance] = useState(50_000);
  const [bets, setBets] = useState<number[]>([20, 50, 100, 200, 500, 1000]);
  const [bet, setBet] = useState(100);
  const [grid, setGrid] = useState<Cell[][]>(previewGrid);
  const [winSet, setWinSet] = useState<Set<string>>(new Set());
  const [dropSet, setDropSet] = useState<Set<string>>(new Set());
  const [orbMap, setOrbMap] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoMode, setAutoMode] = useState<AutoMode>(0);
  const [sessionWin, setSessionWin] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [msg, setMsg] = useState("QUAY · reel · FS · hũ Olympus");
  const [jackpotPool, setJackpotPool] = useState(80_000);
  const [jackpotBoom, setJackpotBoom] = useState<{
    tier: string;
    amount: number;
  } | null>(null);
  const [fsBoom, setFsBoom] = useState<string | null>(null);
  const [walletKind, setWalletKind] = useState<string>("guest");
  const [storage, setStorage] = useState<{
    postgres?: boolean;
    redis?: boolean;
    minio?: string;
    mode?: string;
  }>({});
  const [aka, setAka] = useState("");
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [showMechanics, setShowMechanics] = useState(false);
  const [freeSpins, setFreeSpins] = useState<FreeSpinsState | null>(null);
  const [payMode, setPayMode] = useState<PayMode>("scatter");
  const [hold, setHold] = useState<{
    lives: number;
    bet: number;
    filled: number;
    cells: (number | null)[][];
  } | null>(null);
  const [buyBonusMult, setBuyBonusMult] = useState(100);

  const [reelStrips, setReelStrips] = useState<string[][] | null>(null);
  const [reelSpinning, setReelSpinning] = useState(false);
  const [landedCols, setLandedCols] = useState<Set<number>>(new Set());

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);
  const betRef = useRef(bet);
  const turboRef = useRef(turbo);
  const payModeRef = useRef(payMode);
  betRef.current = bet;
  turboRef.current = turbo;
  payModeRef.current = payMode;

  const loadSession = useCallback(async () => {
    const r = await fetch("/api/olympus/session", { headers: guestHeaders() });
    const j = await r.json();
    if (j.ok) {
      setBalance(j.balance);
      if (typeof j.jackpotPool === "number") setJackpotPool(j.jackpotPool);
      if (j.wallet) setWalletKind(j.wallet);
      if (Array.isArray(j.bets) && j.bets.length) setBets(j.bets);
      setStorage(j.storage ?? {});
      setFreeSpins(j.freeSpins ?? null);
      setHold(j.hold ?? null);
    }
    try {
      const m = await fetch("/api/olympus/meta").then((x) => x.json());
      if (m.ok) {
        setAka(m.aka || m.officialNote || "");
        if (Array.isArray(m.mechanics)) setMechanics(m.mechanics);
        if (typeof m.buyBonusMult === "number") setBuyBonusMult(m.buyBonusMult);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const playReelSpin = async (firstGrid: Cell[][]) => {
    const fast = turboRef.current;
    const blur = fast ? 10 : 16;
    const durMs = fast ? 500 : 1050;
    const staggerMs = fast ? 70 : 120;
    const strips = Array.from({ length: COLS }, (_, c) =>
      buildSpinStrip(colOf(firstGrid, c), blur),
    );
    setWinSet(new Set());
    setDropSet(new Set());
    setOrbMap(new Map());
    setLandedCols(new Set());
    setReelStrips(strips);
    setReelSpinning(true);

    for (let c = 0; c < COLS; c++) {
      await sleep(c === 0 ? durMs : staggerMs);
      setLandedCols((prev) => new Set(prev).add(c));
    }
    await sleep(fast ? 100 : 180);
    setReelSpinning(false);
    setReelStrips(null);
    setLandedCols(new Set());
    setGrid(firstGrid);
  };

  const playTumbles = async (tumbles: TumbleStep[]) => {
    const fast = turboRef.current;
    const winMs = fast ? 200 : 520;
    const dropMs = fast ? 180 : 420;

    for (let i = 0; i < tumbles.length; i++) {
      const step = tumbles[i];
      const removed = new Set(step.removed.map((p) => `${p.r},${p.c}`));
      const orbs = new Map<string, number>();
      for (const o of step.orbs ?? []) {
        orbs.set(`${o.r},${o.c}`, o.value);
      }
      // fallback: map multAdded onto bolt cells on grid
      if (!orbs.size && step.multAdded?.length) {
        let mi = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (step.grid[r]?.[c] === "bolt" && mi < step.multAdded.length) {
              orbs.set(`${r},${c}`, step.multAdded[mi++]);
            }
          }
        }
      }
      setOrbMap(orbs);

      if (removed.size) {
        setWinSet(removed);
        if (step.win > 0) {
          setMsg(
            `+${step.win.toLocaleString()} · x${
              step.multAdded.reduce((a, b) => a + b, 0) || 1
            }`,
          );
        }
        await sleep(winMs);

        setGrid((g) =>
          g.map((row, r) =>
            row.map((cell, c) => (removed.has(`${r},${c}`) ? null : cell)),
          ),
        );
        setWinSet(new Set());
        setOrbMap(new Map());
        await sleep(fast ? 80 : 140);
      }

      const next = step.grid;
      const drops = new Set<string>();
      if (i > 0 || removed.size) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const prev = tumbles[i - 1]?.grid?.[r]?.[c];
            if (next[r][c] && next[r][c] !== prev) drops.add(`${r},${c}`);
          }
        }
        if (removed.size) {
          for (const key of removed) drops.add(key);
        }
      }
      setDropSet(drops);
      setGrid(next);
      await sleep(dropMs);
      setDropSet(new Set());

      if (!removed.size && i === tumbles.length - 1) break;
    }
  };

  const runOneSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (hold) {
      setMsg("Đang Hold & Spin — bấm Respin");
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    const wasFs = !!(freeSpins && freeSpins.left > 0);
    setMsg(
      wasFs
        ? `Free Spin · ×${freeSpins!.accumMult || 1}`
        : turboRef.current
          ? "Turbo reel…"
          : "Reel đang xoay…",
    );
    try {
      const tok = getToken();
      const useBet = betRef.current;
      const r = await fetch("/api/olympus/spin", {
        method: "POST",
        headers: guestHeaders(),
        body: JSON.stringify(
          tok
            ? { bet: useBet, payMode: payModeRef.current }
            : {
                bet: useBet,
                payMode: payModeRef.current,
                guestId: ensureGuestCode(),
              },
        ),
      });
      const j = (await r.json()) as SpinResult & {
        ok: boolean;
        reason?: string;
        wallet?: string;
      };
      if (!j.ok) {
        setMsg(j.reason || "Spin lỗi");
        autoStopRef.current = true;
        setAutoLeft(0);
        setAutoMode(0);
        return false;
      }
      setStorage(j.storage);
      setFreeSpins(j.freeSpins ?? null);

      if (j.fsAwarded && j.fsAwarded > 0) {
        setFsBoom(
          j.mode === "free"
            ? `RETRIGGER +${j.fsAwarded} FS`
            : `FREE SPINS +${j.fsAwarded}`,
        );
        window.setTimeout(() => setFsBoom(null), 2800);
      }

      const first = j.tumbles?.[0]?.grid ?? j.grid ?? previewGrid();
      await playReelSpin(first);
      await playTumbles(j.tumbles ?? []);
      setGrid(j.grid);
      setBalance(j.balance);
      if (typeof j.jackpotPool === "number") setJackpotPool(j.jackpotPool);
      setLastWin(j.totalWin + (j.jackpotHit?.amount || 0));
      setSessionWin((w) => w + j.totalWin + (j.jackpotHit?.amount || 0));
      setSpinCount((n) => n + 1);

      if (j.holdTriggered) {
        await loadSession();
        setMsg("Hold & Spin mở — Respin để thu thập Crown");
      } else if (j.jackpotHit) {
        setJackpotBoom({
          tier: j.jackpotHit.tier,
          amount: j.jackpotHit.amount,
        });
        setMsg(
          `NỔ HŨ ${j.jackpotHit.tier.toUpperCase()} +${j.jackpotHit.amount.toLocaleString()} · quay ${j.totalWin.toLocaleString()}`,
        );
        window.setTimeout(() => setJackpotBoom(null), 4200);
      } else {
        setMsg(
          j.totalWin > 0
            ? `${j.mode === "free" ? "FS " : ""}Thắng ${j.totalWin.toLocaleString()} · ×${j.accumMult || j.totalMult || 1}`
            : j.freeSpins?.left
              ? `FS còn ${j.freeSpins.left} · ×${j.freeSpins.accumMult || 1}`
              : "Chưa trúng — quay tiếp",
        );
      }
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      autoStopRef.current = true;
      setAutoLeft(0);
      setAutoMode(0);
      setReelSpinning(false);
      setReelStrips(null);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [freeSpins, hold, loadSession]);

  const runHoldSpin = useCallback(async () => {
    if (busyRef.current || !hold) return;
    busyRef.current = true;
    setBusy(true);
    setMsg("Hold respin…");
    try {
      const r = await fetch("/api/olympus/hold/spin", {
        method: "POST",
        headers: guestHeaders(),
        body: JSON.stringify(
          getToken() ? {} : { guestId: ensureGuestCode() },
        ),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg(j.reason || "Hold lỗi");
        return;
      }
      if (typeof j.jackpotPool === "number") setJackpotPool(j.jackpotPool);
      setBalance(j.balance);
      if (j.finished) {
        setHold(null);
        setLastWin(j.payout || 0);
        setSessionWin((w) => w + (j.payout || 0));
        if (j.jackpotHit) {
          setJackpotBoom({
            tier: j.jackpotHit.tier,
            amount: j.jackpotHit.amount,
          });
          window.setTimeout(() => setJackpotBoom(null), 4200);
        }
        setMsg(
          `Hold xong +${(j.payout || 0).toLocaleString()}${
            j.jackpotHit ? ` · hũ ${j.jackpotHit.tier}` : ""
          }`,
        );
      } else {
        setHold({
          lives: j.lives,
          bet: hold.bet,
          filled: j.filled,
          cells: j.cells,
        });
        setMsg(
          j.newBonus
            ? `+${j.newBonus} Crown · reset 3 · đầy ${j.filled}/30`
            : `Hold còn ${j.lives} · ${j.filled}/30`,
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [hold]);

  const buyBonus = useCallback(async () => {
    if (busyRef.current || hold || (freeSpins && freeSpins.left > 0)) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/olympus/buy-bonus", {
        method: "POST",
        headers: guestHeaders(),
        body: JSON.stringify(
          getToken()
            ? { bet: betRef.current }
            : { bet: betRef.current, guestId: ensureGuestCode() },
        ),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg(j.reason || "Mua FS lỗi");
        return;
      }
      setBalance(j.balance);
      setFreeSpins(j.freeSpins);
      if (typeof j.jackpotPool === "number") setJackpotPool(j.jackpotPool);
      setFsBoom(`FREE SPINS ×${j.freeSpins?.left || 15}`);
      window.setTimeout(() => setFsBoom(null), 2800);
      setMsg(`Đã mua ${j.freeSpins?.left} FS (−${j.cost?.toLocaleString()} xu)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [freeSpins, hold]);

  const stopAuto = useCallback(() => {
    autoStopRef.current = true;
    setAutoLeft(0);
    setAutoMode(0);
    setMsg("Đã dừng auto");
  }, []);

  const startAuto = useCallback(
    async (mode: AutoMode) => {
      if (mode === 0) {
        stopAuto();
        return;
      }
      if (busyRef.current || hold) return;
      autoStopRef.current = false;
      setAutoMode(mode);
      let left = mode === -1 ? 9999 : mode;
      setAutoLeft(mode === -1 ? -1 : left);
      setMsg(mode === -1 ? "Auto ∞" : `Auto ${mode} vòng…`);

      while (!autoStopRef.current && (mode === -1 || left > 0)) {
        const ok = await runOneSpin();
        if (!ok || autoStopRef.current) break;
        if (mode !== -1) {
          left -= 1;
          setAutoLeft(left);
          if (left <= 0) break;
        }
        await sleep(turboRef.current ? 60 : 180);
      }
      if (!autoStopRef.current) setMsg("Auto xong");
      setAutoLeft(0);
      setAutoMode(0);
    },
    [hold, runOneSpin, stopAuto],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      if (autoMode) {
        stopAuto();
        return;
      }
      if (hold) {
        if (!busyRef.current) void runHoldSpin();
        return;
      }
      if (!busyRef.current) void runOneSpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoMode, hold, runHoldSpin, runOneSpin, stopAuto]);

  const topup = async () => {
    if (getToken()) {
      setMsg("Tài khoản login: nạp xu trong hệ thống — không dùng topup demo");
      return;
    }
    const r = await fetch("/api/olympus/topup", {
      method: "POST",
      headers: guestHeaders(),
      body: JSON.stringify({ amount: 10000, guestId: ensureGuestCode() }),
    });
    const j = await r.json();
    if (j.ok) setBalance(j.balance);
    else setMsg(j.reason || "Topup lỗi");
  };

  const betIdx = bets.indexOf(bet);
  const betDown = () => {
    if (betIdx > 0) setBet(bets[betIdx - 1]);
    else if (bets.length) setBet(bets[0]);
  };
  const betUp = () => {
    if (betIdx >= 0 && betIdx < bets.length - 1) setBet(bets[betIdx + 1]);
    else if (bets.length) setBet(bets[bets.length - 1]);
  };

  const autoRunning = autoMode !== 0;
  const inFs = !!(freeSpins && freeSpins.left > 0);
  const buyCost = bet * buyBonusMult;

  const blurLen = useMemo(() => {
    if (!reelStrips) return 0;
    return Math.max(0, (reelStrips[0]?.length || 0) - ROWS);
  }, [reelStrips]);

  return (
    <div className={`oly-root ${inFs ? "oly-fs-active" : ""}`}>
      <header className="oly-top">
        <Link to="/lobby" className="oly-brand">
          Olympus Casino
          <span>SOFIAORE Live · Slot tumble</span>
        </Link>
        <p className="oly-meta">{aka}</p>
        <span className={`oly-chip ${storage.postgres ? "on" : ""}`}>
          PG {storage.postgres ? "on" : "mem"}
        </span>
        <span className={`oly-chip ${storage.redis ? "on" : ""}`}>
          Redis {storage.redis ? "on" : "off"}
        </span>
        <span className="oly-chip">
          {spinCount} spin · thắng phiên {sessionWin.toLocaleString()}
        </span>
        <span className="oly-chip on">
          Xu {walletKind === "auth" ? "AuthStore" : "demo"}
        </span>
        <button
          type="button"
          className="oly-chip oly-chip-btn"
          onClick={() => setShowMechanics((v) => !v)}
        >
          Cơ chế
        </button>
      </header>

      <div className="oly-main">
        <div className="oly-hu">
          <div className="oly-hu-label">Hũ Olympus</div>
          <div className="oly-hu-val">{jackpotPool.toLocaleString()}</div>
          <div className="oly-hu-sub">
            3% mỗi ván góp hũ · mini / major / grand
          </div>
        </div>

        {(inFs || hold) && (
          <div className="oly-feature-bar">
            {inFs && (
              <span className="oly-fs-badge">
                FS {freeSpins!.left}/{freeSpins!.totalAwarded} · ×
                {freeSpins!.accumMult || 1}
              </span>
            )}
            {hold && (
              <span className="oly-hold-badge">
                Hold {hold.lives} ♥ · {hold.filled}/30 · bet {hold.bet}
              </span>
            )}
          </div>
        )}

        {showMechanics && (
          <div className="oly-mechanics">
            <strong>Cơ chế bàn này</strong>
            <ul>
              {mechanics.map((m) => (
                <li key={m.id} className={`st-${m.status}`}>
                  <code>{m.id}</code> · {m.status} — {m.note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {jackpotBoom && (
          <div className="oly-boom" role="status">
            <div className="oly-boom-card">
              <p className="oly-boom-title">
                NỔ HŨ {jackpotBoom.tier.toUpperCase()}
              </p>
              <p className="oly-boom-amt">
                +{jackpotBoom.amount.toLocaleString()} xu
              </p>
            </div>
          </div>
        )}
        {fsBoom && (
          <div className="oly-boom oly-boom-fs" role="status">
            <div className="oly-boom-card">
              <p className="oly-boom-title">{fsBoom}</p>
            </div>
          </div>
        )}

        <div className="oly-legend" aria-label="Bộ biểu tượng">
          {SYM.map((s) => (
            <div key={s} className="oly-legend-item">
              <img src={SYM_SRC[s]} alt="" width={28} height={28} />
              <span>{SYM_LABEL[s]}</span>
            </div>
          ))}
        </div>

        <div className={`oly-stage ${reelSpinning ? "oly-shaking" : ""}`}>
          {hold ? (
            <div className="oly-hold-grid" aria-label="Hold and Spin">
              {hold.cells.map((row, r) =>
                row.map((val, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={`oly-hold-cell ${val != null ? "locked" : ""}`}
                  >
                    {val != null ? (
                      <>
                        <img src={SYM_SRC.crown} alt="" />
                        <span>×{val}</span>
                      </>
                    ) : (
                      <span className="oly-hold-empty">·</span>
                    )}
                  </div>
                )),
              )}
            </div>
          ) : (
            <div
              className={`oly-reels ${reelSpinning ? "is-spinning" : ""}`}
              aria-label="Olympus reels"
            >
              {Array.from({ length: COLS }, (_, c) => {
                const spinning = !!(reelSpinning && reelStrips);
                const landed = landedCols.has(c);
                const strip = spinning ? reelStrips![c] : colOf(grid, c);
                const style = {
                  "--oly-blur": blurLen || 16,
                  "--oly-delay": `${c * (turbo ? 0.07 : 0.12)}s`,
                  "--oly-dur": turbo ? "0.5s" : "1.05s",
                } as CSSProperties;

                return (
                  <div
                    key={c}
                    className={`oly-reel ${spinning && !landed ? "rolling" : ""} ${landed ? "landed" : ""}`}
                    style={style}
                  >
                    <div className="oly-reel-window">
                      <div className="oly-reel-strip">
                        {strip.map((sym, i) => {
                          const r = spinning ? i - blurLen : i;
                          const win =
                            !spinning &&
                            r >= 0 &&
                            r < ROWS &&
                            winSet.has(`${r},${c}`);
                          const drop =
                            !spinning &&
                            r >= 0 &&
                            r < ROWS &&
                            dropSet.has(`${r},${c}`);
                          const mult =
                            !spinning && r >= 0 && r < ROWS
                              ? orbMap.get(`${r},${c}`)
                              : undefined;
                          return (
                            <div
                              key={`${c}-${i}-${sym}`}
                              className={`oly-cell ${win ? "win" : ""} ${drop ? "dropping" : ""} ${sym === "bolt" ? "bolt" : ""} ${sym === "zeus" ? "zeus" : ""}`}
                            >
                              <SymImg id={sym} win={win} mult={mult} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="oly-modes">
            <button
              type="button"
              className={`oly-mode ${turbo ? "on" : ""}`}
              disabled={busy && !autoRunning}
              onClick={() => setTurbo((t) => !t)}
            >
              Turbo {turbo ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className={`oly-mode ${payMode === "cluster" ? "on" : ""}`}
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() =>
                setPayMode((p) => (p === "scatter" ? "cluster" : "scatter"))
              }
            >
              {payMode === "cluster" ? "Cluster ON" : "Scatter"}
            </button>
            {([10, 25, 50, -1] as AutoMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`oly-mode ${autoMode === m ? "on" : ""}`}
                disabled={(busy && !autoRunning) || !!hold}
                onClick={() => void startAuto(m)}
              >
                Auto {m === -1 ? "∞" : m}
              </button>
            ))}
            {autoRunning && (
              <button
                type="button"
                className="oly-mode danger"
                onClick={stopAuto}
              >
                Dừng
                {autoLeft < 0 ? " ∞" : autoLeft > 0 ? ` ${autoLeft}` : ""}
              </button>
            )}
          </div>

          <div className="oly-hud">
            <div className="oly-bal">
              {balance.toLocaleString()}
              <small>Xu · last +{lastWin.toLocaleString()}</small>
            </div>

            <div className="oly-bet-row">
              <button
                type="button"
                className="oly-bet-step"
                disabled={busy || autoRunning || inFs || !!hold}
                onClick={betDown}
              >
                −
              </button>
              <div className="oly-bets">
                {bets.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`oly-bet ${bet === b ? "on" : ""}`}
                    disabled={busy || autoRunning || inFs || !!hold}
                    onClick={() => setBet(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="oly-bet-step"
                disabled={busy || autoRunning || inFs || !!hold}
                onClick={betUp}
              >
                +
              </button>
            </div>

            {hold ? (
              <button
                type="button"
                className={`oly-spin ${busy ? "pulsing" : ""}`}
                disabled={busy}
                onClick={() => void runHoldSpin()}
              >
                {busy ? "…" : "RESPIN"}
              </button>
            ) : (
              <button
                type="button"
                className={`oly-spin ${busy ? "pulsing" : ""} ${inFs ? "oly-spin-fs" : ""}`}
                disabled={busy || autoRunning}
                onClick={() => void runOneSpin()}
              >
                {busy ? "…" : inFs ? "FS QUAY" : "QUAY"}
              </button>
            )}
          </div>

          <div className="oly-winline">{msg}</div>
          <p className="oly-hint">
            Scatter ≥8 · Tumble · Bolt × · Zeus FS · Buy {buyBonusMult}× · Hold
            · Cluster · Space
          </p>
          <div className="oly-actions">
            <button
              type="button"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => void buyBonus()}
            >
              Mua FS ({buyCost.toLocaleString()})
            </button>
            <button type="button" onClick={() => void topup()}>
              +10k xu demo
            </button>
            <button
              type="button"
              onClick={() => {
                setSessionWin(0);
                setLastWin(0);
                setSpinCount(0);
                setMsg("Đã reset thống kê phiên");
              }}
            >
              Reset phiên
            </button>
            <Link to="/lobby">Lobby</Link>
            <Link to="/login">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
