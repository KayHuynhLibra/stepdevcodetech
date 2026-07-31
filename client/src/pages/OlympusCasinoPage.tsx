import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { getStoredUser, getToken, homePath } from "../auth";
import { formatXu } from "../cards";
import { ensureGuestCode, getGuestCode, guestHomePath } from "../guest";
import { TableNav } from "../components/TableNav";
import { BottomSheet } from "../components/BottomSheet";
import { PlayPrefsSheet } from "../components/PlayPrefsSheet";
import { usePlayPrefs } from "../hooks/usePlayPrefs";
import {
  fetchGameHeroUrl,
  fetchOlympusBoltFx,
  fetchOlympusSymbolUrls,
  useApplyPlayMediaPresets,
  type OlympusBoltStyle,
} from "../hooks/useApplyPlayMediaPresets";
import { useSfx } from "../hooks/useSfx";
import "../platform/olympus.css";

/** Mức cược nhanh — cùng tinh thần QUICK_ADDS Tarot, scale slot */
const OLY_QUICK_ADDS = [20, 50, 100, 200, 500, 1_000, 2_000, 5_000] as const;

/** Chip ngắn gọn: 1.000 → 1K (tránh cắt chữ trên lưới) */
function formatBetChip(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(n);
}

type Cell = string | null;

type LightningTransform = {
  r: number;
  c: number;
  from: string;
  to: string;
};

type TumbleStep = {
  grid: Cell[][];
  removed: { r: number; c: number }[];
  win: number;
  multAdded: number[];
  orbs?: { r: number; c: number; value: number }[];
  combo?: number;
  cascadeMult?: number;
  rage?: number;
  rageGain?: number;
  lightningTransforms?: LightningTransform[];
  stormTrigger?: boolean;
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

type SkyTier = "calm" | "small" | "big" | "mega" | "max";

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
  rage?: number;
  maxCombo?: number;
  stormTriggered?: boolean;
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

const SYM_DEFAULT_SRC: Record<string, string> = {
  ...Object.fromEntries(SYM.map((s) => [s, `/assets/olympus/${s}.svg`])),
  wild: "/assets/olympus/wild.svg",
};

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
  wild: "Wild",
};

function resolveSkyTier(
  combo: number,
  win: number,
  bet: number,
  storm: boolean,
): SkyTier {
  if (storm) return "max";
  if (win >= bet * 50 || combo >= 20) return "max";
  if (win >= bet * 20 || combo >= 10) return "mega";
  if (win >= bet * 5 || combo >= 5) return "big";
  if (win > 0 || combo >= 1) return "small";
  return "calm";
}

function comboHudClass(combo: number): string {
  if (combo >= 20) return "oly-combo--titan";
  if (combo >= 10) return "oly-combo--red";
  if (combo >= 5) return "oly-combo--gold";
  if (combo >= 2) return "oly-combo--purple";
  if (combo >= 1) return "oly-combo--blue";
  return "";
}

/** Màu sấm theo cấp thắng / sky — mỗi bậc một palette */
function tierBoltColor(tier: SkyTier): string {
  switch (tier) {
    case "small":
      return "#7ec8ff";
    case "big":
      return "#c9a0ff";
    case "mega":
      return "#f5c542";
    case "max":
      return "#ff6b4a";
    default:
      return "#b8ecff";
  }
}

type CellPos = { r: number; c: number };
type ChainLine = { x1: number; y1: number; x2: number; y2: number };
type ZeusRay = {
  id: number;
  d: string;
  color: string;
  thickness: number;
};

function buildBoltPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: "straight" | "zigzag" | "wave",
): string {
  if (style === "straight") {
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = style === "zigzag" ? 7 : 6;
  const parts = [`M ${x1.toFixed(2)} ${y1.toFixed(2)}`];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const bx = x1 + dx * t;
    const by = y1 + dy * t;
    if (style === "zigzag") {
      const amp = (i % 2 === 0 ? 1 : -1) * (2.2 + (i % 3) * 0.6);
      parts.push(
        `L ${(bx + nx * amp).toFixed(2)} ${(by + ny * amp).toFixed(2)}`,
      );
    } else {
      const amp = Math.sin(t * Math.PI * 2.2) * 3.2;
      const cx = x1 + dx * (t - 0.5 / segs) + nx * amp;
      const cy = y1 + dy * (t - 0.5 / segs) + ny * amp;
      parts.push(
        `Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`,
      );
    }
  }
  return parts.join(" ");
}

/** Tâm ô trong hệ tọa độ % của board 6×5 */
function cellCenterPct(p: CellPos): { x: number; y: number } {
  return {
    x: ((p.c + 0.5) / COLS) * 100,
    y: ((p.r + 0.5) / ROWS) * 100,
  };
}

/** Sắp đường sấm: nearest-neighbor từ góc trên-trái → chuỗi động bộ từng ô */
function orderChainPath(cells: CellPos[]): CellPos[] {
  if (cells.length <= 1) return [...cells];
  const left = cells.map((p) => ({ ...p }));
  left.sort((a, b) => a.r - b.r || a.c - b.c);
  const path: CellPos[] = [left.shift()!];
  while (left.length) {
    const cur = path[path.length - 1];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d =
        (left[i].r - cur.r) ** 2 + (left[i].c - cur.c) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    path.push(left.splice(best, 1)[0]);
  }
  return path;
}

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
  srcMap,
}: {
  id: string;
  win?: boolean;
  mult?: number;
  srcMap: Record<string, string>;
}) {
  const src = srcMap[id] || SYM_DEFAULT_SRC[id];
  if (!src) return <span className="oly-fallback">?</span>;
  return (
    <span className="oly-gem-wrap">
      <img
        src={src}
        alt={SYM_LABEL[id] || id}
        className={`oly-gem ${win ? "oly-gem-win" : ""}`}
        width={64}
        height={64}
        draggable={false}
        decoding="async"
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
  const [bets, setBets] = useState<number[]>([...OLY_QUICK_ADDS]);
  const [bet, setBet] = useState(100);
  const [customBetOpen, setCustomBetOpen] = useState(false);
  const [customBetAmt, setCustomBetAmt] = useState(0);
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
  const [msg, setMsg] = useState("QUAY · reel · FS · hũ Olympus");
  const [jackpotPool, setJackpotPool] = useState(80_000);
  const [jackpotBoom, setJackpotBoom] = useState<{
    tier: string;
    amount: number;
  } | null>(null);
  const [fsBoom, setFsBoom] = useState<string | null>(null);
  const [walletKind, setWalletKind] = useState<string>("guest");
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

  const [rage, setRage] = useState(0);
  const [combo, setCombo] = useState(0);
  const [cascadeMult, setCascadeMult] = useState(1);
  const [skyTier, setSkyTier] = useState<SkyTier>("calm");
  const [zeusPose, setZeusPose] = useState<"idle" | "strike" | "rage">("idle");
  const [litSet, setLitSet] = useState<Set<string>>(new Set());
  /** Ô vừa bị sấm đánh (pulse) — đồng bộ chuỗi */
  const [strikeKey, setStrikeKey] = useState<string | null>(null);
  const [chainLines, setChainLines] = useState<ChainLine[]>([]);
  const [flash, setFlash] = useState(false);
  const [megaFlash, setMegaFlash] = useState(false);
  const [stormBoom, setStormBoom] = useState(false);
  const [shakeLevel, setShakeLevel] = useState(0);
  /** Banner tumble win trên deck */
  const [tumbleBanner, setTumbleBanner] = useState<string | null>(null);
  /** Overlay MEGA / BIG WIN trong stage */
  const [winFanfare, setWinFanfare] = useState<{
    tier: "big" | "mega" | "epic";
    amount: number;
  } | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [zeusHeroUrl, setZeusHeroUrl] = useState<string | null>(null);
  const [symSrc, setSymSrc] = useState<Record<string, string>>(() => ({
    ...SYM_DEFAULT_SRC,
  }));
  const [boltStyle, setBoltStyle] = useState<OlympusBoltStyle>("straight");
  const [boltThickness, setBoltThickness] = useState(2);
  const boltStyleRef = useRef<OlympusBoltStyle>("straight");
  const boltThicknessRef = useRef(2);
  const [zeusRays, setZeusRays] = useState<ZeusRay[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const zeusFigRef = useRef<HTMLDivElement | null>(null);
  const skyTierRef = useRef<SkyTier>("calm");
  const rayIdRef = useRef(0);
  const { play: playSfx, muted: sfxMuted } = useSfx("olympus", "olympus");
  const { prefs, patch } = usePlayPrefs();
  useApplyPlayMediaPresets("olympus");

  /** Mobile / reduce-motion: bật giảm FX một lần (không đè nếu user đã chỉnh). */
  useEffect(() => {
    try {
      if (localStorage.getItem("oly_fx_tuned") === "1") return;
      const narrow = window.matchMedia("(max-width: 900px)").matches;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (narrow || reduce) {
        patch({ reduceFx: true });
        localStorage.setItem("oly_fx_tuned", "1");
      }
    } catch {
      /* ignore */
    }
  }, [patch]);

  useEffect(() => {
    skyTierRef.current = skyTier;
  }, [skyTier]);

  useEffect(() => {
    void fetchGameHeroUrl("olympus").then((url) => {
      if (url) setZeusHeroUrl(url);
    });
    void fetchOlympusSymbolUrls().then((urls) => {
      setSymSrc({ ...SYM_DEFAULT_SRC, ...urls });
    });
    void fetchOlympusBoltFx().then(({ boltStyle: s, boltThickness: t }) => {
      setBoltStyle(s);
      setBoltThickness(t);
      boltStyleRef.current = s;
      boltThicknessRef.current = t;
    });
  }, []);

  useEffect(() => {
    boltStyleRef.current = boltStyle;
  }, [boltStyle]);
  useEffect(() => {
    boltThicknessRef.current = boltThickness;
  }, [boltThickness]);

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
      if (typeof j.rage === "number") setRage(j.rage);
      setFreeSpins(j.freeSpins ?? null);
      setHold(j.hold ?? null);
    }
    try {
      const m = await fetch("/api/olympus/meta").then((x) => x.json());
      if (m.ok) {
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
    playSfx("spin");

    for (let c = 0; c < COLS; c++) {
      await sleep(c === 0 ? durMs : staggerMs);
      setLandedCols((prev) => new Set(prev).add(c));
      playSfx("land");
    }
    await sleep(fast ? 100 : 180);
    setReelSpinning(false);
    setReelStrips(null);
    setLandedCols(new Set());
    setGrid(firstGrid);
  };

  /** Chuỗi sấm đánh từng ô nhỏ — đồng bộ đường nối + lit + tia từ avatar Zeus */
  const spawnZeusRay = (cellKey: string, color: string) => {
    if (prefs.reduceFx) return;
    const arena = arenaRef.current;
    const zeus = zeusFigRef.current;
    const cell = stageRef.current?.querySelector(
      `[data-oly-cell="${cellKey}"]`,
    );
    if (!arena || !zeus || !cell) return;
    const ar = arena.getBoundingClientRect();
    if (ar.width < 8 || ar.height < 8) return;
    const zr = zeus.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    const id = ++rayIdRef.current;
    const x1 = ((zr.left + zr.width * 0.58 - ar.left) / ar.width) * 100;
    const y1 = ((zr.top + zr.height * 0.28 - ar.top) / ar.height) * 100;
    const x2 = ((cr.left + cr.width * 0.5 - ar.left) / ar.width) * 100;
    const y2 = ((cr.top + cr.height * 0.45 - ar.top) / ar.height) * 100;
    const ray: ZeusRay = {
      id,
      d: buildBoltPath(x1, y1, x2, y2, boltStyleRef.current),
      color,
      thickness: boltThicknessRef.current,
    };
    setZeusRays((prev) => [...prev.slice(-10), ray]);
    window.setTimeout(() => {
      setZeusRays((prev) => prev.filter((r) => r.id !== id));
    }, turboRef.current ? 280 : 480);
  };

  const playLightningChain = async (
    cells: CellPos[],
    opts?: { hopMs?: number; keepLit?: boolean; tier?: SkyTier },
  ) => {
    const path = orderChainPath(cells).slice(0, 24);
    if (!path.length) return;
    const hop = opts?.hopMs ?? (turboRef.current ? 45 : 75);
    const tier = opts?.tier ?? skyTierRef.current;
    const boltColor = tierBoltColor(tier);
    const lit = new Set<string>();
    const lines: ChainLine[] = [];
    setZeusPose(tier === "max" || tier === "mega" ? "rage" : "strike");
    setShakeLevel(
      Math.min(3, (tier === "max" ? 2 : tier === "mega" ? 1 : 0) + 1 + Math.floor(path.length / 6)),
    );
    playSfx("thunder");
    for (let i = 0; i < path.length; i++) {
      const cur = path[i];
      const key = `${cur.r},${cur.c}`;
      lit.add(key);
      setLitSet(new Set(lit));
      setStrikeKey(key);
      spawnZeusRay(key, boltColor);
      // Thỉnh thoảng tia phụ màu phụ khi mega/max
      if ((tier === "mega" || tier === "max") && i % 2 === 1) {
        window.setTimeout(
          () =>
            spawnZeusRay(
              key,
              tier === "max" ? "#fff6c8" : "#7ec8ff",
            ),
          hop * 0.35,
        );
      }
      if (i > 0) {
        const prev = path[i - 1];
        const a = cellCenterPct(prev);
        const b = cellCenterPct(cur);
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        setChainLines([...lines]);
      }
      if (i === 0 || i % 3 === 0) playSfx("land");
      await sleep(hop);
    }
    setStrikeKey(null);
    if (!opts?.keepLit) {
      /* caller may promote to winSet */
    }
  };

  const playTumbles = async (tumbles: TumbleStep[], betAmt: number) => {
    const fast = turboRef.current;
    const winMs = fast ? 200 : 520;
    const dropMs = fast ? 180 : 420;

    for (let i = 0; i < tumbles.length; i++) {
      const step = tumbles[i];
      const stepCombo = step.combo ?? 0;
      const stepMult = step.cascadeMult ?? 1;
      setCombo(stepCombo);
      setCascadeMult(stepMult);
      if (typeof step.rage === "number") setRage(step.rage);

      if (step.stormTrigger) {
        setStormBoom(true);
        setZeusPose("rage");
        setSkyTier("max");
        setMegaFlash(true);
        setShakeLevel(3);
        playSfx("thunder");
        // Barrage sấm từ Zeus xuống nhiều ô trước storm
        if (!prefs.reduceFx) {
          const barrage = Array.from({ length: 8 }, (_, i) => ({
            r: Math.floor(Math.random() * ROWS),
            c: Math.floor(Math.random() * COLS),
            delay: i * (fast ? 35 : 55),
            alt: i % 2 === 0,
          }));
          for (const b of barrage) {
            window.setTimeout(
              () =>
                spawnZeusRay(
                  `${b.r},${b.c}`,
                  b.alt ? "#ff6b4a" : "#fff6c8",
                ),
              b.delay,
            );
          }
        }
        await sleep(fast ? 400 : 900);
        setMegaFlash(false);
        window.setTimeout(() => setStormBoom(false), fast ? 1200 : 2200);
      }

      const transforms = step.lightningTransforms ?? [];
      if (transforms.length) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), fast ? 120 : 220);
        await playLightningChain(
          transforms.map((t) => ({ r: t.r, c: t.c })),
          {
            hopMs: fast ? 40 : 70,
            keepLit: true,
            tier: skyTierRef.current === "calm" ? "small" : skyTierRef.current,
          },
        );
        await sleep(fast ? 80 : 160);
        setLitSet(new Set());
        setChainLines([]);
        setStrikeKey(null);
      }

      const removed = new Set(step.removed.map((p) => `${p.r},${p.c}`));
      const orbs = new Map<string, number>();
      for (const o of step.orbs ?? []) {
        orbs.set(`${o.r},${o.c}`, o.value);
      }
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
        const nextTier = resolveSkyTier(stepCombo, step.win, betAmt, false);
        setSkyTier(nextTier);
        if (stepCombo >= 10 || stepMult >= 50) {
          setMegaFlash(true);
          window.setTimeout(() => setMegaFlash(false), fast ? 280 : 520);
        }

        // Chuỗi sấm tuần tự vào từng ô thắng → rồi mới hiện win-frame đồng bộ
        await playLightningChain(step.removed, {
          hopMs: fast ? 38 : 68,
          keepLit: true,
          tier: nextTier,
        });
        setWinSet(new Set(removed));
        setLitSet(new Set());
        setStrikeKey(null);

        if (step.win > 0) {
          const shown = step.win;
          setTumbleBanner(
            `TUMBLE WIN ${shown.toLocaleString("vi-VN")}${stepMult > 1 ? ` ×${stepMult}` : ""}`,
          );
          setMsg(
            `Combo ×${stepCombo} · +${step.win.toLocaleString()} · mult ×${stepMult}`,
          );
          playSfx("oly_win");
          const ratio = betAmt > 0 ? step.win / betAmt : 0;
          if (ratio >= 50 || stepCombo >= 20) {
            setWinFanfare({ tier: "epic", amount: step.win });
          } else if (ratio >= 20 || stepCombo >= 10) {
            setWinFanfare({ tier: "mega", amount: step.win });
          } else if (ratio >= 8 || stepCombo >= 5) {
            setWinFanfare({ tier: "big", amount: step.win });
          }
        }
        await sleep(winMs);
        setChainLines([]);
        setWinSet(new Set());
        setOrbMap(new Map());
        setShakeLevel(0);
        setTumbleBanner(null);
        window.setTimeout(() => setWinFanfare(null), fast ? 480 : 850);

        setGrid((g) =>
          g.map((row, r) =>
            row.map((cell, c) => (removed.has(`${r},${c}`) ? null : cell)),
          ),
        );
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
      setZeusPose(stepCombo >= 10 ? "rage" : "idle");

      if (!removed.size && i === tumbles.length - 1) break;
    }
    setShakeLevel(0);
  };

  const runOneSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (hold) {
      setMsg("Đang Hold & Spin — bấm Respin");
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    setCombo(0);
    setCascadeMult(1);
    setZeusPose("idle");
    setSkyTier("calm");
    const wasFs = !!(freeSpins && freeSpins.left > 0);
    setMsg(
      wasFs
        ? `Free Spin · ×${freeSpins!.accumMult || 1}`
        : turboRef.current
          ? "Turbo reel…"
          : "Zeus đang triệu hồi…",
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
      await playTumbles(j.tumbles ?? [], j.bet || useBet);
      setGrid(j.grid);
      setBalance(j.balance);
      if (typeof j.jackpotPool === "number") setJackpotPool(j.jackpotPool);
      if (typeof j.rage === "number") setRage(j.rage);
      const maxCombo = j.maxCombo ?? 0;
      setCombo(maxCombo);
      setCascadeMult(j.accumMult || j.totalMult || 1);
      const totalPay = j.totalWin + (j.jackpotHit?.amount || 0);
      setLastWin(totalPay);
      setSessionWin((w) => w + totalPay);
      setSkyTier(
        resolveSkyTier(
          maxCombo,
          totalPay,
          j.bet || useBet,
          !!j.stormTriggered,
        ),
      );
      setZeusPose(j.stormTriggered || maxCombo >= 10 ? "rage" : "idle");

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
            ? `${j.mode === "free" ? "FS " : ""}Thắng ${j.totalWin.toLocaleString()} · Combo ×${maxCombo} · ×${j.accumMult || j.totalMult || 1}`
            : j.freeSpins?.left
              ? `FS còn ${j.freeSpins.left} · ×${j.freeSpins.accumMult || 1}`
              : "Chưa trúng — Zeus chờ sấm…",
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
  const jpMini = Math.max(bet * 15, Math.floor(jackpotPool * 0.15));
  const jpMajor = Math.max(bet * 15, Math.floor(jackpotPool * 0.4));
  const jpGrand = Math.max(bet * 15, Math.floor(jackpotPool * 1));

  const applyCustomBet = () => {
    const n = Math.floor(customBetAmt);
    if (!Number.isFinite(n) || n <= 0) return;
    const capped = Math.min(n, Math.max(1, balance));
    setBet(capped);
    if (!bets.includes(capped)) {
      setBets((prev) =>
        [...prev, capped].sort((a, b) => a - b).slice(0, 10),
      );
    }
    setCustomBetOpen(false);
  };

  const blurLen = useMemo(() => {
    if (!reelStrips) return 0;
    return Math.max(0, (reelStrips[0]?.length || 0) - ROWS);
  }, [reelStrips]);

  const me = getStoredUser();
  const guestCode = !me ? getGuestCode() || ensureGuestCode() : null;
  const lobbyTo = me ? homePath(me) : guestHomePath(guestCode);
  const rageFull = rage >= 100;
  const rageBlocks = 10;
  const rageFilled = Math.round((rage / 100) * rageBlocks);

  return (
    <div
      className={`oly-root ${inFs ? "oly-fs-active" : ""} ${comboHudClass(combo)} ${prefs.reduceFx ? "oly-reduce-fx" : ""}`}
    >
      <div className="oly-atmosphere" aria-hidden>
        <img className="oly-atm-temple" src="/assets/olympus/bg-temple.svg" alt="" />
        <span className="oly-atm-mist oly-atm-mist--l" />
        <span className="oly-atm-mist oly-atm-mist--r" />
        <span className="oly-atm-bolt oly-atm-bolt--a" />
        <span className="oly-atm-bolt oly-atm-bolt--b" />
        <span className="oly-atm-stars" />
      </div>
      <header className="oly-top oly-top--play">
        <Link to={lobbyTo} className="oly-brand oly-brand--compact">
          ZEUS
          <span>Lobby</span>
        </Link>
        <div className="oly-meters" aria-label="Số dư và hũ">
          <div className="oly-meter oly-meter--xu">
            <span>Xu</span>
            <strong title={formatXu(balance)}>{formatXu(balance)}</strong>
          </div>
          <div className="oly-meter oly-meter--hu" title={`Mini ${formatXu(jpMini)} · Major ${formatXu(jpMajor)} · Grand ${formatXu(jpGrand)}`}>
            <span>Hũ</span>
            <strong title={formatXu(jackpotPool)}>{formatXu(jackpotPool)}</strong>
          </div>
        </div>
        {sessionWin > 0 ? (
          <span className="oly-chip oly-chip--win" title="Thắng phiên">
            +{formatXu(sessionWin)}
          </span>
        ) : null}
        <button
          type="button"
          className={`oly-chip oly-chip-btn ${sfxMuted ? "oly-chip--muted" : ""}`}
          onClick={() => setPrefsOpen(true)}
          title="Âm thanh & hình"
          aria-label="Cài âm thanh và hình ảnh"
        >
          {sfxMuted ? "Tắt" : "Âm"}
        </button>
        <button
          type="button"
          className="oly-chip oly-chip-btn"
          onClick={() => setShowMechanics((v) => !v)}
          aria-expanded={showMechanics}
          title="Cơ chế"
        >
          ?
        </button>
      </header>
      {me || guestCode ? (
        <div className="oly-nav-wrap oly-nav-wrap--desktop" aria-label="Các bàn đang mở">
          <TableNav
            user={me}
            guestCode={guestCode}
            active="olympus"
            compact
          />
        </div>
      ) : null}

      <div className="oly-main oly-main--play">
        <div
          ref={arenaRef}
          className={`oly-arena oly-arena--${skyTier} ${stormBoom ? "oly-arena--storm" : ""}`}
        >
        <div className="oly-zeus-bar">
          <div
            ref={zeusFigRef}
            className={`oly-zeus-figure oly-zeus--${zeusPose}`}
          >
            {zeusHeroUrl ? (
              <img
                src={zeusHeroUrl}
                alt=""
                width={480}
                height={524}
                decoding="async"
                fetchPriority="low"
                draggable={false}
              />
            ) : (
              <picture>
                <source
                  media="(max-width: 640px)"
                  srcSet="/assets/olympus/zeus-hero-sm.png"
                />
                <img
                  src="/assets/olympus/zeus-hero.png"
                  alt=""
                  width={480}
                  height={524}
                  decoding="async"
                  fetchPriority="low"
                  draggable={false}
                />
              </picture>
            )}
          </div>
          <div className="oly-zeus-meters">
            <div className={`oly-combo-display ${comboHudClass(combo)}`}>
              <span className="oly-combo-label">Combo</span>
              <span className="oly-combo-val">×{combo}</span>
            </div>
            <div className={`oly-mult-display ${cascadeMult > 1 ? "oly-mult--hot" : ""}`}>
              <span className="oly-combo-label">Mult</span>
              <span className="oly-mult-val">×{cascadeMult}</span>
            </div>
            <div
              className={`oly-rage ${rageFull ? "oly-rage--full" : ""}`}
              title="Zeus Rage"
            >
              <div className="oly-rage-label">
                Rage {rage}
                {rageFull ? " · FULL" : ""}
              </div>
              <div className="oly-rage-track" aria-hidden>
                {Array.from({ length: rageBlocks }, (_, i) => (
                  <span
                    key={i}
                    className={`oly-rage-block ${i < rageFilled ? "on" : ""}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {hold ? (
          <div className="oly-feature-bar">
            <span className="oly-hold-badge">
              Hold {hold.lives} ♥ · {hold.filled}/30 · bet {hold.bet}
            </span>
          </div>
        ) : null}

        {showMechanics && (
          <div className="oly-mechanics">
            <strong>Cơ chế đang chạy</strong>
            <ul>
              {mechanics
                .filter((m) => m.status === "full" || m.status === "partial")
                .map((m) => (
                  <li key={m.id} className={`st-${m.status}`}>
                    <code>{m.id}</code>
                    <span className={`oly-mech-pill st-${m.status}`}>
                      {m.status}
                    </span>
                    <span className="oly-mech-note">— {m.note}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {prefs.symbolStrip !== "off" && (
          <div
            className={`oly-legend ${prefs.symbolStrip === "icons" ? "oly-legend--icons" : ""}`}
            aria-label="Bộ biểu tượng"
          >
            {SYM.map((s) => (
              <div key={s} className="oly-legend-item" title={SYM_LABEL[s]}>
                <img
                  src={symSrc[s] || SYM_DEFAULT_SRC[s]}
                  alt=""
                  width={28}
                  height={28}
                  decoding="async"
                />
                {prefs.symbolStrip === "labels" ? (
                  <span>{SYM_LABEL[s]}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Deck riêng: FX/sky/shake chỉ trên lưới ô — controls nằm ngoài */}
        <div className="oly-stage-wrap">
          <img
            className="oly-pillar oly-pillar--l"
            src="/assets/olympus/pillar.svg"
            alt=""
            aria-hidden
          />
          <img
            className="oly-pillar oly-pillar--r"
            src="/assets/olympus/pillar.svg"
            alt=""
            aria-hidden
          />
          <div
            ref={stageRef}
            className={`oly-stage oly-sky--${skyTier} ${stormBoom ? "oly-storming" : ""} ${reelSpinning || shakeLevel > 0 ? "oly-shaking" : ""} ${shakeLevel >= 2 ? "oly-shaking--hard" : ""} ${shakeLevel >= 3 ? "oly-shaking--titan" : ""}`}
          >
            <img
              className="oly-frame-ornate"
              src="/assets/olympus/frame-ornate.svg"
              alt=""
              aria-hidden
            />
            <div className="oly-sky oly-sky--stage" aria-hidden>
              <img
                className="oly-sky-cloud oly-sky-cloud--a"
                src="/assets/olympus/cloud.svg"
                alt=""
              />
              <img
                className="oly-sky-cloud oly-sky-cloud--b"
                src="/assets/olympus/cloud.svg"
                alt=""
              />
              <img
                className="oly-sky-cloud oly-sky-cloud--c"
                src="/assets/olympus/cloud.svg"
                alt=""
              />
              <span className="oly-sky-flash" />
            </div>

          {jackpotBoom && (
            <div className="oly-boom" role="status">
              <div className="oly-boom-card">
                <p className="oly-boom-title">
                  NỔ HŨ {jackpotBoom.tier.toUpperCase()}
                </p>
                <p className="oly-boom-amt">
                  +{formatXu(jackpotBoom.amount)} xu
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
          {stormBoom && (
            <div className="oly-boom oly-boom-storm" role="status">
              <div className="oly-boom-card">
                <p className="oly-boom-title">THUNDER STORM</p>
                <p className="oly-boom-amt">Zeus nổi giận · SIÊU SẤM</p>
              </div>
            </div>
          )}
          {flash && <div className="oly-flash" aria-hidden />}
          {megaFlash && (
            <div className="oly-flash oly-flash--mega" aria-hidden />
          )}
          {tumbleBanner && (
            <div className="oly-tumble-banner" role="status">
              {tumbleBanner}
            </div>
          )}
          {winFanfare && (
            <div
              className={`oly-fanfare oly-fanfare--${winFanfare.tier}`}
              role="status"
            >
              <div className="oly-fanfare-wing" aria-hidden />
              <p className="oly-fanfare-title">
                {winFanfare.tier === "epic"
                  ? "EPIC!"
                  : winFanfare.tier === "mega"
                    ? "MEGA!"
                    : "BIG WIN!"}
              </p>
              <p className="oly-fanfare-amt">
                +{winFanfare.amount.toLocaleString("vi-VN")}
              </p>
            </div>
          )}

          <div className="oly-board">
            {chainLines.length > 0 && (
              <svg
                className="oly-chain"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                {chainLines.map((ln, idx) => (
                  <g key={idx}>
                    <line
                      x1={ln.x1}
                      y1={ln.y1}
                      x2={ln.x2}
                      y2={ln.y2}
                      className="oly-chain-line oly-chain-line--glow"
                    />
                    <line
                      x1={ln.x1}
                      y1={ln.y1}
                      x2={ln.x2}
                      y2={ln.y2}
                      className="oly-chain-line"
                    />
                  </g>
                ))}
              </svg>
            )}
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
                          <img
                            src={symSrc.crown || SYM_DEFAULT_SRC.crown}
                            alt=""
                            width={36}
                            height={36}
                            decoding="async"
                          />
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
                            const key =
                              r >= 0 && r < ROWS ? `${r},${c}` : "";
                            const lit =
                              !spinning && !!key && litSet.has(key);
                            const striking =
                              !spinning && !!key && strikeKey === key;
                            return (
                              <div
                                key={`${c}-${i}-${sym}`}
                                data-oly-cell={key || undefined}
                                className={`oly-cell ${win ? "win" : ""} ${drop ? "dropping" : ""} ${lit ? "lit" : ""} ${striking ? "striking" : ""} ${sym === "bolt" ? "bolt" : ""} ${sym === "zeus" ? "zeus" : ""} ${sym === "wild" ? "wild" : ""}`}
                              >
                              {lit || striking ? (
                                <>
                                  <span className="oly-strike-flash" aria-hidden />
                                  <img
                                    className="oly-strike-bolt"
                                    src="/assets/olympus/bolt-arc.svg"
                                    alt=""
                                  />
                                </>
                              ) : null}
                              {win ? (
                                <span className="oly-win-frame" aria-hidden />
                              ) : null}
                              <SymImg id={sym} win={win} mult={mult} srcMap={symSrc} />
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
          </div>
        </div>
        </div>

        {zeusRays.length > 0 ? (
          <svg
            className="oly-zeus-rays"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {zeusRays.map((ray) => (
              <g key={ray.id} className="oly-zeus-ray">
                <path
                  d={ray.d}
                  fill="none"
                  stroke={ray.color}
                  strokeWidth={ray.thickness * 1.6}
                  className="oly-zeus-ray-glow"
                />
                <path
                  d={ray.d}
                  fill="none"
                  stroke={ray.color}
                  strokeWidth={Math.max(0.6, ray.thickness * 0.45)}
                  className="oly-zeus-ray-core"
                />
              </g>
            ))}
          </svg>
        ) : null}
        </div>

        <div className="oly-controls">
          <div className="oly-ctrl-panel oly-ctrl-panel--dock">
            <button
              type="button"
              className="oly-dock-bet"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => {
                setCustomBetAmt(bet);
                setCustomBetOpen(true);
              }}
              aria-label="Mở đặt cược"
            >
              <span className="oly-dock-bet__lab">Cược</span>
              <strong title={formatXu(bet)}>{formatXu(bet)}</strong>
              {lastWin > 0 ? (
                <small className="oly-bal-last">+{formatXu(lastWin)}</small>
              ) : null}
            </button>

            <button
              type="button"
              className={`oly-mode oly-dock-turbo ${turbo ? "on" : ""}`}
              disabled={busy && !autoRunning}
              onClick={() => setTurbo((t) => !t)}
            >
              Turbo
            </button>

            {autoRunning ? (
              <button
                type="button"
                className="oly-mode danger oly-dock-stop"
                onClick={stopAuto}
              >
                Dừng
                <span className="oly-dock-stop__n">
                  {autoLeft < 0 ? "∞" : autoLeft > 0 ? autoLeft : ""}
                </span>
              </button>
            ) : null}

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
          {msg ? <div className="oly-winline oly-winline--dock">{msg}</div> : null}
        </div>
      </div>

      <BottomSheet
        open={customBetOpen}
        onClose={() => setCustomBetOpen(false)}
        title="Cược & chế độ"
        backdropClass="bg-black/65"
        shellClass="oly-stake-sheet"
        heightClass="max-h-[88vh]"
      >
        <div className="oly-stake-sheet-body">
          <p className="oly-stake-status">
            Số dư <strong>{formatXu(balance)}</strong> · đang{" "}
            <strong>{formatXu(bet)}</strong>
          </p>

          <p className="oly-stake-sec">Mức cược</p>
          <div className="oly-bet-row oly-bet-row--sheet">
            <button
              type="button"
              className="oly-bet-step"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={betDown}
              aria-label="Giảm cược"
            >
              −
            </button>
            <div className="oly-bets" role="group" aria-label="Mức cược">
              {bets.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`oly-bet stake-sheet-chip ${bet === b ? "on" : ""}`}
                  disabled={busy || autoRunning || inFs || !!hold || b > balance}
                  onClick={() => {
                    setBet(b);
                    setCustomBetAmt(b);
                  }}
                  title={formatXu(b)}
                >
                  {formatBetChip(b)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="oly-bet-step"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={betUp}
              aria-label="Tăng cược"
            >
              +
            </button>
          </div>

          <div className="oly-stake-quick">
            {OLY_QUICK_ADDS.map((n) => (
              <button
                key={n}
                type="button"
                className="stake-sheet-chip"
                disabled={
                  busy || autoRunning || inFs || !!hold || n > balance
                }
                onClick={() =>
                  setCustomBetAmt((a) => Math.min((a || bet) + n, balance))
                }
              >
                +{formatXu(n)}
              </button>
            ))}
          </div>
          <div className="oly-stake-quick">
            <button
              type="button"
              className="oly-mode"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => setCustomBetAmt(0)}
            >
              Xóa
            </button>
            <button
              type="button"
              className="oly-mode"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => setCustomBetAmt(balance)}
            >
              Max
            </button>
          </div>
          <label className="oly-stake-input-lab">
            Số xu cược
            <input
              type="number"
              className="oly-stake-input"
              min={1}
              max={balance}
              disabled={busy || autoRunning || inFs || !!hold}
              value={customBetAmt || ""}
              onChange={(e) => setCustomBetAmt(Number(e.target.value) || 0)}
            />
          </label>
          <button
            type="button"
            className="stake-sheet-confirm oly-stake-confirm"
            disabled={
              busy ||
              autoRunning ||
              inFs ||
              !!hold ||
              customBetAmt <= 0 ||
              customBetAmt > balance
            }
            onClick={applyCustomBet}
          >
            Áp dụng {formatXu(customBetAmt)} xu
          </button>

          <p className="oly-stake-sec">Chế độ trả</p>
          <div className="oly-stake-quick" role="group" aria-label="Pay mode">
            <button
              type="button"
              className={`oly-mode ${payMode === "scatter" ? "on" : ""}`}
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => setPayMode("scatter")}
            >
              Scatter
            </button>
            <button
              type="button"
              className={`oly-mode ${payMode === "cluster" ? "on" : ""}`}
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => setPayMode("cluster")}
            >
              Cluster
            </button>
          </div>

          <p className="oly-stake-sec">Auto</p>
          <div className="oly-stake-quick" role="group" aria-label="Auto">
            {([10, 25, 50, -1] as AutoMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`oly-mode ${autoMode === m ? "on" : ""}`}
                disabled={(busy && !autoRunning) || !!hold}
                onClick={() => {
                  void startAuto(m);
                  setCustomBetOpen(false);
                }}
                title={m === -1 ? "Auto ∞" : `Auto ${m}`}
              >
                {m === -1 ? "∞" : m}
              </button>
            ))}
          </div>

          <p className="oly-stake-sec">Khác</p>
          <div className="oly-stake-quick oly-stake-actions">
            <button
              type="button"
              className="oly-mode"
              disabled={busy || autoRunning || inFs || !!hold}
              onClick={() => void buyBonus()}
            >
              Mua FS ({formatXu(buyCost)})
            </button>
            {walletKind !== "auth" ? (
              <button
                type="button"
                className="oly-mode"
                onClick={() => void topup()}
              >
                +10k demo
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="oly-stake-done"
            onClick={() => setCustomBetOpen(false)}
          >
            Xong
          </button>
        </div>
      </BottomSheet>

      <PlayPrefsSheet
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        tone="dark"
      />
    </div>
  );
}

