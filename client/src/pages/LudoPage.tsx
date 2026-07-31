import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStoredUser, getToken } from "../auth";
import { AppShell } from "../components/AppShell";
import { GameChrome } from "../components/GameChrome";
import { ensureGuestCode, getGuestCode } from "../guest";
import { useApplyPlayMediaPresets } from "../hooks/useApplyPlayMediaPresets";
import { useLudoCosmetics } from "../hooks/useLudoCosmetics";
import { useSfx } from "../hooks/useSfx";
import { LudoBoard } from "../platform/ludo/LudoBoard";
import { prefetchLudo3D } from "../platform/ludo/preferLiteBoard";
import {
  LUDO_THEMES,
  normalizeThemeId,
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
  validTokenIds: string[];
  consecutiveSixes: number;
  turnDeadline: number;
  winnerSeat: number | null;
  lastEvent: string | null;
  stake: number;
  themeId?: LudoThemeId;
};

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
  const prevSnap = useRef<{
    tokens: Record<string, number>;
    dice: number | null;
    lastEvent: string | null;
    status: string | null;
    tickedAt: number;
  }>({ tokens: {}, dice: null, lastEvent: null, status: null, tickedAt: 0 });

  useEffect(() => {
    prefetchLudo3D();
  }, []);

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
    const r = await fetch(`/api/ludo/rooms/${id}`, { headers: headers() });
    const j = await r.json();
    if (j.ok) setRoom(j.room);
  }, []);

  useEffect(() => {
    if (!room?.roomId) return;
    const t = window.setInterval(() => {
      void refresh(room.roomId);
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(t);
  }, [room?.roomId, refresh]);

  const create = async (overrideTheme?: LudoThemeId) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/ludo/rooms", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          fillBots: true,
          stake: 0,
          themeId: overrideTheme ?? themeId,
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
    setBusy(true);
    try {
      const r = await fetch(`/api/ludo/rooms/${room.roomId}/pick`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ tokenId }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.reason || "Chọn quân lỗi");
      else {
        setErr(null);
        setRoom(j.room);
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
      <div className="ludo-page px-3 pb-8 pt-2" data-theme={activeTheme}>
        <GameChrome
          title="Ludo"
          active="ludo"
          user={me}
          guestCode={guestCode}
        />

        {!room ? (
          <div className="ludo-hub app-panel p-3">
            <p className="play-heading text-sm">Chọn loại bàn</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              3 skin · bàn 3D — logic quân cờ không đổi.
            </p>
            <div className="ludo-theme-grid" role="radiogroup" aria-label="Theme">
              {LUDO_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={themeId === t.id}
                  className={`ludo-theme-card ${themeId === t.id ? "is-on" : ""}`}
                  onClick={() => setThemeId(t.id)}
                >
                  <span
                    className="ludo-theme-card__swatch"
                    style={{ background: t.swatch }}
                  />
                  <span className="ludo-theme-card__name">{t.nameVi}</span>
                  <span className="ludo-theme-card__blurb">{t.blurb}</span>
                </button>
              ))}
            </div>
            <div className="ludo-hub__actions">
              <button
                type="button"
                className="ludo-btn-block ludo-btn-block--primary"
                disabled={busy}
                onClick={() => void create()}
              >
                Chơi nhanh 1v3 bot
              </button>
            </div>
            <div className="ludo-hub__actions">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Mã phòng"
                maxLength={8}
              />
              <button
                type="button"
                className="ludo-btn-block ludo-btn-block--ghost"
                disabled={busy}
                onClick={() => void join()}
              >
                Vào phòng
              </button>
            </div>
            {err ? <p className="text-xs text-red-600">{err}</p> : null}
          </div>
        ) : (
          <>
            <LudoBoard
              tokens={room.tokens}
              validTokenIds={
                isMyTurn && room.phase === "wait_pick"
                  ? room.validTokenIds
                  : []
              }
              onPick={(id) => {
                playSfx("ui");
                void pick(id);
              }}
              myColor={mySeat?.color}
              themeId={activeTheme}
              cosmetics={cosmetics}
            />
            <div className="ludo-panel">
              <div className="ludo-panel__row">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                    Phòng {room.roomId} ·{" "}
                    {LUDO_THEMES.find((t) => t.id === activeTheme)?.nameVi}
                  </p>
                  <p className="text-xs font-semibold">
                    {room.status === "finished"
                      ? `Kết thúc · ghế ${room.winnerSeat}`
                      : `Lượt ghế ${room.turnSeat} · ${leftSec}s`}
                  </p>
                </div>
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
                    disabled={
                      busy ||
                      !isMyTurn ||
                      room.phase !== "wait_roll" ||
                      room.status !== "playing"
                    }
                    onClick={() => void roll()}
                    title="Tung xúc xắc"
                  >
                    {room.dice ?? "?"}
                  </button>
                  <button
                    type="button"
                    className="ludo-mute"
                    onClick={() => toggleMute()}
                    title={sfxMuted ? "Bật âm" : "Tắt âm"}
                  >
                    {sfxMuted ? "🔇" : "🔊"}
                  </button>
                  {showHand ? (
                    <span className="ludo-hand" aria-hidden />
                  ) : null}
                </div>
              </div>
              <div className="ludo-seats">
                {room.players.map((p) => (
                  <div
                    key={p.seat}
                    className={`ludo-seat ludo-seat--${p.color} ${
                      room.turnSeat === p.seat ? "is-turn" : ""
                    }`}
                  >
                    {p.displayName}
                    {p.isBot ? " · bot" : ""}
                    {p.strikes ? ` · ⚠${p.strikes}` : ""}
                  </div>
                ))}
              </div>
              <p className="ludo-msg">{room.lastEvent || "—"}</p>
              {err ? <p className="text-xs text-red-600">{err}</p> : null}
              <div className="ludo-hub__actions">
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
                  onClick={() => void create(activeTheme)}
                  disabled={busy}
                >
                  Ván mới
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
