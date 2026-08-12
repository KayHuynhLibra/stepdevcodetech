import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getStoredUser, getToken, saveSession } from "../auth";
import {
  discountedGemPrice,
  nobilityLabel,
  nobilityTierOf,
} from "../nobility";
import { AppShell } from "../components/AppShell";
import { BottomSheet } from "../components/BottomSheet";
import { GameChrome } from "../components/GameChrome";
import {
  GiftHubSheet,
  type GiftHubTarget,
} from "../components/GiftHubSheet";
import { VirtualPlayFooter } from "../components/VirtualPlayFooter";
import { LudoPawnCosmeticsSheet } from "../components/LudoPawnCosmeticsSheet";
import { ensureGuestCode, getGuestCode } from "../guest";
import { useApplyPlayMediaPresets } from "../hooks/useApplyPlayMediaPresets";
import { useLudoCosmetics } from "../hooks/useLudoCosmetics";
import { useSfx } from "../hooks/useSfx";
import { LudoBoard } from "../platform/ludo/LudoBoard";
import type { LudoCornerPlayer } from "../platform/ludo/LudoCornerAvatars";
import { sendGiftFromCatalog } from "../socialGift";
import {
  type LudoViewMode,
} from "../platform/ludo/cosmeticsCatalog";
import {
  prefetchLudo3D,
  preferLiteBoard,
  readLudoBoardMode,
  writeLudoBoardMode,
  type LudoBoardMode,
} from "../platform/ludo/preferLiteBoard";
import {
  readOrbitLock,
  subscribeOrbitLock,
} from "../platform/ludo/ludoOrbitLock";
import { LudoOrbitNavPad } from "../platform/ludo/LudoOrbitNavPad";
import {
  readLudoViewModeOverride,
  resolveViewMode,
  writeLudoViewModeOverride,
} from "../platform/ludo/ludoViewMode";
import {
  pawnDecorClass,
  pawnDecorGlyph,
} from "../platform/ludo/pawnDecorVisual";
import {
  LUDO_THEMES,
  isFreeLudoTheme,
  normalizeThemeId,
  themeSeatColors,
  type LudoThemeId,
} from "../platform/ludo/themes";
import "../platform/ludo/ludo.css";

type LudoColor = "red" | "green" | "yellow" | "blue";

type LudoPlayer = {
  seat: number;
  color: LudoColor;
  userId: string | null;
  guestId: string | null;
  displayName: string;
  isBot: boolean;
  strikes: number;
  connected: boolean;
  avatar?: string | null;
  avatarFrame?: string | null;
  pawnDecorId?: string | null;
};

type LudoToken = {
  id: string;
  color: LudoColor;
  index: number;
  pos: number;
};

type LudoRoom = {
  roomId: string;
  status: "lobby" | "playing" | "finished";
  players: LudoPlayer[];
  tokens: LudoToken[];
  turnSeat: number;
  phase: string;
  dice: number | null;
  lastDice?: number | null;
  diceFaces?: number[];
  lastDiceFaces?: number[];
  pendingDice?: number[];
  pendingMoves?: { dieIndex: number; face: number; tokenIds: string[] }[];
  diceMode?: 1 | 2;
  rollSeq?: number;
  lastRollSeat?: number | null;
  validTokenIds: string[];
  consecutiveSixes: number;
  turnDeadline: number;
  winnerSeat: number | null;
  lastEvent: string | null;
  stake: number;
  pot?: number;
  settled?: boolean;
  themeId?: LudoThemeId;
  hostUserId?: string | null;
};

const STAKE_PRESETS_FALLBACK = [0, 500, 1000, 5000] as const;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  else h["x-guest-id"] = ensureGuestCode();
  return h;
}

export default function LudoPage() {
  useApplyPlayMediaPresets("ludo");
  const cosmetics = useLudoCosmetics();
  const { play: playSfx, muted: sfxMuted, toggleMute } = useSfx("tarot", "ludo");
  const me = getStoredUser();
  const guestCode = !me ? getGuestCode() || ensureGuestCode() : null;
  const [room, setRoom] = useState<LudoRoom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [themeId, setThemeId] = useState<LudoThemeId>("classic");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [boardMode, setBoardMode] = useState<LudoBoardMode>(() =>
    readLudoBoardMode(),
  );
  const [viewOverride, setViewOverride] = useState<LudoViewMode | null>(() =>
    readLudoViewModeOverride(),
  );
  const [viewPopupOpen, setViewPopupOpen] = useState(false);
  const [orbitLock, setOrbitLock] = useState(() => readOrbitLock());
  const [boardPopupOpen, setBoardPopupOpen] = useState(false);
  const [rulesPopupOpen, setRulesPopupOpen] = useState(false);
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftPreset, setGiftPreset] = useState<GiftHubTarget | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [stake, setStake] = useState(0);
  const [stakePresets, setStakePresets] = useState<number[]>([
    ...STAKE_PRESETS_FALLBACK,
  ]);
  const [diceMode, setDiceMode] = useState<1 | 2>(1);
  const [diceThrowKey, setDiceThrowKey] = useState(0);
  const [diceThrowFaces, setDiceThrowFaces] = useState<number[]>([]);
  const [diceThrowColor, setDiceThrowColor] = useState<string | null>(null);
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(
    null,
  );
  const diceSigRef = useRef<string>("");
  const [equipSummary, setEquipSummary] = useState<{
    pawn: string;
    pawnId: string;
    frame: string;
  } | null>(null);
  const [ownedBoardIds, setOwnedBoardIds] = useState<string[]>(() =>
    LUDO_THEMES.filter((t) => t.free).map((t) => t.boardItemId),
  );
  const [shopBalance, setShopBalance] = useState<number | null>(null);
  const prevSnap = useRef<{
    tokens: Record<string, number>;
    dice: number | null;
    lastEvent: string | null;
    status: string | null;
    tickedAt: number;
  }>({ tokens: {}, dice: null, lastEvent: null, status: null, tickedAt: 0 });

  const usingLite = preferLiteBoard(boardMode);
  const viewMode = resolveViewMode(cosmetics.viewMode, viewOverride);

  useEffect(() => {
    if (!room) {
      diceSigRef.current = "";
      return;
    }
    const faces =
      (room.diceFaces && room.diceFaces.length
        ? room.diceFaces
        : room.lastDiceFaces && room.lastDiceFaces.length
          ? room.lastDiceFaces
          : room.dice != null
            ? [room.dice]
            : room.lastDice != null
              ? [room.lastDice]
              : []
      ).filter((f) => f >= 1 && f <= 6);
    const seq = room.rollSeq ?? 0;
    if (!faces.length || seq <= 0) return;
    const sig = String(seq);
    if (sig === diceSigRef.current) return;
    diceSigRef.current = sig;
    const seat =
      room.lastRollSeat != null
        ? room.lastRollSeat
        : room.turnSeat;
    const roller = room.players.find((p) => p.seat === seat);
    setDiceThrowFaces(faces);
    setDiceThrowColor(roller?.color ?? null);
    setDiceThrowKey(seq);
  }, [room]);

  useEffect(() => {
    prefetchLudo3D(boardMode);
  }, [boardMode]);

  const refreshEquipSummary = useCallback(async () => {
    if (!me) {
      setEquipSummary(null);
      setOwnedBoardIds(
        LUDO_THEMES.filter((t) => t.free).map((t) => t.boardItemId),
      );
      setShopBalance(null);
      return;
    }
    try {
      const token = getToken();
      const r = await fetch("/api/ludo/shop", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await r.json();
      if (!j.ok) return;
      const catalog = (j.catalog || []) as {
        id: string;
        nameVi: string;
      }[];
      const pawnId = String(j.equippedPawn || "pawn-classic");
      const pawn =
        catalog.find((c) => c.id === j.equippedPawn)?.nameVi ||
        j.equippedPawn ||
        "Quân cổ điển";
      const frame =
        catalog.find((c) => c.id === j.equippedFrame)?.nameVi ||
        j.equippedFrame ||
        "Khung cổ điển";
      setEquipSummary({ pawn, pawnId, frame });
      const owned = Array.isArray(j.ownedIds) ? j.ownedIds.map(String) : [];
      const freeBoards = LUDO_THEMES.filter((t) => t.free).map(
        (t) => t.boardItemId,
      );
      setOwnedBoardIds([...new Set([...freeBoards, ...owned])]);
      setShopBalance(
        typeof j.balance === "number" ? j.balance : null,
      );
      if (Array.isArray(j.stakePresets) && j.stakePresets.length) {
        setStakePresets(
          j.stakePresets
            .map((n: unknown) => Math.floor(Number(n)))
            .filter((n: number) => Number.isFinite(n) && n >= 0),
        );
      }
      /* Sync theme prices from live catalog when present */
      if (Array.isArray(j.catalog)) {
        for (const row of j.catalog as {
          id: string;
          priceXu: number;
          priceGem?: number;
          themeId?: string;
        }[]) {
          const meta = LUDO_THEMES.find(
            (t) => t.boardItemId === row.id || t.id === row.themeId,
          );
          if (meta && typeof row.priceXu === "number") {
            meta.priceXu = row.priceXu;
          }
          if (meta && typeof row.priceGem === "number") {
            meta.priceGem = row.priceGem;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [me]);

  const ownsTheme = useCallback(
    (id: LudoThemeId) => {
      if (isFreeLudoTheme(id)) return true;
      const meta = LUDO_THEMES.find((t) => t.id === id);
      return meta ? ownedBoardIds.includes(meta.boardItemId) : false;
    },
    [ownedBoardIds],
  );

  const buyBoardTheme = async (id: LudoThemeId) => {
    if (!me) {
      setErr("Đăng nhập để mua bàn cosmetic");
      return;
    }
    const meta = LUDO_THEMES.find((t) => t.id === id);
    if (!meta || meta.free) {
      setThemeId(id);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const token = getToken();
      const r = await fetch("/api/ludo/shop/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ itemId: meta.boardItemId, payWith: "gem" }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Mua bàn lỗi");
      const owned = Array.isArray(j.ownedIds) ? j.ownedIds.map(String) : [];
      const freeBoards = LUDO_THEMES.filter((t) => t.free).map(
        (t) => t.boardItemId,
      );
      setOwnedBoardIds([...new Set([...freeBoards, ...owned])]);
      if (typeof j.balance === "number") setShopBalance(j.balance);
      setThemeId(id);
      playSfx("ui");
      void refreshEquipSummary();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!room) void refreshEquipSummary();
  }, [room, refreshEquipSummary]);

  const pickBoardMode = (next: LudoBoardMode) => {
    writeLudoBoardMode(next);
    setBoardMode(next);
    setBoardPopupOpen(false);
    if (next === "3d" || next === "auto") prefetchLudo3D(next);
    playSfx("ui");
  };

  const openOrbitControls = () => {
    writeLudoViewModeOverride("orbit");
    setViewOverride("orbit");
    setViewPopupOpen(true);
    playSfx("ui");
  };

  useEffect(() => subscribeOrbitLock(setOrbitLock), []);

  const onOrbitLockChange = useCallback(
    (next: { locked: boolean; pose: typeof orbitLock.pose }) => {
      setOrbitLock(next);
    },
    [],
  );

  const boardModeLabel =
    boardMode === "lite" ? "2D" : boardMode === "3d" ? "3D" : "AUTO";

  useEffect(() => {
    if (!room) return;
    const prev = prevSnap.current;
    const nextTokens: Record<string, number> = {};
    let moved = false;
    let captured = false;
    let home = false;
    for (const t of room.tokens) {
      nextTokens[t.id] = t.pos;
      const p = prev.tokens[t.id];
      if (p === undefined) continue;
      if (p !== t.pos) {
        moved = true;
        if (t.pos === 105 || (t.pos >= 100 && t.pos <= 104 && p < 100)) {
          home = true;
        }
      }
      if (p >= 0 && p <= 51 && t.pos === -1) captured = true;
    }
    if (moved) playSfx("move");
    if (captured || /ăn|bắt|capture/i.test(room.lastEvent || "")) {
      playSfx("capture");
    }
    if (home || /về đích|home|105/i.test(room.lastEvent || "")) {
      playSfx("home");
    }
    if (
      room.status === "finished" &&
      prev.status !== "finished"
    ) {
      playSfx("win");
    }
    prevSnap.current = {
      tokens: nextTokens,
      dice: room.dice,
      lastEvent: room.lastEvent,
      status: room.status,
      tickedAt: prev.tickedAt,
    };
  }, [room, playSfx]);

  const activeTheme = room
    ? normalizeThemeId(room.themeId)
    : themeId;

  const mySeat = useMemo(() => {
    if (!room) return null;
    return (
      room.players.find(
        (p) =>
          (me && p.userId === me.id) ||
          (guestCode && p.guestId === guestCode),
      ) ?? null
    );
  }, [room, me, guestCode]);

  const isMyTurn =
    !!room &&
    !!mySeat &&
    !mySeat.isBot &&
    room.turnSeat === mySeat.seat &&
    room.status === "playing";

  const refresh = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/ludo/rooms/${id}`, { headers: headers() });
      const j = await r.json();
      if (r.status === 429) {
        return { throttled: true as const };
      }
      if (j.ok) setRoom(j.room);
      return { throttled: false as const };
    } catch {
      return { throttled: false as const };
    }
  }, []);

  useEffect(() => {
    if (!room?.roomId) return;
    let cancelled = false;
    let timer: number | undefined;
    let delay = 1800;
    const roomId = room.roomId;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        setNow(Date.now());
        timer = window.setTimeout(() => void tick(), Math.max(delay, 4000));
        return;
      }
      const out = await refresh(roomId);
      if (cancelled) return;
      setNow(Date.now());
      if (out.throttled) {
        delay = Math.min(8000, Math.round(delay * 1.6));
      } else {
        delay = 1800;
      }
      timer = window.setTimeout(() => void tick(), delay);
    };

    timer = window.setTimeout(() => void tick(), delay);
    const onVis = () => {
      if (!document.hidden && !cancelled) {
        delay = 1800;
        void refresh(roomId);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [room?.roomId, refresh]);

  const create = async (
    opts?: {
      overrideTheme?: LudoThemeId;
      fillBots?: boolean;
      autoStart?: boolean;
    },
  ) => {
    setBusy(true);
    setErr(null);
    try {
      const fillBots = opts?.fillBots !== false;
      const r = await fetch("/api/ludo/rooms", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          fillBots,
          autoStart: opts?.autoStart ?? fillBots,
          stake,
          themeId: opts?.overrideTheme ?? themeId,
          diceMode,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Tạo phòng lỗi");
      setRoom(j.room);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  const startLobby = async () => {
    if (!room) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/ludo/rooms/${room.roomId}/start`, {
        method: "POST",
        headers: headers(),
        body: "{}",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Bắt đầu lỗi");
      setRoom(j.room);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const id = joinCode.trim().toUpperCase();
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/ludo/rooms/${id}/join`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Vào phòng lỗi");
      setRoom(j.room);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  const roll = async () => {
    if (!room) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ludo/rooms/${room.roomId}/roll`, {
        method: "POST",
        headers: headers(),
        body: "{}",
      });
      const j = await r.json();
      if (!j.ok) setErr(j.reason || "Tung lỗi");
      else {
        setErr(null);
        setRoom(j.room);
        playSfx("roll");
      }
    } finally {
      setBusy(false);
    }
  };

  const pick = async (tokenId: string) => {
    if (!room) return;
    const dual =
      (room.diceMode ?? 1) === 2 && (room.pendingMoves?.length ?? 0) > 1;
    if (dual && selectedDieIndex == null) {
      setErr("Chọn xúc xắc trước");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/ludo/rooms/${room.roomId}/pick`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          tokenId,
          dieIndex: dual ? selectedDieIndex : null,
        }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.reason || "Chọn quân lỗi");
      else {
        setErr(null);
        setRoom(j.room);
        setSelectedDieIndex(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const leftSec = room
    ? Math.max(0, Math.ceil((room.turnDeadline - now) / 1000))
    : 0;

  const showHand =
    isMyTurn && room?.phase === "wait_roll" && room.status === "playing";

  const pendingMoves = room?.pendingMoves ?? [];
  const dualPick =
    (room?.diceMode ?? 1) === 2 &&
    room?.phase === "wait_pick" &&
    pendingMoves.length > 1;

  useEffect(() => {
    if (!room || room.phase !== "wait_pick") {
      setSelectedDieIndex(null);
      return;
    }
    const moves = room.pendingMoves ?? [];
    if (moves.length === 0) {
      setSelectedDieIndex(null);
      return;
    }
    if (moves.length === 1) {
      setSelectedDieIndex(moves[0]!.dieIndex);
      return;
    }
    setSelectedDieIndex((cur) =>
      cur != null && moves.some((m) => m.dieIndex === cur) ? cur : null,
    );
  }, [
    room?.phase,
    room?.rollSeq,
    room?.pendingDice?.join(","),
    room?.pendingMoves
      ?.map((m) => `${m.dieIndex}:${m.face}`)
      .join("|"),
  ]);

  const turnDice = useMemo(() => {
    if (!room || room.status !== "playing") return null;
    if (room.phase === "wait_pick" && pendingMoves.length) {
      return pendingMoves.map((m) => ({
        dieIndex: m.dieIndex,
        face: m.face,
      }));
    }
    return null;
  }, [room, pendingMoves]);

  const pickValidIds = useMemo(() => {
    if (!room || !isMyTurn || room.phase !== "wait_pick") return [];
    if ((room.diceMode ?? 1) === 2 && pendingMoves.length > 1) {
      if (selectedDieIndex == null) return [];
      const row = pendingMoves.find((m) => m.dieIndex === selectedDieIndex);
      return row?.tokenIds ?? [];
    }
    if (pendingMoves.length === 1) return pendingMoves[0]!.tokenIds;
    return room.validTokenIds;
  }, [room, isMyTurn, pendingMoves, selectedDieIndex]);

  useEffect(() => {
    if (!isMyTurn || !room || room.status !== "playing") return;
    if (leftSec > 5 || leftSec <= 0) return;
    const nowMs = Date.now();
    if (nowMs - prevSnap.current.tickedAt < 900) return;
    prevSnap.current.tickedAt = nowMs;
    playSfx("tick");
  }, [isMyTurn, leftSec, room, playSfx]);

  return (
    <AppShell maxWidth="md">
      <div className="ludo-page px-3 pb-8 pt-2">
        <GameChrome
          title="Ludo"
          active="ludo"
          user={me}
          guestCode={guestCode}
        />

        {!room ? (
          <div className="ludo-hub">
            <header className="ludo-hub__hero">
              <h2 className="ludo-hub__title">Vào bàn Ludo</h2>
              <p className="ludo-hub__lead">
                Chọn theme, 1 hoặc 2 xúc xắc, rồi chơi ngay.
              </p>
            </header>

            <section className="ludo-hub__play" aria-label="Bắt đầu">
              <button
                type="button"
                className="ludo-btn-block ludo-btn-block--primary ludo-btn-block--xl"
                disabled={busy}
                onClick={() => void create({ fillBots: true, autoStart: true })}
              >
                Chơi nhanh · 1 vs 3 bot
              </button>
              <div className="ludo-hub__play-row">
                <button
                  type="button"
                  className="ludo-btn-block"
                  disabled={busy}
                  onClick={() =>
                    void create({ fillBots: false, autoStart: false })
                  }
                >
                  Tạo phòng
                </button>
                <button
                  type="button"
                  className="ludo-btn-block ludo-btn-block--ghost"
                  onClick={() => setRulesPopupOpen(true)}
                >
                  Luật
                </button>
              </div>
              <div className="ludo-hub__join">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Mã phòng"
                  maxLength={8}
                  aria-label="Mã phòng"
                />
                <button
                  type="button"
                  className="ludo-btn-block ludo-btn-block--ghost"
                  disabled={busy}
                  onClick={() => void join()}
                >
                  Vào
                </button>
              </div>
              {err ? <p className="ludo-hub__err">{err}</p> : null}
            </section>

            <section className="ludo-hub-opt" aria-labelledby="ludo-opt-skin">
              <div className="ludo-hub-opt__head">
                <h3 id="ludo-opt-skin" className="ludo-hub-opt__title">
                  Skin bàn
                </h3>
                <span className="ludo-hub-opt__meta">
                  {LUDO_THEMES.find((t) => t.id === themeId)?.nameVi}
                  {shopBalance != null
                    ? ` · ${shopBalance.toLocaleString("vi-VN")} xu`
                    : ""}
                  {me?.gemBalance != null
                    ? ` · ${me.gemBalance.toLocaleString("vi-VN")} Gem`
                    : ""}
                </span>
              </div>
              <div
                className="ludo-theme-pills"
                role="radiogroup"
                aria-label="Theme"
              >
                {LUDO_THEMES.map((t) => {
                  const owned = ownsTheme(t.id);
                  const locked = !owned;
                  const myNoble = me ? nobilityTierOf(me) : 0;
                  const need = Math.max(0, Math.floor(t.minNobility ?? 0));
                  const lockedNoble = locked && need > 0 && myNoble < need;
                  const disc =
                    t.priceGem > 0
                      ? discountedGemPrice(t.priceGem, myNoble)
                      : null;
                  const priceLabel =
                    disc && disc.discountPct > 0
                      ? `${disc.amount} 💎 (−${disc.discountPct}%)`
                      : `${t.priceGem} 💎`;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={themeId === t.id}
                      aria-label={
                        locked
                          ? lockedNoble
                            ? `${t.nameVi} · cần ${nobilityLabel(need)}`
                            : `${t.nameVi} · ${t.priceGem} Gem`
                          : t.nameVi
                      }
                      className={`ludo-theme-pill ${
                        themeId === t.id ? "is-on" : ""
                      } ${locked ? "is-locked" : ""}`}
                      disabled={busy || lockedNoble}
                      onClick={() => {
                        if (owned) {
                          setThemeId(t.id);
                          playSfx("ui");
                          return;
                        }
                        if (lockedNoble) return;
                        void buyBoardTheme(t.id);
                      }}
                    >
                      <span
                        className="ludo-theme-pill__swatch"
                        style={{ background: t.swatch }}
                      />
                      <span className="ludo-theme-pill__name">{t.nameVi}</span>
                      {locked ? (
                        <span className="ludo-theme-pill__price">
                          {lockedNoble
                            ? `🔒 ${nobilityLabel(need)}`
                            : priceLabel}
                        </span>
                      ) : t.free ? (
                        <span className="ludo-theme-pill__price is-free">
                          Free
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="ludo-hub-opt__hint text-[11px] text-[var(--play-muted)]">
                3 bàn free · Vườn / Neon / Băng mua bằng xu (cần đăng nhập).
              </p>
              <div
                className="ludo-theme-live"
                aria-label="Màu ghế theo skin"
              >
                {(
                  [
                    ["red", "Đỏ"],
                    ["green", "Lá"],
                    ["yellow", "Vàng"],
                    ["blue", "Xanh"],
                  ] as const
                ).map(([key, label]) => (
                  <span key={key} className="ludo-theme-live__chip">
                    <i
                      style={{
                        background: themeSeatColors(themeId)[key],
                      }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            </section>

            <section className="ludo-hub-opt" aria-labelledby="ludo-opt-board">
              <div className="ludo-hub-opt__head">
                <h3 id="ludo-opt-board" className="ludo-hub-opt__title">
                  Chế độ bàn
                </h3>
                <span className="ludo-hub-opt__meta" aria-live="polite">
                  {boardMode === "auto"
                    ? `Auto · ${usingLite ? "2D" : "3D"}`
                    : boardMode === "lite"
                      ? "Cố định 2D"
                      : "Cố định 3D"}
                </span>
              </div>
              <p className="ludo-hub-opt__lead">
                Mỗi chế độ hiển thị khác nhau — cùng luật chơi, khác đồ họa &amp;
                hiệu ứng.
              </p>
              <div
                className="ludo-mode-cards"
                role="radiogroup"
                aria-label="Chế độ bàn"
              >
                {(
                  [
                    {
                      id: "auto" as const,
                      badge: "AUTO",
                      title: "Tự động",
                      fx: "Máy yếu → 2D phẳng · máy mạnh → 3D đổ bóng",
                      detail: "Đổi theo thiết bị / Save-Data, không cần chỉnh tay.",
                    },
                    {
                      id: "lite" as const,
                      badge: "2D",
                      title: "Bàn phẳng",
                      fx: "CSS top-down · quân oval · hop nhẹ · ít tải",
                      detail: "Nhìn rõ ô & quân trên mọi điện thoại.",
                    },
                    {
                      id: "3d" as const,
                      badge: "3D",
                      title: "Bàn không gian",
                      fx: "WebGL · quân cao · bóng · xoay / cinema",
                      detail: "Đẹp hơn, tải thêm ~1MB — máy yếu có thể lag.",
                    },
                  ] as const
                ).map((opt) => {
                  const on = boardMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`ludo-mode-card ludo-mode-card--${opt.id} ${on ? "is-on" : ""}`}
                      onClick={() => pickBoardMode(opt.id)}
                    >
                      <span className="ludo-mode-card__viz" aria-hidden>
                        <span className="ludo-mode-card__viz-a" />
                        <span className="ludo-mode-card__viz-b" />
                        <span className="ludo-mode-card__viz-c" />
                      </span>
                      <span className="ludo-mode-card__body">
                        <span className="ludo-mode-card__row">
                          <span className="ludo-mode-card__badge">{opt.badge}</span>
                          <span className="ludo-mode-card__title">{opt.title}</span>
                          {on ? (
                            <span className="ludo-mode-card__on">Đang chọn</span>
                          ) : null}
                        </span>
                        <span className="ludo-mode-card__fx">{opt.fx}</span>
                        <span className="ludo-mode-card__detail">{opt.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="ludo-hub-opt" aria-labelledby="ludo-opt-pawn">
              <div className="ludo-hub-opt__head">
                <h3 id="ludo-opt-pawn" className="ludo-hub-opt__title">
                  Quân &amp; khung
                </h3>
              </div>
              <div className="ludo-hub-equip">
                <div className="ludo-hub-equip__preview">
                  <span
                    className={`ludo-hub-equip__pawn ${pawnDecorClass(equipSummary?.pawnId)}`}
                    style={{
                      background: `radial-gradient(circle at 35% 30%, #fff8, transparent 50%), ${themeSeatColors(themeId).red}`,
                    }}
                    aria-hidden
                  >
                    {pawnDecorGlyph(equipSummary?.pawnId) || ""}
                  </span>
                  <div className="ludo-hub-equip__meta">
                    <p className="ludo-hub-equip__line">
                      Quân{" "}
                      <strong>
                        {me
                          ? equipSummary?.pawn || "Đang tải…"
                          : "Cần đăng nhập"}
                      </strong>
                    </p>
                    <p className="ludo-hub-equip__line">
                      Khung{" "}
                      <strong>
                        {me ? equipSummary?.frame || "Đang tải…" : "—"}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ludo-btn-block ludo-btn-block--compact"
                    onClick={() => {
                      setCosmeticsOpen(true);
                      playSfx("ui");
                    }}
                  >
                    Đổi
                  </button>
                </div>
              </div>
            </section>

            <section className="ludo-hub-opt" aria-labelledby="ludo-opt-dice">
              <div className="ludo-hub-opt__head">
                <h3 id="ludo-opt-dice" className="ludo-hub-opt__title">
                  Xúc xắc
                </h3>
                <span className="ludo-hub-opt__meta">
                  {diceMode === 2 ? "Đi lần lượt 2 mặt" : "Cổ điển"}
                </span>
              </div>
              <div
                className="ludo-seg ludo-seg--2"
                role="radiogroup"
                aria-label="Số xúc xắc"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={diceMode === 1}
                  className={`ludo-seg__btn ${diceMode === 1 ? "is-on" : ""}`}
                  onClick={() => {
                    setDiceMode(1);
                    playSfx("ui");
                  }}
                >
                  1 xúc
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={diceMode === 2}
                  className={`ludo-seg__btn ${diceMode === 2 ? "is-on" : ""}`}
                  onClick={() => {
                    setDiceMode(2);
                    playSfx("ui");
                  }}
                >
                  2 xúc
                </button>
              </div>
            </section>

            <section className="ludo-hub-opt" aria-labelledby="ludo-opt-stake">
              <div className="ludo-hub-opt__head">
                <h3 id="ludo-opt-stake" className="ludo-hub-opt__title">
                  Mức xu
                </h3>
                <span className="ludo-hub-opt__meta">Tuỳ chọn</span>
              </div>
              <div className="ludo-stake-row" role="radiogroup" aria-label="Mức xu">
                {stakePresets.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={stake === s}
                    className={`ludo-stake-chip ${stake === s ? "is-on" : ""}`}
                    onClick={() => {
                      setStake(s);
                      playSfx("ui");
                    }}
                  >
                    {s === 0 ? "Free" : s.toLocaleString("vi-VN")}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            <LudoBoard
              tokens={room.tokens}
              validTokenIds={pickValidIds}
              onPick={(id) => {
                playSfx("ui");
                void pick(id);
              }}
              myColor={mySeat?.color}
              themeId={activeTheme}
              cosmetics={cosmetics}
              boardMode={boardMode}
              viewMode={viewMode}
              players={room.players}
              mySeat={mySeat?.seat}
              turnSeat={room.turnSeat}
              dice={diceThrowFaces[0] ?? room.dice}
              diceFaces={
                diceThrowFaces.length
                  ? diceThrowFaces
                  : room.diceFaces?.length
                    ? room.diceFaces
                    : room.lastDiceFaces?.length
                      ? room.lastDiceFaces
                      : undefined
              }
              diceThrowKey={diceThrowKey}
              diceThrowColor={diceThrowColor}
              turnDice={turnDice}
              selectedDieIndex={selectedDieIndex}
              diceSelectable={
                isMyTurn && dualPick && room.status === "playing"
              }
              onSelectDie={(ix) => {
                setSelectedDieIndex(ix);
                playSfx("ui");
              }}
              onSelectPlayer={
                me
                  ? (p: LudoCornerPlayer) => {
                      if (!p.userId || p.isBot) return;
                      setGiftPreset({
                        userId: p.userId,
                        name: p.displayName,
                      });
                      setGiftOpen(true);
                      playSfx("ui");
                    }
                  : undefined
              }
            />
            <div className="ludo-panel">
              <div className="ludo-panel__status">
                <div className="ludo-panel__status-main">
                  <p className="ludo-panel__room">
                    <span>{room.roomId}</span>
                    {LUDO_THEMES.find((t) => t.id === activeTheme)?.nameVi ? (
                      <span>
                        {LUDO_THEMES.find((t) => t.id === activeTheme)?.nameVi}
                      </span>
                    ) : null}
                    {room.stake ? (
                      <span>
                        Mức {room.stake.toLocaleString("vi-VN")} xu
                      </span>
                    ) : null}
                    {room.pot ? (
                      <span>Hũ {room.pot.toLocaleString("vi-VN")}</span>
                    ) : null}
                  </p>
                  <p className="ludo-panel__turn">
                    {room.status === "lobby"
                      ? "Phòng chờ — chia sẻ mã phòng"
                      : room.status === "finished"
                        ? `Kết thúc · ghế ${room.winnerSeat}`
                        : isMyTurn && dualPick && selectedDieIndex == null
                          ? `Chọn xúc xắc · ${leftSec}s`
                          : isMyTurn &&
                              dualPick &&
                              selectedDieIndex != null
                            ? `Chọn quân · ${leftSec}s`
                            : isMyTurn
                              ? `Lượt của bạn · ${leftSec}s`
                              : `Lượt ghế ${room.turnSeat} · ${leftSec}s`}
                  </p>
                </div>
                {room.status === "playing" && room.phase === "wait_roll" ? (
                  <div className="ludo-dice-wrap">
                    <button
                      type="button"
                      className={`ludo-dice ${showHand ? "is-ready" : ""} ${
                        cosmetics.diceUrl ? "has-art" : ""
                      }`}
                      style={
                        cosmetics.diceUrl
                          ? {
                              backgroundImage: `url(${cosmetics.diceUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                      disabled={busy || !isMyTurn}
                      onClick={() => void roll()}
                      title="Tung xúc xắc"
                      aria-label="Tung xúc xắc"
                    >
                      ?
                    </button>
                    {showHand ? (
                      <span className="ludo-hand" aria-hidden />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="ludo-toolbar" role="toolbar" aria-label="Tuỳ chọn bàn">
                <button
                  type="button"
                  className={`ludo-tool ${!usingLite ? "is-on" : ""}`}
                  onClick={() => setBoardPopupOpen(true)}
                  title="Chọn bàn 2D / 3D / Auto"
                >
                  {boardModeLabel}
                </button>
                {!usingLite ? (
                  <button
                    type="button"
                    className={`ludo-tool ${
                      viewPopupOpen || orbitLock.locked ? "is-on" : ""
                    }`}
                    onClick={openOrbitControls}
                    title="Điều hướng góc nhìn 3D"
                  >
                    XOAY
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ludo-tool"
                  onClick={() => setCosmeticsOpen(true)}
                  title="Quân / Cosmetics"
                >
                  Quân
                </button>
                <button
                  type="button"
                  className="ludo-tool"
                  onClick={() => setRulesPopupOpen(true)}
                  title="Luật chơi Ludo"
                >
                  Luật
                </button>
                <button
                  type="button"
                  className="ludo-tool"
                  onClick={() => toggleMute()}
                  title={sfxMuted ? "Bật âm" : "Tắt âm"}
                >
                  {sfxMuted ? "Tắt âm" : "Âm"}
                </button>
              </div>

              {room.status === "lobby" ? (
                <div className="ludo-hub__actions">
                  <button
                    type="button"
                    className="ludo-btn-block ludo-btn-block--primary"
                    disabled={busy}
                    onClick={() => void startLobby()}
                  >
                    Bắt đầu ván
                  </button>
                </div>
              ) : null}

              <div className="ludo-seats">
                {room.players.map((p) => (
                  <div
                    key={p.seat}
                    className={`ludo-seat ludo-seat--${p.color} ${
                      room.turnSeat === p.seat ? "is-turn" : ""
                    } ${mySeat?.seat === p.seat ? "is-me" : ""}`}
                  >
                    <span className="ludo-seat__dot" aria-hidden />
                    <div className="ludo-seat__body">
                      <span className="ludo-seat__name">
                        {p.displayName}
                        {mySeat?.seat === p.seat ? " (bạn)" : ""}
                      </span>
                      <span className="ludo-seat__tags">
                        {p.isBot ? (
                          <span className="ludo-seat__tag">bot</span>
                        ) : null}
                        {room.turnSeat === p.seat ? (
                          <span className="ludo-seat__tag ludo-seat__tag--turn">
                            lượt
                          </span>
                        ) : null}
                        {p.strikes ? (
                          <span className="ludo-seat__tag">⚠{p.strikes}</span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="ludo-msg" role="status">
                {room.lastEvent || "Chờ lượt…"}
              </p>
              {err ? <p className="ludo-hub__err">{err}</p> : null}

              <div className="ludo-panel__footer">
                <button
                  type="button"
                  className="ludo-btn-block ludo-btn-block--ghost"
                  onClick={() => setRoom(null)}
                >
                  Rời bàn
                </button>
                <button
                  type="button"
                  className="ludo-btn-block"
                  onClick={() =>
                    void create({
                      overrideTheme: activeTheme,
                      fillBots: true,
                      autoStart: true,
                    })
                  }
                  disabled={busy}
                >
                  Ván mới
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <LudoPawnCosmeticsSheet
        open={cosmeticsOpen}
        onClose={() => setCosmeticsOpen(false)}
        usingLite={usingLite}
        roomId={room?.roomId}
        loggedIn={!!me}
        themeId={activeTheme}
        onBoardEquipped={(id) => {
          setThemeId(id);
          void refreshEquipSummary();
        }}
        onApplied={(nextRoom) => {
          if (nextRoom && typeof nextRoom === "object" && "roomId" in nextRoom) {
            setRoom(nextRoom as LudoRoom);
          }
          void refreshEquipSummary();
        }}
      />

      <BottomSheet
        open={boardPopupOpen}
        title="Chọn bàn cờ"
        onClose={() => setBoardPopupOpen(false)}
        heightClass="max-h-[60vh]"
        shellClass="sheet-shell-light"
        backdropClass="bg-black/40"
      >
        <div className="ludo-view-popup space-y-2 px-1 pb-2">
          <p className="text-[11px] text-[var(--play-muted)]">
            Chọn cách bàn được vẽ. Luật giống nhau — khác hiệu ứng &amp; tải.
          </p>
          {(
            [
              {
                id: "auto" as const,
                badge: "AUTO",
                title: "Tự động",
                hint: "FX: máy yếu → bàn 2D phẳng · máy mạnh → 3D đổ bóng / xoay",
              },
              {
                id: "lite" as const,
                badge: "2D",
                title: "Bàn phẳng (CSS)",
                hint: "FX: top-down · quân oval to · hop nhẹ · mượt, ít tốn pin",
              },
              {
                id: "3d" as const,
                badge: "3D",
                title: "Bàn không gian (WebGL)",
                hint: "FX: quân cao · bóng · atmosphere theme · xoay/cinema (~1MB)",
              },
            ] as const
          ).map((opt) => {
            const on = boardMode === opt.id;
            const activeNow =
              (opt.id === "lite" && usingLite) ||
              (opt.id === "3d" && !usingLite) ||
              (opt.id === "auto" && boardMode === "auto");
            return (
              <button
                key={opt.id}
                type="button"
                className={`ludo-view-opt ludo-view-opt--${opt.id} ${on ? "is-on" : ""}`}
                onClick={() => pickBoardMode(opt.id)}
              >
                <span className="ludo-view-opt__row">
                  <span className="ludo-view-opt__badge">{opt.badge}</span>
                  <span className="ludo-view-opt__title">{opt.title}</span>
                  <span className="ludo-view-opt__lock">
                    {on ? "Đang chọn" : activeNow && opt.id !== "auto" ? "Đang hiện" : ""}
                  </span>
                </span>
                <span className="ludo-view-opt__hint">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        open={viewPopupOpen && !usingLite}
        title="Điều hướng góc nhìn"
        onClose={() => setViewPopupOpen(false)}
        heightClass="max-h-[48vh]"
        shellClass="sheet-shell-light"
        backdropClass="bg-black/40"
      >
        <div className="ludo-view-popup space-y-2 px-1 pb-3">
          <p className="text-[11px] text-[var(--play-muted)]">
            Giữ ▲▼◀▶ để xoay · ◎ khóa góc · +/− zoom. Kéo tay trên bàn khi chưa
            khóa.
            {orbitLock.locked ? " · Đang khóa góc." : ""}
          </p>
          <div className="ludo-orbit-nav-wrap flex justify-center pt-1">
            <LudoOrbitNavPad
              locked={orbitLock.locked}
              onLockChange={onOrbitLockChange}
              variant="sheet"
            />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={rulesPopupOpen}
        title="Luật Ludo · chơi công bằng"
        onClose={() => setRulesPopupOpen(false)}
        heightClass="max-h-[70vh]"
        shellClass="sheet-shell-light"
        backdropClass="bg-black/40"
      >
        <div className="ludo-rules-popup space-y-3 px-1 pb-3 text-[12px] leading-relaxed text-[var(--play-ink)]">
          <p>
            <strong>Demo giáo dục SOFIAORE</strong> — xúc xắc và nước đi do
            server xác nhận. Client chỉ gửi roll/pick; không tự ý sửa vị trí quân.
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Ra chuồng cần xúc xắc 6 (theo rule bàn).</li>
            <li>
              Chế độ 2 xúc: tung 2 mặt — chọn từng nút xúc ở góc avatar, rồi
              chọn quân đi với mặt đó (không cộng số).
            </li>
            <li>Ăn quân đối thủ về chuồng khi đáp đúng ô (trừ ô an toàn).</li>
            <li>Về đích phải xúc xắc đúng số bước còn lại (không overshoot).</li>
            <li>Mức xu (0/500/1000/5000): trừ khi bắt đầu; thắng nhận hũ (1v3 bot ×2).</li>
            <li>Hết giờ lượt → bot / skip theo engine — không spam API.</li>
          </ul>
          <p className="text-[11px] text-[var(--play-muted)]">
            <strong>Chống gian lận / hacking:</strong> mọi nước đi kiểm tra lại
            trên server (<code>ludoEngine</code>). Sửa DOM / packet giả sẽ bị
            từ chối. Rate-limit + auth/guest áp dụng như các lane khác. Không
            quét, không brute-force API của site này — đó là web vận hành của
            chủ sở hữu; xâm nhập trái phép là vi phạm pháp luật.
          </p>
          <p className="text-[11px] text-[var(--play-muted)]">
            Luật điều chỉnh demo: xem trang Legal / Compliance trên site. Đây
            không phải tư vấn pháp lý.
          </p>
        </div>
      </BottomSheet>
      <GiftHubSheet
        open={giftOpen}
        balance={me?.balances?.social ?? shopBalance ?? me?.balance}
        busy={giftBusy}
        preset={giftPreset}
        onClose={() => {
          setGiftOpen(false);
          setGiftPreset(null);
        }}
        onSend={async (opts) => {
          setGiftBusy(true);
          const r = await sendGiftFromCatalog(opts);
          setGiftBusy(false);
          if (!r.ok) {
            setErr(r.reason);
            return;
          }
          const token = getToken();
          if (token) saveSession(token, r.from);
          setGiftOpen(false);
          setGiftPreset(null);
        }}
      />
      <VirtualPlayFooter className="mt-3 px-3 pb-3" />
    </AppShell>
  );
}
