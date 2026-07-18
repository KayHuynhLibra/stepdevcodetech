import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  CARDS,
  formatXu,
  type GameState,
  type LeaderboardEntry,
  type RoundResult,
} from "../cards";
import { BettingBoard } from "../components/BettingBoard";
import { BetSheet } from "../components/BetSheet";
import { HistorySheet } from "../components/HistorySheet";
import { LeaderboardSheet } from "../components/LeaderboardSheet";
import { RevealPopup } from "../components/RevealPopup";
import { ResultSummaryPopup } from "../components/ResultSummaryPopup";
import { useSfx } from "../hooks/useSfx";
import { getToken, getStoredUser } from "../auth";
import { Link } from "react-router-dom";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3001";

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

type Sheet = "bet" | "history" | "leaderboard" | null;

export default function GamePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
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
      const saved =
        auth?.username ||
        localStorage.getItem("tarot_guest_name") ||
        `Khach${Math.floor(Math.random() * 9000) + 1000}`;
      localStorage.setItem("tarot_guest_name", saved);
      setName(saved);
      s.emit("join", { name: saved, token: token ?? undefined });
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
              to={getStoredUser()?.role === "admin" ? "/admin" : "/dashboard"}
              className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] text-[var(--play-ink)] shadow-sm ring-1 ring-[#1e3a6e]/15"
            >
              ← Menu
            </Link>
            <img
              src="/assets/logo/logo-tarot.png"
              alt="Tarot"
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <h1 className="play-heading truncate text-base leading-tight sm:text-lg">
                Đoán bài Tarot
              </h1>
              <p className="truncate text-[10px] text-[var(--play-muted)]">{name}</p>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[10px] text-[var(--play-ink)] shadow-sm ring-1 ring-[#1e3a6e]/15"
              title={muted ? "Bật tiếng" : "Tắt tiếng"}
            >
              {muted ? "Tắt" : "Âm"}
            </button>
            <img
              src="/assets/ui/avatar-default.png"
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-white/90"
            />
          </div>
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
                <img
                  key={`${row.round}-${i}`}
                  src={card?.image}
                  alt={card?.nameVi}
                  className="h-12 w-9 shrink-0 rounded object-cover shadow ring-1 ring-[#1e3a6e]/20"
                />
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
            <span className="text-xs font-medium text-[var(--play-muted)]">
              Thắng vòng trước
            </span>
          </button>

          <ul className="mt-3 space-y-2.5">
            {(state?.topAces ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-[var(--play-muted)]">
                Chưa có ai thắng vòng trước
              </li>
            )}
            {(state?.topAces ?? []).slice(0, 3).map((ace) => (
              <li
                key={`${ace.rank}-${ace.name}`}
                className={`rounded-xl px-3 py-3 ring-2 ${
                  ace.isYou
                    ? "bg-amber-100/90 ring-amber-400/60"
                    : "bg-white/85 ring-[#1e3a6e]/12"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-play w-7 text-center text-base font-bold text-[var(--play-ink)] tabular-nums">
                    {ace.rank}
                  </span>
                  <img
                    src={ace.avatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--play-ink)]">
                      {ace.name}
                      {ace.isYou ? " (Bạn)" : ""}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-amber-700 tabular-nums">
                      Thưởng vòng trước: {formatXu(ace.winToday)} xu
                    </p>
                  </div>
                </div>
                {ace.chosenCards.length > 0 ? (
                  <div className="mt-2.5 flex items-center gap-2 pl-10">
                    <span className="shrink-0 text-[11px] font-medium text-[var(--play-muted)]">
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
                              className="h-12 w-8 rounded-md object-cover shadow ring-1 ring-[#1e3a6e]/25"
                            />
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-[#1e3a6e] px-1 text-[8px] font-bold text-amber-200">
                              x{card.multiplier}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 pl-10 text-[11px] text-[var(--play-muted)]/80">
                    Chưa đặt ván này
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <RevealPopup
        open={revealOpen}
        winningCardId={winning}
        yourStake={myStakeOnWinner}
        onShuffleSfx={() => play("shuffle")}
        onWinSfx={() => play("win")}
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
