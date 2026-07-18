import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  CARDS,
  formatXu,
  type GameState,
  type LeaderboardEntry,
  type RoundResult,
  type TarotStarEntry,
} from "../cards";
import { BettingBoard } from "../components/BettingBoard";
import { BetSheet } from "../components/BetSheet";
import { HistorySheet } from "../components/HistorySheet";
import { LeaderboardSheet } from "../components/LeaderboardSheet";
import { RevealPopup } from "../components/RevealPopup";
import { ResultSummaryPopup } from "../components/ResultSummaryPopup";
import { TarotStarsSheet } from "../components/TarotStarsSheet";
import { useSfx } from "../hooks/useSfx";
import {
  api,
  getToken,
  getStoredUser,
  homePath,
  saveSession,
  type AuthUser,
} from "../auth";
import { normalizeAvatar } from "../avatars";
import {
  ensureGuestCode,
  getGuestAvatar,
  getGuestCode,
  getGuestName,
  setGuestAvatar,
  setGuestName,
} from "../guest";
import { AvatarPickerSheet } from "../components/AvatarPickerSheet";
import { IdentityBadge } from "../components/IdentityBadge";
import { uploadAvatarFromFile } from "../uploadAvatar";
import { Link } from "react-router-dom";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? "http://localhost:3001" : undefined);

function useServerCountdown(phaseEndsAt: number, serverTime: number) {
  const offsetRef = useRef(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    offsetRef.current = serverTime - Date.now();
  }, [serverTime]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offsetRef.current;
      setRemaining(Math.max(0, Math.ceil((phaseEndsAt - now) / 1000)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  return remaining;
}

type Sheet = "bet" | "history" | "leaderboard" | "tarotStars" | "avatar" | null;

export default function GamePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [me, setMe] = useState<AuthUser | null>(() => getStoredUser());
  const [guestAvatar, setGuestAvatarState] = useState(() => getGuestAvatar());
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [betCardId, setBetCardId] = useState<number | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<RoundResult[]>([]);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>(
    [],
  );
  const [tarotStarRows, setTarotStarRows] = useState<TarotStarEntry[]>([]);
  const { play, muted, toggleMute } = useSfx();
  const lastTickSec = useRef<number | null>(null);

  const prevBalance = useRef<number | null>(null);
  const prevPhase = useRef<string | null>(null);

  const remaining = useServerCountdown(
    state?.phaseEndsAt ?? 0,
    state?.serverTime ?? Date.now(),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      const auth = getStoredUser();
      const token = getToken();
      const guestCode = ensureGuestCode();
      const saved =
        auth?.username ||
        getGuestName() ||
        `Khach-${guestCode.slice(-4)}`;
      if (!auth) setGuestName(saved);
      setMe(auth);
      setName(saved);
      const avatar = auth
        ? normalizeAvatar(auth.avatar)
        : getGuestAvatar();
      if (!auth) setGuestAvatarState(avatar);
      s.emit("join", {
        name: saved,
        token: token ?? undefined,
        avatar,
      });
    });

    s.on("disconnect", () => setConnected(false));

    s.on("joined", (payload: { name: string; balance: number }) => {
      setName(payload.name);
      prevBalance.current = payload.balance;
    });

    s.on("state", (payload: GameState) => {
      setState(payload);
    });

    s.on("betRejected", (payload: { reason: string }) => {
      showToast(payload.reason);
    });

    s.on("balanceUpdate", (payload: { balance: number }) => {
      setState((prev) =>
        prev ? { ...prev, yourBalance: payload.balance } : prev,
      );
    });

    s.on("historyData", (rows: RoundResult[]) => {
      setHistoryRows(rows);
    });

    s.on("leaderboardData", (rows: LeaderboardEntry[]) => {
      setLeaderboardRows(rows);
    });

    s.on("tarotStarsData", (rows: TarotStarEntry[]) => {
      setTarotStarRows(rows);
    });

    return () => {
      s.disconnect();
    };
  }, [showToast]);

  useEffect(() => {
    if (!state) return;

    if (state.phase === "revealing" && prevPhase.current !== "revealing") {
      setSheet(null);
      setResultOpen(false);
      setRevealOpen(true);
    }
    if (state.phase === "payout" && prevPhase.current !== "payout") {
      setRevealOpen(false);
      setResultOpen(true);
    }
    if (state.phase === "betting") {
      setRevealOpen(false);
      setResultOpen(false);
    }

    if (state.yourBalance != null) {
      prevBalance.current = state.yourBalance;
    }
    prevPhase.current = state.phase;
  }, [state]);

  // Tick SFX 5 giây cuối
  useEffect(() => {
    if (state?.phase !== "betting") {
      lastTickSec.current = null;
      return;
    }
    if (remaining > 0 && remaining <= 5 && lastTickSec.current !== remaining) {
      lastTickSec.current = remaining;
      play("tick");
    }
  }, [remaining, state?.phase, play]);

  const openBet = (cardId: number) => {
    if (!state || state.phase !== "betting") return;
    const bets = state.yourBets ?? [];
    const alreadyOnCard = (bets[cardId - 1] ?? 0) > 0;
    if (!alreadyOnCard) {
      const distinct = bets.filter((v) => v > 0).length;
      if (distinct >= 5) {
        showToast("Mỗi lượt chỉ được đặt tối đa 5 lá");
        return;
      }
    }
    setBetCardId(cardId);
    setSheet("bet");
  };

  const confirmBet = (cardId: number, amount: number) => {
    if (!socket || !state) return;
    // Đóng sheet ngay để cược tiếp lá khác (Bước 2)
    setSheet(null);
    setBetCardId(null);
    socket.emit("placeBet", {
      cardId,
      amount,
      roundId: state.roundId,
    });
  };

  const openHistory = () => {
    socket?.emit("getHistory", { limit: 30 });
    setSheet("history");
  };

  const openLeaderboard = () => {
    socket?.emit("getLeaderboard");
    setSheet("leaderboard");
  };

  const openTarotStars = () => {
    socket?.emit("getTarotStars");
    setSheet("tarotStars");
  };

  const openAvatarPicker = () => setSheet("avatar");

  const applyAvatar = async (next: string) => {
    if (me && getToken()) {
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/avatar", {
        method: "POST",
        body: JSON.stringify({ avatar: next }),
      });
      const token = getToken();
      if (token) saveSession(token, r.user);
      setMe(r.user);
      socket?.emit("setAvatar", { avatar: r.user.avatar });
      return;
    }
    const saved = setGuestAvatar(next);
    setGuestAvatarState(saved);
    await new Promise<void>((resolve) => {
      if (!socket) {
        resolve();
        return;
      }
      socket.emit("setAvatar", { avatar: saved }, () => resolve());
      window.setTimeout(() => resolve(), 800);
    });
  };

  const pickAvatar = async (avatar: string) => {
    if (avatarBusy) return;
    const next = normalizeAvatar(avatar);
    const current = me
      ? normalizeAvatar(me.avatar)
      : normalizeAvatar(guestAvatar);
    if (next === current) {
      setSheet(null);
      return;
    }
    setAvatarBusy(true);
    try {
      await applyAvatar(next);
      showToast("Đã đổi avatar");
      setSheet(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không đổi được avatar");
    } finally {
      setAvatarBusy(false);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    try {
      const guestCode = me ? null : getGuestCode() || ensureGuestCode();
      const r = await uploadAvatarFromFile(file, { guestCode });
      if (r.user && getToken()) {
        saveSession(getToken()!, r.user);
        setMe(r.user);
        socket?.emit("setAvatar", { avatar: r.user.avatar });
      } else {
        const saved = setGuestAvatar(r.avatar);
        setGuestAvatarState(saved);
        socket?.emit("setAvatar", { avatar: saved });
      }
      showToast("Đã đổi avatar từ máy");
      setSheet(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload avatar thất bại");
    } finally {
      setAvatarBusy(false);
    }
  };

  const balance = state?.yourBalance ?? 0;
  const canBet = state?.phase === "betting";
  const winning = state?.winningCard ?? null;
  const guessesToday = state?.guessesToday ?? 0;
  const myStakeOnWinner =
    winning != null ? (state?.yourBets?.[winning - 1] ?? 0) : 0;
  const winCard = winning != null ? CARDS.find((c) => c.id === winning) : null;
  const didWin = myStakeOnWinner > 0;
  const payoutAmount = winCard ? myStakeOnWinner * winCard.multiplier : 0;
  const profitAmount = payoutAmount - myStakeOnWinner;
  const topWinners = state?.roundTopWinners ?? [];

  const selectedCards = useMemo(() => {
    const bets = state?.yourBets ?? [];
    return CARDS.filter((c) => (bets[c.id - 1] ?? 0) > 0).map((c) => ({
      card: c,
      amount: bets[c.id - 1] ?? 0,
    }));
  }, [state?.yourBets]);

  return (
    <div className="app-shell play-screen relative h-dvh overflow-y-auto overflow-x-hidden">
      <div className="app-shell-deco" aria-hidden />
      <div className="relative z-[1] mx-auto flex w-full max-w-md flex-col px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* ===== ZONE 1: Hồ sơ & số dư (per-user) ===== */}
        <header className="game-task flex flex-col gap-2 px-2.5 py-2.5">
          <div className="flex items-center gap-2">
            <Link
              to={
                getStoredUser() ? homePath(getStoredUser()) : "/login"
              }
              className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] shadow-sm ring-1 ring-[#1e3a6e]/15"
            >
              ← Menu
            </Link>
            <img
              src="/assets/logo/logo-tarot.png"
              alt="Tarot"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <h1 className="play-heading truncate text-base leading-tight sm:text-lg">
                Đoán bài Tarot
              </h1>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-[var(--play-ink)] shadow-sm ring-1 ring-[#1e3a6e]/15"
              title={muted ? "Bật tiếng" : "Tắt tiếng"}
            >
              {muted ? "Tắt" : "Âm"}
            </button>
          </div>
          <IdentityBadge
            user={me}
            guestCode={me ? null : getGuestCode() || ensureGuestCode()}
            guestName={me ? null : name}
            guestAvatar={me ? null : guestAvatar}
            compact
            showPath={false}
            onAvatarClick={openAvatarPicker}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={openHistory}
              className="min-w-0 truncate text-left text-[11px] font-medium text-[var(--play-ink)]/85 underline-offset-2 hover:underline"
            >
              Hôm nay đã đoán: {guessesToday} lần ›
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-amber-400/50">
                <img
                  src="/assets/ui/icon-coin-xu.png"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
                <span className="font-play text-xs font-bold text-amber-700 tabular-nums">
                  {formatXu(balance)}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[#1e3a6e] px-2 py-1 shadow-sm ring-1 ring-amber-300/60">
                <img
                  src="/assets/ui/icon-vip.png"
                  alt=""
                  className="h-3.5 w-3.5 rounded-full object-cover"
                />
                <span className="font-play text-[9px] font-semibold text-amber-200 tabular-nums">
                  VIP {formatXu(state?.vipPool ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ===== ZONE 2: Đồng bộ phòng (shared realtime) ===== */}
        <div className="game-task mt-2 px-3 py-1.5 text-[10px] text-[var(--play-muted)]">
          {connected
            ? `${state?.onlineDisplay ?? 0} trong phòng`
            : "Mất kết nối"}
        </div>

        {/* ===== ZONE 3: Lịch sử nhanh (strip) ===== */}
        <button
          type="button"
          onClick={openHistory}
          className="game-task mt-2.5 w-full overflow-hidden px-2 py-2 text-left"
        >
          <p className="play-section-title mb-1 px-1">
            Kết quả gần đây ›
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {(state?.history ?? []).length === 0 && (
              <span className="px-1 text-xs text-[var(--play-muted)]">
                Chưa có kết quả
              </span>
            )}
            {(state?.history ?? []).map((row, i) => {
              const card = CARDS.find((c) => c.id === row.win);
              return (
                <span
                  key={`${row.round}-${i}`}
                  className="relative h-12 w-9 shrink-0 overflow-hidden rounded shadow ring-1 ring-[#1e3a6e]/20"
                  title={card ? `#${card.id} ${card.nameVi}` : `#${row.win}`}
                >
                  <img
                    src={card?.image}
                    alt={card?.nameVi ?? `#${row.win}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="font-play absolute left-0.5 top-0.5 z-[1] rounded bg-[#1e3a6e]/92 px-1 text-[9px] font-bold leading-tight text-white tabular-nums shadow-sm">
                    {row.win}
                  </span>
                </span>
              );
            })}
          </div>
        </button>

        {/* ===== ZONE 5: Lá bài đã chọn (cược của bạn) ===== */}
        <section className="game-task mt-3 px-3 py-2">
          <p className="play-section-title mb-1.5">
            Lá bài bạn đã chọn
          </p>
          {selectedCards.length === 0 ? (
            <p className="text-xs text-[var(--play-muted)]">
              Chưa đặt — chạm 1 lá bên dưới để mở bảng chọn xu
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto">
              {selectedCards.map(({ card, amount }) => (
                <div
                  key={card.id}
                  className="flex shrink-0 flex-col items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1.5 shadow-sm ring-1 ring-amber-400/40"
                >
                  <img
                    src={card.image}
                    alt=""
                    className="h-12 w-9 rounded object-cover"
                  />
                  <p className="font-play text-[10px] font-semibold text-amber-700 tabular-nums">
                    {formatXu(amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== ZONE 4+6: Form bàn cược (giống ảnh mẫu) ===== */}
        <BettingBoard
          remaining={remaining}
          canBet={canBet}
          playerCounts={state?.playerCounts ?? []}
          yourBets={state?.yourBets ?? []}
          winningCardId={winning}
          phase={state?.phase ?? null}
          onPick={openBet}
        />

        <p className="mt-3 text-center text-[11px] text-[var(--play-muted)]">
          {canBet
            ? "Chạm lá bài → chọn số xu → Xác nhận"
            : state?.phase === "revealing"
              ? "Đang mở kết quả…"
              : "Đang trả thưởng & chuẩn bị ván mới…"}
        </p>

        {/* ===== ZONE 7: Cao thủ — khung lớn nhất ===== */}
        <section className="game-task game-task-aces mt-5">
          <button
            type="button"
            onClick={openLeaderboard}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="play-heading text-xl sm:text-2xl">
              Cao thủ dự đoán ›
            </p>
            <span className="text-xs font-medium text-white/50">
              Thắng vòng trước
            </span>
          </button>

          <ul className="mt-3 space-y-2.5">
            {(state?.topAces ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-white/45">
                Chưa có ai thắng vòng trước
              </li>
            )}
            {(state?.topAces ?? []).slice(0, 3).map((ace) => (
              <li
                key={`${ace.rank}-${ace.name}`}
                className={`rounded-xl px-3 py-3 ring-1 ${
                  ace.isYou
                    ? "bg-[var(--gold)]/15 ring-[var(--gold)]/45"
                    : "bg-white/5 ring-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-play w-7 text-center text-base font-bold text-[var(--gold-soft)] tabular-nums">
                    {ace.rank}
                  </span>
                  <img
                    src={ace.avatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20 shadow-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {ace.name}
                      {ace.isYou ? " (Bạn)" : ""}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-amber-300/90 tabular-nums">
                      Thưởng vòng trước: {formatXu(ace.winToday)} xu
                    </p>
                  </div>
                </div>
                {ace.chosenCards.length > 0 ? (
                  <div className="mt-2.5 flex items-center gap-2 pl-10">
                    <span className="shrink-0 text-[11px] font-medium text-white/45">
                      Lá chọn:
                    </span>
                    <div className="flex gap-1.5 overflow-x-auto">
                      {ace.chosenCards.map((pick) => {
                        const card = CARDS.find((c) => c.id === pick.cardId);
                        if (!card) return null;
                        return (
                          <div
                            key={pick.cardId}
                            className="relative shrink-0"
                            title={`${card.nameVi}: ${formatXu(pick.amount)} xu`}
                          >
                            <img
                              src={card.image}
                              alt={card.nameVi}
                              className="h-12 w-8 rounded-md object-cover shadow ring-1 ring-white/20"
                            />
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-[#1a2234] px-1 text-[8px] font-bold text-amber-200 ring-1 ring-white/15">
                              x{card.multiplier}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 pl-10 text-[11px] text-white/40">
                    Đợt này chưa đoán
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ===== ZONE 8: Sao bài Tarot — xu dùng dự đoán tuần ===== */}
        <section className="game-task mt-4">
          <button
            type="button"
            onClick={openTarotStars}
            className="flex w-full flex-col text-left"
          >
            <p className="play-heading text-xl sm:text-2xl">Sao bài Tarot ›</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Xếp hạng theo số xu dùng dự đoán mỗi tuần
            </p>
          </button>

          <ul className="mt-3 space-y-2.5">
            {(state?.tarotStars ?? []).length === 0 && (
              <li className="py-5 text-center text-sm text-[var(--play-muted)]">
                Chưa có xu dự đoán tuần này
              </li>
            )}
            {(state?.tarotStars ?? []).slice(0, 3).map((star) => (
              <li
                key={`${star.rank}-${star.name}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 ring-2 ${
                  star.isYou
                    ? "bg-amber-100/90 ring-amber-400/60"
                    : "bg-white/85 ring-[#1e3a6e]/12"
                }`}
              >
                <span className="font-play w-7 text-center text-base font-bold text-[var(--play-ink)] tabular-nums">
                  {star.rank}
                </span>
                <img
                  src={star.avatar}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover shadow-md ring-2 ring-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--play-ink)]">
                    {star.name}
                    {star.isYou ? " (Bạn)" : ""}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-700 tabular-nums">
                    <img
                      src="/assets/ui/icon-coin-xu.png"
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                    />
                    {formatXu(star.stakeWeek)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <RevealPopup
        open={revealOpen}
        winningCardId={winning}
        yourStake={myStakeOnWinner}
        onGatherSfx={() => play("gather")}
        onShuffleSfx={() => play("shuffle")}
        onSuspenseSfx={() => play("suspense")}
        onFlipSfx={() => play("flip")}
        onWinSfx={() => play("win")}
        onLoseSfx={() => play("lose")}
        onDone={() => setRevealOpen(false)}
      />
      <ResultSummaryPopup
        open={resultOpen}
        winningCardId={winning}
        didWin={didWin}
        profit={profitAmount}
        payout={payoutAmount}
        topWinners={topWinners}
      />

      <BetSheet
        open={sheet === "bet"}
        cardId={betCardId}
        balance={balance}
        currentStake={
          betCardId != null ? (state?.yourBets?.[betCardId - 1] ?? 0) : 0
        }
        onClose={() => {
          setSheet(null);
          setBetCardId(null);
        }}
        onConfirm={confirmBet}
      />
      <HistorySheet
        open={sheet === "history"}
        rows={historyRows}
        onClose={() => setSheet(null)}
      />
      <LeaderboardSheet
        open={sheet === "leaderboard"}
        rows={leaderboardRows}
        onClose={() => setSheet(null)}
      />
      <TarotStarsSheet
        open={sheet === "tarotStars"}
        rows={
          tarotStarRows.length > 0
            ? tarotStarRows
            : (state?.tarotStars ?? [])
        }
        onClose={() => setSheet(null)}
      />
      <AvatarPickerSheet
        open={sheet === "avatar"}
        current={me ? me.avatar : guestAvatar}
        busy={avatarBusy}
        onClose={() => setSheet(null)}
        onPick={pickAvatar}
        onUploadFile={uploadAvatarFile}
      />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-[var(--ink)]/95 px-4 py-2 font-display text-sm text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/50">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
