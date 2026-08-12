import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredUser, getToken, saveSession } from "../auth";
import { AppShell } from "../components/AppShell";
import { GamePlayShell } from "../components/GamePlayShell";
import {
  GiftHubSheet,
  type GiftHubTarget,
} from "../components/GiftHubSheet";
import { ensureGuestCode, getGuestCode } from "../guest";
import { useApplyPlayMediaPresets } from "../hooks/useApplyPlayMediaPresets";
import { useSfx } from "../hooks/useSfx";
import { shopPriceLabel } from "../gem";
import {
  discountedGemPrice,
  nobilityLabel,
  nobilityTierOf,
} from "../nobility";
import { UnoBoard } from "../platform/uno/UnoBoard";
import type { UnoColor, UnoPlayer, UnoRoom } from "../platform/uno/types";
import { sendGiftFromCatalog } from "../socialGift";
import "../platform/uno/uno.css";

const STAKE_PRESETS = [0, 500, 1000, 5000] as const;
const DEFAULT_PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type ShopItem = {
  id: string;
  nameVi: string;
  kind: "back" | "felt";
  priceXu: number;
  priceGem?: number;
  minNobility?: number;
  cssClass: string;
  freeStarter?: boolean;
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

export default function UnoPage() {
  useApplyPlayMediaPresets("uno");
  const { play: playSfx, muted: sfxMuted, toggleMute } = useSfx("tarot", "uno");
  const me = getStoredUser();
  const guestCode = !me ? getGuestCode() || ensureGuestCode() : null;

  const [room, setRoom] = useState<UnoRoom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"bot" | "pvp">("bot");
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerCounts, setPlayerCounts] = useState<number[]>([...DEFAULT_PLAYER_COUNTS]);
  const [stake, setStake] = useState(0);
  const [stakePresets, setStakePresets] = useState<number[]>([...STAKE_PRESETS]);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopCatalog, setShopCatalog] = useState<ShopItem[]>([]);
  const [shopOwned, setShopOwned] = useState<string[]>([]);
  const [shopEquippedBack, setShopEquippedBack] = useState<string | null>(null);
  const [shopEquippedFelt, setShopEquippedFelt] = useState<string | null>(null);
  const [shopBalance, setShopBalance] = useState<number | null>(null);
  const [shopGem, setShopGem] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [fxPulse, setFxPulse] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftPreset, setGiftPreset] = useState<GiftHubTarget | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const moveSeqRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void fetch("/api/uno/rooms")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.stakePresets) && j.stakePresets.length) {
          setStakePresets(
            j.stakePresets
              .map((n: unknown) => Math.floor(Number(n)))
              .filter((n: number) => Number.isFinite(n) && n >= 0),
          );
        }
        if (Array.isArray(j.playerCounts) && j.playerCounts.length) {
          setPlayerCounts(j.playerCounts.map((n: unknown) => Math.floor(Number(n))));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!me) return;
    void fetch("/api/uno/shop", { headers: headers() })
      .then((r) => r.json())
      .then((j) => {
        if (j.catalog) setShopCatalog(j.catalog as ShopItem[]);
        if (Array.isArray(j.ownedIds)) setShopOwned(j.ownedIds);
        if (j.equippedBack != null) setShopEquippedBack(j.equippedBack);
        if (j.equippedFelt != null) setShopEquippedFelt(j.equippedFelt);
        if (typeof j.balance === "number") setShopBalance(j.balance);
        if (typeof j.gemBalance === "number") setShopGem(j.gemBalance);
      })
      .catch(() => {});
  }, [me?.id]);

  useEffect(() => {
    if (!room?.roomId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const r = await fetch(`/api/uno/rooms/${room.roomId}`, {
          headers: headers(),
        });
        if (r.status === 429) {
          if (!cancelled) timer = setTimeout(poll, 4000);
          return;
        }
        const j = await r.json();
        if (!cancelled && j.ok && j.room) {
          setRoom(j.room as UnoRoom);
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
      const ev = room.lastEvent?.toLowerCase() ?? "";
      let fx = "play";
      if (ev.includes("rút")) fx = "draw";
      else if (ev.includes("skip") || ev.includes("bỏ")) fx = "skip";
      else if (ev.includes("reverse") || ev.includes("đảo")) fx = "reverse";
      else if (ev.includes("wild") || ev.includes("+4") || ev.includes("chồng")) fx = "wild";
      setFxPulse(fx);
      const t = setTimeout(() => setFxPulse(null), 600);
      try {
        if (room.status === "finished") playSfx("win");
        else if (fx === "draw") playSfx("draw");
        else playSfx("move");
      } catch {
        /* silent */
      }
      return () => clearTimeout(t);
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
      const r = await fetch("/api/uno/rooms", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          mode: mode === "pvp" ? "pvp" : "bot",
          fillBots: mode === "bot",
          playerCount,
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
      setRoom(j.room as UnoRoom);
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
      const r = await fetch(`/api/uno/rooms/${code}/join`, {
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
      setRoom(j.room as UnoRoom);
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
      const r = await fetch(`/api/uno/rooms/${room.roomId}/start`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không bắt đầu được");
        return;
      }
      setRoom(j.room as UnoRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function playCard(cardId: string) {
    if (!room || busy) return;
    if (room.needsColorChoice || room.phase === "choose_color") {
      setErr(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/uno/rooms/${room.roomId}/play`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ cardId }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không đánh được lá");
        return;
      }
      setRoom(j.room as UnoRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function chooseColor(color: UnoColor) {
    if (!room || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/uno/rooms/${room.roomId}/color`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ color }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không chọn được màu");
        return;
      }
      setRoom(j.room as UnoRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function drawCard() {
    if (!room || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/uno/rooms/${room.roomId}/draw`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không rút được");
        return;
      }
      setRoom(j.room as UnoRoom);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function callUno() {
    if (!room || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/uno/rooms/${room.roomId}/uno`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không gọi được Rush");
        return;
      }
      setRoom(j.room as UnoRoom);
      try {
        playSfx("win");
      } catch {
        /* silent */
      }
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function catchUno(targetSeat: number) {
    if (!room || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/uno/rooms/${room.roomId}/catch`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ targetSeat }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không bắt được");
        return;
      }
      setRoom(j.room as UnoRoom);
      try {
        playSfx("draw");
      } catch {
        /* silent */
      }
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function buyShopItem(itemId: string, payWith?: "play" | "gem") {
    if (!me || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const item = shopCatalog.find((i) => i.id === itemId);
      const prefer =
        payWith ??
        ((item?.priceGem ?? 0) > 0 ? "gem" : "play");
      const r = await fetch("/api/uno/shop/buy", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ itemId, payWith: prefer }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không mua được");
        return;
      }
      if (Array.isArray(j.ownedIds)) setShopOwned(j.ownedIds);
      if (typeof j.balance === "number") setShopBalance(j.balance);
      if (typeof j.gemBalance === "number") setShopGem(j.gemBalance);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function equipShopItem(itemId: string, kind: "back" | "felt") {
    if (!me || busy) return;
    setBusy(true);
    try {
      const body =
        kind === "back" ? { backId: itemId } : { feltId: itemId };
      const r = await fetch("/api/uno/shop/equip", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.reason || "Không trang bị được");
        return;
      }
      if (j.equippedBack != null) setShopEquippedBack(j.equippedBack);
      if (j.equippedFelt != null) setShopEquippedFelt(j.equippedFelt);
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  const isHost =
    !!room &&
    mySeat?.seat === 0;

  return (
    <AppShell maxWidth="md">
      <div className="uno-page">
        <GamePlayShell
          title="HueRush"
          active="uno"
          user={me}
          guestCode={guestCode}
          tools={
            <>
              {me ? (
                <button
                  type="button"
                  className="uno-btn-draw"
                  onClick={() => setShopOpen((v) => !v)}
                >
                  Shop
                </button>
              ) : null}
              <button
                type="button"
                className="uno-btn-draw"
                onClick={() => toggleMute()}
              >
                {sfxMuted ? "Bật âm" : "Tắt âm"}
              </button>
            </>
          }
        >

        {!room ? (
          <div className="uno-lobby">
            <h1>HueRush</h1>
            <p style={{ fontSize: "0.85rem", opacity: 0.85 }}>
              112 lá / bộ · 2–10 người · chồng +2/+4 · shop lá úp & nỉ
            </p>

            {shopOpen && me ? (
              <div className="uno-shop">
                <h2>Shop HueRush · skin Gem</h2>
                <p className="uno-shop__bal">
                  {shopGem != null ? `${shopGem.toLocaleString("vi-VN")} Gem` : "—"}
                  {shopBalance != null
                    ? ` · ${shopBalance.toLocaleString("vi-VN")} xu`
                    : ""}
                </p>
                <div className="uno-shop__grid">
                  {shopCatalog.map((item) => {
                    const owned = shopOwned.includes(item.id);
                    const equipped =
                      item.kind === "back"
                        ? shopEquippedBack === item.id
                        : shopEquippedFelt === item.id;
                    const myNoble = me ? nobilityTierOf(me) : 0;
                    const need = Math.max(0, Math.floor(item.minNobility ?? 0));
                    const lockedNoble = need > 0 && myNoble < need;
                    const gem = Math.max(0, Math.floor(item.priceGem ?? 0));
                    const disc =
                      gem > 0 ? discountedGemPrice(gem, myNoble) : null;
                    const priceText =
                      disc && disc.discountPct > 0
                        ? `${disc.amount} Gem (−${disc.discountPct}%)`
                        : shopPriceLabel(item);
                    return (
                      <div key={item.id} className="uno-shop__item">
                        <span className={`uno-shop__swatch ${item.cssClass}`} />
                        <div>
                          <strong>{item.nameVi}</strong>
                          <span className="uno-shop__kind">
                            {item.kind === "back" ? "Lá úp" : "Nỉ bàn"}
                            {need > 0
                              ? ` · ${nobilityLabel(need)}+`
                              : ""}
                          </span>
                        </div>
                        {owned ? (
                          <button
                            type="button"
                            className={equipped ? "is-equipped" : ""}
                            disabled={equipped || busy}
                            onClick={() =>
                              void equipShopItem(item.id, item.kind)
                            }
                          >
                            {equipped ? "Đang dùng" : "Trang bị"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || lockedNoble}
                            title={
                              lockedNoble
                                ? `Cần ${nobilityLabel(need)}`
                                : undefined
                            }
                            onClick={() => void buyShopItem(item.id)}
                          >
                            {lockedNoble
                              ? `🔒 ${nobilityLabel(need)}`
                              : priceText}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="uno-lobby__modes">
              <button
                type="button"
                className={mode === "bot" ? "is-active" : ""}
                onClick={() => setMode("bot")}
              >
                Vs Bot
              </button>
              <button
                type="button"
                className={mode === "pvp" ? "is-active" : ""}
                onClick={() => setMode("pvp")}
              >
                PvP
              </button>
            </div>

            <label>
              Số người chơi
              <select
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
              >
                {playerCounts.map((n) => (
                  <option key={n} value={n}>
                    {n} người{n > 4 ? " · 2+ bộ" : ""}
                  </option>
                ))}
              </select>
            </label>

            {me ? (
              <div>
                <label>Mức xu chơi</label>
                <div className="uno-lobby__stakes">
                  {stakePresets.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={stake === s ? "is-active" : ""}
                      onClick={() => setStake(s)}
                    >
                      {s === 0 ? "Free" : s.toLocaleString("vi-VN")}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                Khách chơi free — đăng nhập để dùng xu chơi.
              </p>
            )}

            {err ? (
              <p style={{ color: "#ff8a8a", fontSize: "0.85rem" }}>{err}</p>
            ) : null}

            <button
              type="button"
              className="uno-cta"
              disabled={busy}
              onClick={() => void createRoom()}
            >
              {mode === "bot" ? "Chơi ngay (bot)" : "Tạo phòng PvP"}
            </button>

            <label>
              Vào phòng (mã)
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="VD: A1B2C3"
                maxLength={8}
              />
            </label>
            <button
              type="button"
              className="uno-cta uno-cta--ghost"
              disabled={busy}
              onClick={() => void joinRoom()}
            >
              Join phòng
            </button>
          </div>
        ) : (
          <>
            <div className="uno-status">
              <span>
                Phòng <strong>{room.roomId}</strong>
                {room.stake > 0 ? ` · ${room.stake} xu` : " · free"}
                {room.fillBots ? ` · ${room.playerCount} bot` : " · PvP"}
              </span>
              {room.status === "playing" && (
                <span className="uno-timer"> · {turnLeft}s</span>
              )}
              <button
                type="button"
                className="uno-btn-draw"
                style={{ marginLeft: "0.5rem" }}
                onClick={() => {
                  setRoom(null);
                  setErr(null);
                }}
              >
                Rời
              </button>
            </div>

            <p className="uno-status" style={{ border: "none" }}>
              {room.lastEvent || " "}
            </p>
            {err ? (
              <p style={{ color: "#ff8a8a", textAlign: "center", fontSize: "0.8rem" }}>
                {err}
              </p>
            ) : null}

            {room.status === "lobby" && (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                {isHost ? (
                  <button
                    type="button"
                    className="uno-cta"
                    disabled={busy}
                    onClick={() => void startRoom()}
                  >
                    Bắt đầu
                  </button>
                ) : (
                  <p>Chờ chủ phòng bắt đầu…</p>
                )}
              </div>
            )}

            {room.status !== "lobby" && (
              <UnoBoard
                room={room}
                mySeat={mySeat?.seat ?? null}
                isMyTurn={isMyTurn}
                onPlayCard={(id) => void playCard(id)}
                onDraw={() => void drawCard()}
                onCallUno={() => void callUno()}
                onCatch={(s) => void catchUno(s)}
                onChooseColor={(c) => void chooseColor(c)}
                fxPulse={fxPulse}
                onSelectPlayer={
                  me
                    ? (p: UnoPlayer) => {
                        if (!p.userId || p.isBot) return;
                        setGiftPreset({
                          userId: p.userId,
                          name: p.displayName,
                        });
                        setGiftOpen(true);
                      }
                    : undefined
                }
              />
            )}

            {room.status === "finished" && (
              <div
                className={`uno-fx--win`}
                style={{ textAlign: "center", padding: "1.5rem" }}
              >
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                  {room.winnerSeat === mySeat?.seat
                    ? "Bạn thắng HueRush!"
                    : `${room.seats[room.winnerSeat ?? 0]?.displayName ?? "?"} thắng`}
                </h2>
                <button
                  type="button"
                  className="uno-cta"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => {
                    setRoom(null);
                    setErr(null);
                  }}
                >
                  Chơi lại
                </button>
              </div>
            )}
          </>
        )}
        </GamePlayShell>
      </div>
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
          setErr(null);
        }}
      />
    </AppShell>
  );
}
