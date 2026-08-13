import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredUser, getToken, saveSession } from "../auth";
import { AppShell } from "../components/AppShell";
import { BottomSheet } from "../components/BottomSheet";
import { GamePlayShell } from "../components/GamePlayShell";
import { GameMark } from "../components/GameMark";
import {
  GiftHubSheet,
  type GiftHubTarget,
} from "../components/GiftHubSheet";
import { ensureGuestCode, getGuestCode, guestGamePath } from "../guest";
import { useApplyPlayMediaPresets } from "../hooks/useApplyPlayMediaPresets";
import { useSfx } from "../hooks/useSfx";
import { sendGiftFromCatalog } from "../socialGift";
import {
  fetchPlatformGames,
  gamePath,
  getCachedPlatformGames,
  isGameOpen,
  LOBBY_PICK_TITLE,
  LOBBY_SWITCH_TITLE,
  type GameManifest,
} from "../platform/games";
import { gameTone } from "../platform/gameTones";
import { OanQuanBoard } from "../platform/oan-quan/OanQuanBoard";
import { ScoreTreasure } from "../platform/oan-quan/OanPieces";
import type { OanRoom } from "../platform/oan-quan/types";
import "../platform/oan-quan/oanQuan.css";

const STAKE_PRESETS = [0, 500, 1000, 5000] as const;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  else h["x-guest-id"] = ensureGuestCode();
  return h;
}

export default function OanQuanPage() {
  useApplyPlayMediaPresets("oan-quan");
  const { play: playSfx, muted: sfxMuted, toggleMute } = useSfx("tarot", "oan-quan");
  const me = getStoredUser();
  const guestCode = !me ? getGuestCode() || ensureGuestCode() : null;

  const [room, setRoom] = useState<OanRoom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"bot" | "pvp">("bot");
  const [stake, setStake] = useState(0);
  const [stakePresets, setStakePresets] = useState<number[]>([...STAKE_PRESETS]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftPreset, setGiftPreset] = useState<GiftHubTarget | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [navOpen, setNavOpen] = useState(false);
  const [games, setGames] = useState<GameManifest[]>(() => getCachedPlatformGames());
  const moveSeqRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void fetch("/api/oan-quan/rooms")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.stakePresets) && j.stakePresets.length) {
          setStakePresets(
            j.stakePresets
              .map((n: unknown) => Math.floor(Number(n)))
              .filter((n: number) => Number.isFinite(n) && n >= 0),
          );
        }
      })
      .catch(() => {});

    void fetchPlatformGames().then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    if (!room?.roomId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const r = await fetch(`/api/oan-quan/rooms/${room.roomId}`, {
          headers: headers(),
        });
        if (r.status === 429) {
          if (!cancelled) timer = setTimeout(poll, 4000);
          return;
        }
        const j = await r.json();
        if (!cancelled && j.ok && j.room) {
          setRoom(j.room as OanRoom);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        const hidden =
          typeof document !== "undefined" && document.hidden;
        timer = setTimeout(poll, hidden ? 4000 : 1800);
      }
    };

    timer = setTimeout(poll, 1800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [room?.roomId]);

  useEffect(() => {
    if (!room) return;
    if (room.moveSeq > moveSeqRef.current) {
      moveSeqRef.current = room.moveSeq;
      const cap = room.lastSteps?.some((s) => s.kind === "capture");
      try {
        playSfx(cap ? "capture" : "move");
      } catch {
        /* silent if missing */
      }
    }
  }, [room, playSfx]);

  const mySeat = useMemo(() => {
    if (!room) return null;
    return (
      room.seats.find(
        (s) =>
          (me && s.userId === me.id) ||
          (guestCode && s.guestId === guestCode),
      ) ?? null
    );
  }, [room, me, guestCode]);

  const isMyTurn =
    !!room &&
    room.status === "playing" &&
    mySeat != null &&
    room.turnSeat === mySeat.seat &&
    !mySeat.isBot;

  const turnLeft =
    room && room.status === "playing"
      ? Math.max(0, Math.ceil((room.turnDeadline - now) / 1000))
      : 0;

  async function createRoom() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/oan-quan/rooms", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          mode: mode === "pvp" ? "pvp" : "bot",
          vsBot: mode === "bot",
          stake: me ? stake : 0,
          autoStart: mode === "bot",
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không tạo được phòng");
        return;
      }
      moveSeqRef.current = 0;
      setRoom(j.room as OanRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setErr("Nhập mã phòng");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/oan-quan/rooms/${code}/join`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không vào được phòng");
        return;
      }
      moveSeqRef.current = 0;
      setRoom(j.room as OanRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function startRoom() {
    if (!room) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/oan-quan/rooms/${room.roomId}/start`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không bắt đầu được");
        return;
      }
      setRoom(j.room as OanRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function sow(pitIndex: number) {
    if (!room || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/oan-quan/rooms/${room.roomId}/sow`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ pitIndex }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Nước đi không hợp lệ");
        return;
      }
      setRoom(j.room as OanRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  const isHost =
    !!room &&
    ((me && room.hostUserId === me.id) ||
      (guestCode && room.hostGuestId === guestCode) ||
      (mySeat && mySeat.seat === 0));

  return (
    <AppShell maxWidth="md">
      <div className="oan-page">
        <GamePlayShell
          title="Ô ăn quan"
          active="oan-quan"
          user={me}
          guestCode={guestCode}
          showNav={false}
          tools={
            <div className="oan-top-tools">
              <button
                type="button"
                className="oan-btn secondary"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                onClick={() => setNavOpen(true)}
              >
                {LOBBY_SWITCH_TITLE}
              </button>
              <button
                type="button"
                className="oan-btn secondary"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                onClick={() => toggleMute()}
              >
                {sfxMuted ? "Bật âm" : "Tắt âm"}
              </button>
            </div>
          }
        >
        <BottomSheet
          open={navOpen}
          title={LOBBY_PICK_TITLE}
          subtitle="Danh sách trò chơi"
          onClose={() => setNavOpen(false)}
          shellClass="sheet-shell-light"
        >
          <div className="oan-game-list">
            {games.filter(isGameOpen).map((g) => {
              const tone = gameTone(g.id);
              const href = me
                ? gamePath(me, g)
                : guestGamePath(guestCode || ensureGuestCode(), g.pathSuffix);
              return (
                <Link
                  key={g.id}
                  to={href}
                  className={`oan-game-list__item ${g.id === "oan-quan" ? "is-on" : ""}`}
                  style={{
                    ["--game-accent" as string]: tone.accent,
                    ["--game-soft" as string]: tone.soft,
                    ["--game-ink" as string]: tone.ink,
                  }}
                  onClick={() => setNavOpen(false)}
                >
                  <span className="oan-game-list__mark">
                    <GameMark gameId={g.id} />
                  </span>
                  <span className="oan-game-list__meta">
                    <span className="oan-game-list__name">{g.nameVi}</span>
                    <span className="oan-game-list__blurb">{g.blurb}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </BottomSheet>

        {!room ? (
          <div className="oan-hub">
            <h1>Ô ăn quan</h1>
            <p className="oan-blurb">
              Luật cổ điển — rải dân ngược chiều kim đồng hồ, ăn quan = 10 điểm.
            </p>

            <div className="oan-mode-row">
              <button
                type="button"
                className={mode === "bot" ? "active" : ""}
                onClick={() => setMode("bot")}
              >
                Vs Bot
              </button>
              <button
                type="button"
                className={mode === "pvp" ? "active" : ""}
                onClick={() => setMode("pvp")}
              >
                PvP 2 người
              </button>
            </div>

            {me ? (
              <div className="oan-field">
                <label>Mức xu chơi</label>
                <div className="oan-stake-row">
                  {stakePresets.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={stake === s ? "active" : ""}
                      onClick={() => setStake(s)}
                    >
                      {s === 0 ? "Free" : s.toLocaleString("vi-VN")}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="oan-blurb">Khách chơi free — đăng nhập để dùng xu chơi.</p>
            )}

            {err ? <p className="oan-err">{err}</p> : null}

            <div className="oan-actions">
              <button type="button" disabled={busy} onClick={() => void createRoom()}>
                {mode === "bot" ? "Chơi với bot" : "Tạo phòng PvP"}
              </button>
            </div>

            <div className="oan-field" style={{ marginTop: "1.25rem" }}>
              <label>Vào phòng (mã)</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="VD: A1B2C3"
                maxLength={8}
              />
            </div>
            <div className="oan-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void joinRoom()}
              >
                Join phòng
              </button>
            </div>
          </div>
        ) : (
          <div className="oan-room oan-arena">
            <div className="oan-meta">
              <span>
                Phòng <strong>{room.roomId}</strong>
                {room.stake > 0 ? ` · mức ${room.stake} xu` : " · free"}
                {room.vsBot ? " · vs bot" : " · PvP"}
              </span>
              <span className="oan-meta__timer">
                {room.status === "playing" ? `${turnLeft}s` : "—"}
              </span>
              <button
                type="button"
                className="oan-btn secondary"
                style={{ padding: "0.3rem 0.55rem", fontSize: "0.75rem" }}
                onClick={() => {
                  setRoom(null);
                  setErr(null);
                }}
              >
                Rời phòng
              </button>
            </div>

            <div className="oan-scores">
              {room.seats.map((s) => (
                <div
                  key={s.seat}
                  className={`oan-score-card ${
                    room.turnSeat === s.seat && room.status === "playing"
                      ? "turn"
                      : ""
                  } ${
                    me && s.userId && !s.isBot && mySeat?.seat !== s.seat
                      ? "oan-score-card--giftable"
                      : ""
                  }`}
                  data-social-user={s.userId || undefined}
                  data-social-name={s.displayName}
                  data-social-seat={s.seat}
                  role={
                    me && s.userId && !s.isBot && mySeat?.seat !== s.seat
                      ? "button"
                      : undefined
                  }
                  onClick={() => {
                    if (!me || !s.userId || s.isBot || mySeat?.seat === s.seat)
                      return;
                    setGiftPreset({
                      userId: s.userId,
                      name: s.displayName,
                    });
                    setGiftOpen(true);
                    playSfx("ui");
                  }}
                  title={
                    me && s.userId && !s.isBot && mySeat?.seat !== s.seat
                      ? `Tặng quà · ${s.displayName}`
                      : undefined
                  }
                >
                  <div className="name">
                    {s.displayName}
                    {s.isBot ? " (bot)" : ""}
                    {mySeat?.seat === s.seat ? " · bạn" : ""}
                  </div>
                  <ScoreTreasure
                    score={room.scores[s.seat] ?? 0}
                    label={s.displayName}
                  />
                </div>
              ))}
            </div>

            <div className="oan-arena__event">
              <p className="oan-event">{room.lastEvent || "\u00a0"}</p>
              {err ? <p className="oan-err">{err}</p> : null}
            </div>

            <div className="oan-arena__board">
              <div
                className={`oan-arena__chrome ${room.status === "lobby" ? "is-on" : ""}`}
              >
                {room.status === "lobby" ? (
                  isHost ? (
                    <button
                      type="button"
                      className="oan-btn"
                      disabled={busy}
                      onClick={() => void startRoom()}
                    >
                      Bắt đầu
                    </button>
                  ) : (
                    <p className="oan-blurb">Chờ chủ phòng bắt đầu…</p>
                  )
                ) : null}
              </div>

              <p className="oan-board-legend" aria-hidden>
                <span className="oan-board-legend__pebble" /> cục đá dân
                <span className="oan-board-legend__sep">·</span>
                <span className="oan-board-legend__quan" /> đá quan (to)
              </p>

              <OanQuanBoard
                pits={room.pits}
                validPitIndexes={isMyTurn ? room.validPitIndexes : []}
                interactive={isMyTurn && !busy}
                onSow={(i) => void sow(i)}
                lastSteps={room.lastSteps}
                moveSeq={room.moveSeq}
              />

              <div
                className={`oan-arena__overlay ${room.status === "finished" ? "is-on" : ""}`}
              >
                {room.status === "finished" ? (
                  <div className="oan-finished">
                    <h2>
                      {room.winnerSeat == null
                        ? "Hòa"
                        : room.winnerSeat === mySeat?.seat
                          ? "Bạn thắng!"
                          : `${room.seats[room.winnerSeat]?.displayName ?? "?"} thắng`}
                    </h2>
                    <p>
                      Tỉ số {room.scores[0]} — {room.scores[1]}
                    </p>
                    <button
                      type="button"
                      className="oan-btn"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => {
                        setRoom(null);
                        setErr(null);
                      }}
                    >
                      Chơi lại
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
        </GamePlayShell>
      </div>
      <GiftHubSheet
        open={giftOpen}
        balance={me?.balances?.social ?? me?.balance}
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
    </AppShell>
  );
}
