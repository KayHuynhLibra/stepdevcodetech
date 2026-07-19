import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  CARDS,
  formatXu,
  type BetEntry,
  type GameState,
  type LeaderboardEntry,
  type RoundResult,
  type TarotStarEntry,
} from "../cards";
import { BettingBoard } from "../components/BettingBoard";
import { BetSheet } from "../components/BetSheet";
import { HistorySheet } from "../components/HistorySheet";
import { MyBetsSheet } from "../components/MyBetsSheet";
import { LeaderboardSheet } from "../components/LeaderboardSheet";
import { RevealPopup } from "../components/RevealPopup";
import { ResultSummaryPopup } from "../components/ResultSummaryPopup";
import { PlayersSheet } from "../components/PlayersSheet";
import { PlayerInfoSheet, type PlayerInfoView } from "../components/PlayerInfoSheet";
import { CouponSheet } from "../components/CouponSheet";
import {
  VipTopupSheet,
  type TopupRow,
} from "../components/VipTopupSheet";
import {
  AutoBetSheet,
  loadAutoBet,
  saveAutoBet,
  type AutoBetConfig,
} from "../components/AutoBetSheet";
import { ShoutBar } from "../components/ShoutBar";
import { ShoutMarquee } from "../components/ShoutMarquee";
import { SaintOverlay } from "../components/SaintOverlay";
import { TarotStarsSheet } from "../components/TarotStarsSheet";
import { RulesSheet } from "../components/RulesSheet";
import type { ChatMode, ShoutEvent } from "../shouts";
import { SAINT_DISPLAY_MS } from "../shouts";
import type { OnlinePlayerPublic } from "../cards";
import { useSfx } from "../hooks/useSfx";
import { usePlaytime } from "../hooks/usePlaytime";
import { formatDuration } from "../playtime";
import { PlaytimeNudge } from "../components/PlaytimeNudge";
import {
  api,
  clearSession,
  getToken,
  getStoredUser,
  homePath,
  isStaff,
  saveSession,
  VIP_ROUNDS_REQUIRED,
  type AuthUser,
} from "../auth";
import {
  ensureGuestCode,
  getGuestAvatar,
  getGuestCode,
  getGuestName,
  setGuestAvatar,
  setGuestBalanceHint,
  setGuestName,
} from "../guest";
import { normalizeAvatar } from "../avatars";
import { AvatarPickerSheet } from "../components/AvatarPickerSheet";
import { IdentityBadge } from "../components/IdentityBadge";
import { uploadAvatarFromFile } from "../uploadAvatar";
import { Link, useNavigate } from "react-router-dom";

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

type Sheet =
  | "bet"
  | "history"
  | "myBets"
  | "leaderboard"
  | "tarotStars"
  | "avatar"
  | "players"
  | "coupon"
  | "playerInfo"
  | "vipTopups"
  | "autoBet"
  | "rules"
  | null;

export default function GamePage() {
  const nav = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef<HTMLDivElement>(null);
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
  const [myBets, setMyBets] = useState<BetEntry[]>([]);
  const [myBetsLoading, setMyBetsLoading] = useState(false);
  const [myBetsError, setMyBetsError] = useState<string | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>(
    [],
  );
  const [tarotStarRows, setTarotStarRows] = useState<TarotStarEntry[]>([]);
  const [shouts, setShouts] = useState<(ShoutEvent & { key: string })[]>([]);
  const [saintItem, setSaintItem] = useState<
    (ShoutEvent & { key: string }) | null
  >(null);
  const [chatLines, setChatLines] = useState<ShoutEvent[]>([]);
  const [shoutBusy, setShoutBusy] = useState(false);
  /** Mode chat: no | vip | saint */
  const [chatMode, setChatMode] = useState<ChatMode>("no");
  const [couponBusy, setCouponBusy] = useState(false);
  const [topupRows, setTopupRows] = useState<TopupRow[]>([]);
  const [topupTotalXu, setTopupTotalXu] = useState(0);
  const [topupBusy, setTopupBusy] = useState(false);
  const [autoBet, setAutoBet] = useState<AutoBetConfig>(() => loadAutoBet());
  const autoRoundRef = useRef<number | null>(null);
  const [profile, setProfile] = useState<PlayerInfoView | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  /** Session socket đã gắn userId (tin cậy hơn localStorage) */
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const { play, muted, toggleMute } = useSfx();
  const {
    sessionMs,
    dayMs,
    nudge: playtimeNudge,
    dismissNudge,
  } = usePlaytime();
  const lastTickSec = useRef<number | null>(null);
  const shoutKeyRef = useRef(0);
  const saintTimerRef = useRef<number | null>(null);

  const prevBalance = useRef<number | null>(null);
  const prevPhase = useRef<string | null>(null);
  /** Snapshot lá đã chọn — giữ khung khi reveal/payout */
  const [pickedSnapshot, setPickedSnapshot] = useState<
    { cardId: number; amount: number }[]
  >([]);

  const remaining = useServerCountdown(
    state?.phaseEndsAt ?? 0,
    state?.serverTime ?? Date.now(),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(() => {
    if (!renameOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!renameRef.current?.contains(e.target as Node)) {
        setRenameOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRenameOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [renameOpen]);

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
        guestCode: auth ? undefined : guestCode,
      });
    });

    s.on("disconnect", () => {
      setConnected(false);
      setSessionAuthed(false);
    });

    s.on(
      "joined",
      (payload: {
        name: string;
        balance: number;
        userId?: string;
      }) => {
        setName(payload.name);
        prevBalance.current = payload.balance;
        setSessionAuthed(!!payload.userId);
        if (!payload.userId) setGuestBalanceHint(payload.balance);
        // Token hết hạn phía server nhưng localStorage còn → nhắc đăng nhập lại
        if (getToken() && getStoredUser() && !payload.userId) {
          showToast("Phiên hết hạn — đăng nhập lại để chat & lưu cược");
        }
      },
    );

    s.on("joinRejected", (payload: { reason?: string }) => {
      showToast(payload.reason || "Không vào được phòng");
      if (payload.reason?.includes("khóa") || payload.reason?.includes("hết hạn")) {
        clearSession();
        setMe(null);
        setSessionAuthed(false);
      }
    });

    s.on("sessionReplaced", (payload: { reason?: string }) => {
      showToast(payload.reason || "Phiên đã bị thay thế");
      if (payload.reason?.includes("khóa") || payload.reason?.includes("Mật khẩu")) {
        clearSession();
        setMe(null);
        setSessionAuthed(false);
      }
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
      if (!getStoredUser()) setGuestBalanceHint(payload.balance);
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

    s.on("shout", (payload: ShoutEvent) => {
      setChatLines((prev) => [...prev, payload].slice(-24));
      const isVipFly = !!(payload.fly || payload.mode === "vip");
      const isSaint = !!(payload.saint || payload.mode === "saint");
      if (isSaint) {
        const key = `saint${++shoutKeyRef.current}`;
        if (saintTimerRef.current != null) {
          window.clearTimeout(saintTimerRef.current);
        }
        setSaintItem({ ...payload, key });
        saintTimerRef.current = window.setTimeout(() => {
          saintTimerRef.current = null;
          setSaintItem((prev) => (prev?.key === key ? null : prev));
        }, SAINT_DISPLAY_MS);
        return;
      }
      if (!isVipFly) return;
      const key = `s${++shoutKeyRef.current}`;
      setShouts((prev) => [...prev, { ...payload, key }].slice(-3));
      window.setTimeout(() => {
        setShouts((prev) => prev.filter((x) => x.key !== key));
      }, 4800);
    });

    return () => {
      if (saintTimerRef.current != null) {
        window.clearTimeout(saintTimerRef.current);
        saintTimerRef.current = null;
      }
      s.disconnect();
    };
  }, [showToast]);

  useEffect(() => {
    if (state?.chatLines) {
      setChatLines(state.chatLines);
    }
  }, [state?.chatLines]);

  // Đồng bộ VIP / số ván / ID từ phòng (admin đổi hoặc đủ 10k ván)
  useEffect(() => {
    if (!me?.id || !state?.onlinePlayers) return;
    const self = state.onlinePlayers.find((p) => p.userId === me.id);
    if (!self) return;
    const nextVip = self.isVip != null ? !!self.isVip : !!me.isVip;
    const nextRounds = self.roundsPlayed ?? me.roundsPlayed ?? 0;
    const nextGranted = self.vipGranted ?? me.vipGranted ?? false;
    const nextCode = self.code ?? me.code;
    if (
      nextVip === !!me.isVip &&
      nextRounds === (me.roundsPlayed ?? 0) &&
      nextGranted === !!me.vipGranted &&
      nextCode === me.code
    ) {
      return;
    }
    const next = {
      ...me,
      isVip: nextVip,
      roundsPlayed: nextRounds,
      vipGranted: nextGranted,
      code: nextCode,
    };
    setMe(next);
    const token = getToken();
    if (token) saveSession(token, next);
    if (!next.isVip) setChatMode((m) => (m === "vip" ? "no" : m));
  }, [me, state?.onlinePlayers]);

  // Popup đang mở: cập nhật ID/VIP khi phòng refresh (admin vừa đổi)
  useEffect(() => {
    const online = state?.onlinePlayers;
    if (!online?.length) return;
    setProfile((prev) => {
      if (!prev) return prev;
      const match = online.find((p) =>
        prev.userId
          ? p.userId === prev.userId
          : p.name === prev.name && p.avatar === prev.avatar,
      );
      if (!match) return prev;
      const next: PlayerInfoView = {
        ...prev,
        code: match.code ?? prev.code,
        isVip: match.isVip ?? prev.isVip,
        vipGranted: match.vipGranted ?? prev.vipGranted,
        roundsPlayed: match.roundsPlayed ?? prev.roundsPlayed,
        userId: match.userId ?? prev.userId,
        winToday: match.winToday ?? prev.winToday,
        guessesToday: match.guessesToday ?? prev.guessesToday,
        balance: match.balance ?? prev.balance,
        outcomeMode: match.outcomeMode ?? prev.outcomeMode,
        isBot: match.isBot,
        isGuest: !match.isBot && !match.code && !match.userId,
      };
      if (
        next.code === prev.code &&
        next.isVip === prev.isVip &&
        next.vipGranted === prev.vipGranted &&
        next.roundsPlayed === prev.roundsPlayed &&
        next.userId === prev.userId &&
        next.winToday === prev.winToday &&
        next.guessesToday === prev.guessesToday &&
        next.balance === prev.balance &&
        next.outcomeMode === prev.outcomeMode &&
        next.isGuest === prev.isGuest
      ) {
        return prev;
      }
      return next;
    });
  }, [state?.onlinePlayers]);

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

  const runAutoPlace = useCallback(
    async (cfg: AutoBetConfig, roundId: number) => {
      if (!socket || !connected || !state) return;
      if (state.phase !== "betting") return;
      if (!cfg.enabled || cfg.slots.length === 0) return;
      if (autoRoundRef.current === roundId) return;
      if (state.yourBalance == null || !Number.isFinite(state.yourBalance)) {
        return;
      }

      // Khóa ngay để tránh double-fire khi state cập nhật
      autoRoundRef.current = roundId;

      const bets = [...(state.yourBets ?? [])];
      let balance = state.yourBalance;
      let placed = 0;
      let lastError: string | null = null;

      for (const slot of cfg.slots) {
        const idx = slot.cardId - 1;
        const current = bets[idx] ?? 0;
        const need = Math.max(0, slot.amount - current);
        if (need <= 0) continue;
        if (balance < need) {
          lastError = "Số dư không đủ cho Auto — nạp xu hoặc giảm preset";
          continue;
        }

        const result = await new Promise<{
          ok?: boolean;
          reason?: string;
          balance?: number;
        }>((resolve) => {
          socket.emit(
            "placeBet",
            { cardId: slot.cardId, amount: need, roundId },
            (r?: { ok?: boolean; reason?: string; balance?: number }) => {
              resolve(r ?? { ok: false, reason: "Không phản hồi" });
            },
          );
        });

        if (!result.ok) {
          lastError = result.reason || "Đặt thất bại";
          continue;
        }
        placed += 1;
        bets[idx] = current + need;
        if (typeof result.balance === "number") balance = result.balance;
        else balance -= need;
      }

      if (placed > 0) {
        showToast(`Auto: đã đặt ${placed} lá`);
      } else if (lastError) {
        showToast(`Auto: ${lastError}`);
        // Không clear ref — tránh spam toast; bật lại Auto (Lưu) để thử lại
      }
    },
    [socket, connected, state, showToast],
  );

  // Auto đặt khi vào betting / khi bật Auto giữa ván
  useEffect(() => {
    if (!state || state.phase !== "betting") return;
    void runAutoPlace(autoBet, state.roundId);
  }, [
    state?.phase,
    state?.roundId,
    state?.yourBalance,
    autoBet,
    runAutoPlace,
  ]);

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

  const openCoupon = () => {
    if (!me) {
      showToast("Đăng nhập để nạp");
      return;
    }
    setSheet("coupon");
  };

  const openVipTopups = async () => {
    setSheet("vipTopups");
    setTopupBusy(true);
    try {
      const r = await api<{
        ok: true;
        totalXu: number;
        rows: TopupRow[];
      }>("/api/topups");
      setTopupRows(r.rows ?? []);
      setTopupTotalXu(r.totalXu ?? 0);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không tải được danh sách nạp");
      setTopupRows([]);
      setTopupTotalXu(0);
    } finally {
      setTopupBusy(false);
    }
  };

  const redeemCoupon = async (code: string) => {
    setCouponBusy(true);
    try {
      const r = await api<{
        ok: true;
        amount: number;
        user: AuthUser;
        message: string;
      }>("/api/auth/redeem-coupon", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const token = getToken();
      if (token) saveSession(token, r.user);
      setMe(r.user);
      setState((prev) =>
        prev ? { ...prev, yourBalance: r.user.balance } : prev,
      );
      showToast(r.message || `Đã nạp +${formatXu(r.amount)} xu`);
      setSheet(null);
    } finally {
      setCouponBusy(false);
    }
  };

  const enrichPlayerInfo = useCallback(
    (partial: PlayerInfoView): PlayerInfoView => {
      const online = state?.onlinePlayers ?? [];
      const match = online.find((p) =>
        partial.userId
          ? p.userId === partial.userId
          : p.name === partial.name && p.avatar === partial.avatar,
      );
      if (!match) {
        return {
          ...partial,
          isGuest:
            partial.isGuest ??
            (!partial.isBot && !partial.code && !partial.userId),
        };
      }
      return {
        ...partial,
        name: match.name || partial.name,
        avatar: match.avatar || partial.avatar,
        isBot: match.isBot,
        code: match.code ?? partial.code,
        winToday: match.winToday ?? partial.winToday,
        guessesToday: match.guessesToday ?? partial.guessesToday,
        userId: match.userId ?? partial.userId,
        balance: match.balance ?? partial.balance,
        outcomeMode: match.outcomeMode ?? partial.outcomeMode,
        isVip: match.isVip ?? partial.isVip,
        roundsPlayed: match.roundsPlayed ?? partial.roundsPlayed,
        vipGranted: match.vipGranted ?? partial.vipGranted,
        isGuest: !match.isBot && !match.code && !match.userId,
      };
    },
    [state?.onlinePlayers],
  );

  const openPlayerInfo = useCallback(
    (info: PlayerInfoView) => {
      setProfile(enrichPlayerInfo(info));
      setSheet("playerInfo");
    },
    [enrichPlayerInfo],
  );

  const openOnlinePlayer = useCallback(
    (p: OnlinePlayerPublic) => {
      openPlayerInfo({
        name: p.name,
        avatar: p.avatar,
        isBot: p.isBot,
        code: p.code,
        winToday: p.winToday,
        guessesToday: p.guessesToday,
        isGuest: !p.isBot && !p.code && !p.userId,
        userId: p.userId,
        balance: p.balance,
        outcomeMode: p.outcomeMode,
        isVip: p.isVip,
        roundsPlayed: p.roundsPlayed,
        vipGranted: p.vipGranted,
      });
    },
    [openPlayerInfo],
  );

  const openChatPlayer = useCallback(
    (line: ShoutEvent) => {
      openPlayerInfo({
        name: line.name,
        avatar: line.avatar,
      });
    },
    [openPlayerInfo],
  );

  const adminSetOutcome = async (
    userId: string,
    mode: "normal" | "win" | "lose",
  ) => {
    setAdminBusy(true);
    try {
      const r = await api<{
        ok: true;
        user: AuthUser & { outcomeMode?: "normal" | "win" | "lose" };
      }>("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({ userId, mode }),
      });
      setProfile((prev) =>
        prev && prev.userId === userId
          ? { ...prev, outcomeMode: r.user.outcomeMode ?? mode }
          : prev,
      );
      showToast(
        mode === "win"
          ? "Đã set WIN"
          : mode === "lose"
            ? "Đã set LOSE"
            : "Đã về Normal",
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setAdminBusy(false);
    }
  };

  const adminSetVip = async (userId: string, isVip: boolean) => {
    setAdminBusy(true);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/admin/user-vip", {
        method: "POST",
        body: JSON.stringify({ userId, isVip }),
      });
      setProfile((prev) =>
        prev && prev.userId === userId
          ? {
              ...prev,
              isVip: !!r.user.isVip,
              vipGranted: !!r.user.vipGranted,
              roundsPlayed: r.user.roundsPlayed ?? prev.roundsPlayed,
            }
          : prev,
      );
      if (me?.id === userId) {
        setMe(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
        if (!r.user.isVip) setChatMode((m) => (m === "vip" ? "no" : m));
      }
      showToast(
        r.user.vipGranted
          ? "Đã cấp VIP (admin)"
          : r.user.isVip
            ? "Đã tắt cấp admin — vẫn VIP do đủ ván"
            : "Đã tắt VIP admin",
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setAdminBusy(false);
    }
  };

  const adminAdjustBalance = async (userId: string, delta: number) => {
    setAdminBusy(true);
    try {
      const r = await api<{ ok: true; user: AuthUser }>(
        "/api/admin/adjust-balance",
        {
          method: "POST",
          body: JSON.stringify({ userId, delta }),
        },
      );
      setProfile((prev) =>
        prev && prev.userId === userId
          ? { ...prev, balance: r.user.balance }
          : prev,
      );
      if (me?.id === userId) {
        setMe(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
        setState((prev) =>
          prev ? { ...prev, yourBalance: r.user.balance } : prev,
        );
      }
      showToast(
        `${delta > 0 ? "+" : ""}${formatXu(delta)} → ${formatXu(r.user.balance)} xu`,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setAdminBusy(false);
    }
  };

  const sendChat = (payload: { id?: string; text?: string }) => {
    if (!socket || !connected) return;
    const token = getToken();
    if (!me || !token) {
      showToast("Cần đăng nhập để chat");
      return;
    }
    let mode: ChatMode = chatMode;
    if (mode === "vip" && !me.isVip) {
      showToast("Cần VIP để chat bay");
      mode = "no";
      setChatMode("no");
    }
    setShoutBusy(true);
    socket.emit(
      "sendShout",
      { ...payload, token, mode },
      (r?: { ok: boolean; reason?: string; balance?: number }) => {
        setShoutBusy(false);
        if (!r?.ok) {
          showToast(r?.reason || "Không gửi được");
          return;
        }
        setSessionAuthed(true);
        if (r.balance != null) {
          setState((prev) =>
            prev ? { ...prev, yourBalance: r.balance } : prev,
          );
        }
      },
    );
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

  const openMyBets = () => {
    setSheet("myBets");
    setMyBetsError(null);
    if (!getToken() || !getStoredUser()) {
      setMyBets([]);
      setMyBetsLoading(false);
      return;
    }
    setMyBetsLoading(true);
    api<{ ok: true; bets: BetEntry[] }>("/api/auth/bets?limit=50")
      .then((r) => setMyBets(r.bets))
      .catch((e) =>
        setMyBetsError(
          e instanceof Error ? e.message : "Không tải được lịch sử",
        ),
      )
      .finally(() => setMyBetsLoading(false));
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

  // Cập nhật snapshot trong lúc betting; giữ khi mở bài / trả thưởng
  useEffect(() => {
    if (!state || state.phase !== "betting") return;
    const bets = state.yourBets ?? [];
    const next = CARDS.filter((c) => (bets[c.id - 1] ?? 0) > 0).map((c) => ({
      cardId: c.id,
      amount: bets[c.id - 1] ?? 0,
    }));
    setPickedSnapshot(next);
  }, [state?.phase, state?.yourBets, state?.roundId]);

  const displayPicked = useMemo(() => {
    type Row = {
      card: (typeof CARDS)[number];
      amount: number;
      pending?: boolean;
    };
    const phase = state?.phase;
    if (phase !== "betting") {
      return pickedSnapshot
        .map(({ cardId, amount }) => {
          const card = CARDS.find((c) => c.id === cardId);
          return card ? ({ card, amount } satisfies Row) : null;
        })
        .filter((x): x is Row => !!x);
    }

    const bets = state?.yourBets ?? [];
    const live = CARDS.filter((c) => (bets[c.id - 1] ?? 0) > 0).map((c) => ({
      card: c,
      amount: bets[c.id - 1] ?? 0,
      pending: false as boolean,
    }));

    // Auto ON: hiện preset nếu chưa có cược live (hoặc bổ sung slot pending)
    if (autoBet.enabled && autoBet.slots.length > 0) {
      if (live.length === 0) {
        return autoBet.slots
          .map((s) => {
            const card = CARDS.find((c) => c.id === s.cardId);
            return card
              ? ({ card, amount: s.amount, pending: true } satisfies Row)
              : null;
          })
          .filter((x): x is Exclude<typeof x, null> => x != null);
      }
      const liveIds = new Set(live.map((r) => r.card.id));
      const pending = autoBet.slots
        .filter((s) => !liveIds.has(s.cardId))
        .map((s) => {
          const card = CARDS.find((c) => c.id === s.cardId);
          return card
            ? ({ card, amount: s.amount, pending: true } satisfies Row)
            : null;
        })
        .filter((x): x is Exclude<typeof x, null> => x != null);
      return [...live, ...pending].slice(0, 5);
    }

    return live;
  }, [
    state?.phase,
    state?.yourBets,
    pickedSnapshot,
    autoBet.enabled,
    autoBet.slots,
  ]);

  return (
    <div className="app-shell play-screen relative h-dvh overflow-y-auto overflow-x-hidden">
      <div className="app-shell-deco" aria-hidden />
      <ShoutMarquee items={shouts} />
      <SaintOverlay
        item={saintItem}
        onDismiss={() => {
          if (saintTimerRef.current != null) {
            window.clearTimeout(saintTimerRef.current);
            saintTimerRef.current = null;
          }
          setSaintItem(null);
        }}
      />
      <div className="relative z-[1] mx-auto flex w-full max-w-md flex-col px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* ===== ZONE 1: Hồ sơ & số dư (per-user) ===== */}
        <header className="game-task flex flex-col gap-2 px-2.5 py-2.5">
          <div className="flex items-center gap-2">
            <Link
              to={
                getStoredUser() ? homePath(getStoredUser()) : "/login"
              }
              className="app-btn-ghost shrink-0 px-2.5 py-1 text-[10px]"
            >
              ← Menu
            </Link>
            <img
              src="/assets/logo/logo-tarot.png"
              alt="SOFIAORE-TAROT"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <h1 className="play-heading truncate text-base leading-tight tracking-wide sm:text-lg">
                SOFIAORE-TAROT
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setSheet("rules")}
              className="app-btn-ghost shrink-0 px-2 py-1 text-[10px]"
              title="Luật chơi"
            >
              Luật
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="app-btn-ghost shrink-0 px-2 py-1 text-[10px]"
              title={muted ? "Bật tiếng" : "Tắt tiếng"}
            >
              {muted ? "Tắt" : "Âm"}
            </button>
          </div>
          {!!(getToken() && getStoredUser() && !sessionAuthed) && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-rose-500/15 px-2.5 py-2 ring-1 ring-rose-400/40">
              <p className="text-[11px] font-semibold text-rose-100">
                Phiên đăng nhập hết hạn — vào lại để chat, nạp xu và lưu lịch sử cược.
              </p>
              <button
                type="button"
                className="shrink-0 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white"
                onClick={() => {
                  clearSession();
                  nav("/login");
                }}
              >
                Đăng nhập
              </button>
            </div>
          )}
          <div className="relative" ref={renameRef}>
            <IdentityBadge
              user={me}
              guestCode={me ? null : getGuestCode() || ensureGuestCode()}
              guestName={me ? null : name}
              guestAvatar={me ? null : guestAvatar}
              compact
              showPath={false}
              onAvatarClick={openAvatarPicker}
              onNameClick={
                me
                  ? undefined
                  : () => {
                      setRenameDraft(name);
                      setRenameOpen((v) => !v);
                    }
              }
            />
            {me && !me.isVip && (
              <p className="mt-1 px-0.5 text-[10px] font-semibold tabular-nums text-amber-200/90">
                VIP {(me.roundsPlayed ?? 0).toLocaleString("vi-VN")}/
                {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván
              </p>
            )}
            {me?.isVip && (
              <p className="mt-1 px-0.5 text-[10px] font-extrabold text-amber-300">
                VIP
              </p>
            )}
            <p
              className="mt-1 px-0.5 text-[10px] font-semibold tabular-nums text-[var(--play-muted)]"
              title="Thời gian chơi (chỉ đếm khi tab đang mở)"
            >
              Đã chơi {formatDuration(sessionMs)} · Hôm nay{" "}
              {formatDuration(dayMs)}
            </p>
            {!me && renameOpen && (
              <form
                className="absolute left-10 right-0 top-[calc(100%-0.15rem)] z-30 flex gap-1 rounded-xl bg-[rgba(232,250,245,0.97)] p-1.5 shadow-lg ring-1 ring-[var(--jade)]/45 backdrop-blur-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  const raw = renameDraft.trim().slice(0, 16);
                  if (raw.length < 2) {
                    showToast("Tên 2–16 ký tự");
                    return;
                  }
                  setGuestName(raw);
                  setName(raw);
                  socket?.emit(
                    "setName",
                    { name: raw },
                    (r?: { ok?: boolean; reason?: string; name?: string }) => {
                      if (!r?.ok) {
                        showToast(r?.reason || "Không đổi tên được");
                        return;
                      }
                      if (r.name) {
                        setName(r.name);
                        setGuestName(r.name);
                        setRenameDraft(r.name);
                      }
                      setRenameOpen(false);
                      showToast("Đã đổi tên");
                    },
                  );
                }}
              >
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value.slice(0, 16))}
                  maxLength={16}
                  placeholder="Tên khách…"
                  className="app-input !px-2 !py-1.5 text-[11px]"
                />
                <button
                  type="submit"
                  className="app-btn-secondary shrink-0 !rounded-lg !px-2.5 !py-1.5 !text-[10px]"
                >
                  Đổi
                </button>
              </form>
            )}
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
              <div className="ui-pill flex items-center gap-1 px-2.5 py-1 !text-[var(--play-ink)]">
                <img
                  src="/assets/ui/icon-coin-xu.png"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
                <span className="font-play text-xs font-bold text-amber-800 tabular-nums">
                  {formatXu(balance)}
                </span>
              </div>
              <button
                type="button"
                onClick={openCoupon}
                className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                  balance <= 0
                    ? "animate-pulse rounded-full bg-rose-500 text-white ring-1 ring-rose-300"
                    : "ui-pill ui-pill--strong"
                }`}
              >
                Nạp!
              </button>
              <button
                type="button"
                title="Danh sách người đã nạp xu"
                onClick={() => void openVipTopups()}
                className="ui-pill ui-pill--deep flex items-center gap-1 px-2 py-1"
              >
                <img
                  src="/assets/ui/icon-vip.png"
                  alt=""
                  className="h-3.5 w-3.5 rounded-full object-cover"
                />
                <span className="font-play text-[9px] font-semibold text-amber-200 tabular-nums">
                  VIP {formatXu(state?.vipPool ?? 0)}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* ===== ZONE 2: Đồng bộ phòng — bấm mở list người chơi ===== */}
        <button
          type="button"
          onClick={() => connected && setSheet("players")}
          disabled={!connected}
          className="game-task mt-2 flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-[var(--play-muted)] disabled:opacity-60"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              connected ? "ui-live-dot" : "bg-rose-400"
            }`}
            aria-hidden
          />
          <span className="flex-1 font-semibold text-[var(--play-ink)]">
            {connected
              ? `${state?.onlineDisplay ?? 0} online`
              : "Mất kết nối"}
          </span>
          {connected && (
            <span className="text-[10px] font-semibold text-[var(--wood-deep)]">›</span>
          )}
        </button>

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
                  className="relative h-12 w-9 shrink-0 overflow-hidden rounded shadow ring-1 ring-[var(--gold)]/35"
                  title={card ? `#${card.id} ${card.nameVi}` : `#${row.win}`}
                >
                  <img
                    src={card?.image}
                    alt={card?.nameVi ?? `#${row.win}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="font-play absolute left-0.5 top-0.5 z-[1] rounded bg-[var(--wood-deep)]/92 px-1 text-[9px] font-bold leading-tight text-[var(--gold-soft)] tabular-nums shadow-sm">
                    {row.win}
                  </span>
                </span>
              );
            })}
          </div>
        </button>

        {/* ===== ZONE 4+6: Form bàn cược (deck) ===== */}
        <BettingBoard
          remaining={remaining}
          canBet={canBet}
          playerCounts={state?.playerCounts ?? []}
          yourBets={state?.yourBets ?? []}
          winningCardId={winning}
          phase={state?.phase ?? null}
          onPick={openBet}
        />

        {/* ===== ZONE 5: Lá bài đã chọn — khung cứng cố định ===== */}
        <section className="game-task mt-3 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="play-section-title min-w-0 truncate">
              Lá bài bạn đã chọn
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openMyBets}
                className="app-btn-soft !px-2.5 !py-0.5 !text-[10px] font-extrabold uppercase tracking-wide"
                title="Lịch sử thắng/thua của bạn"
              >
                Lịch sử
              </button>
              <button
                type="button"
                onClick={() => setSheet("autoBet")}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  autoBet.enabled
                    ? "ui-pill ui-pill--strong"
                    : "app-btn-soft !px-2.5 !py-0.5 !text-[10px]"
                }`}
                title="Cấu hình tự động đặt lá"
              >
                Auto{autoBet.enabled ? " · ON" : ""}
              </button>
            </div>
          </div>
          <div className="grid h-[4.75rem] grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }, (_, i) => {
              const item = displayPicked[i];
              if (!item) {
                return (
                  <div
                    key={`slot-${i}`}
                    className="flex flex-col items-center justify-center rounded-lg bg-[var(--wood-deep)]/6 ring-1 ring-dashed ring-[var(--wood-deep)]/18"
                  >
                    <span className="text-[9px] font-semibold text-[var(--play-muted)]/45">
                      {i + 1}
                    </span>
                  </div>
                );
              }
              const isWin =
                (state?.phase === "revealing" || state?.phase === "payout") &&
                winning != null &&
                item.card.id === winning;
              const pending = !!(item as { pending?: boolean }).pending;
              return (
                <div
                  key={item.card.id}
                  className={`ui-chip flex min-w-0 flex-col items-center gap-0.5 !px-1 !py-1 ${
                    isWin
                      ? "ring-2 ring-[var(--jade)]/70"
                      : pending
                        ? "ring-dashed ring-[var(--jade)]/45 opacity-80"
                        : "ring-amber-400/40"
                  }`}
                >
                  <img
                    src={item.card.image}
                    alt=""
                    className="h-10 w-[1.85rem] rounded object-cover"
                  />
                  <p className="font-play max-w-full truncate text-[9px] font-semibold text-amber-700 tabular-nums">
                    {pending ? "~" : ""}
                    {formatXu(item.amount)}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-1 h-4 text-center text-[10px] text-[var(--play-muted)]">
            {displayPicked.length === 0
              ? autoBet.enabled
                ? `Auto ON · ${autoBet.slots.length} lá preset`
                : "Chạm lá trên bàn để đặt"
              : state?.phase === "betting"
                ? `${displayPicked.length}/5 lá`
                : "Giữ nguyên tới ván sau"}
          </p>
        </section>

        <ShoutBar
          disabled={!connected || !sessionAuthed}
          busy={shoutBusy}
          lines={chatLines}
          selfAvatar={
            me
              ? normalizeAvatar(me.avatar)
              : normalizeAvatar(guestAvatar)
          }
          chatLive={connected && sessionAuthed}
          isVip={!!me?.isVip}
          mode={chatMode}
          onModeChange={(m) => {
            if (m === "vip" && !me?.isVip) {
              showToast("Cần VIP để chat bay");
              return;
            }
            setChatMode(m);
          }}
          needRelogin={!!(getToken() && getStoredUser() && !sessionAuthed)}
          onRelogin={() => {
            clearSession();
            nav("/login");
          }}
          onSendSlang={(id) => sendChat({ id })}
          onSendText={(text) => sendChat({ text })}
          onAvatarClick={openChatPlayer}
          onReport={async (line) => {
            if (!sessionAuthed) {
              showToast("Đăng nhập để báo cáo");
              return;
            }
            try {
              await api("/api/chat/report", {
                method: "POST",
                body: JSON.stringify({
                  text: line.text,
                  targetName: line.name,
                  mode: line.mode,
                }),
              });
              showToast("Đã gửi báo cáo");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Lỗi báo cáo");
            }
          }}
        />

        {/* ===== ZONE 7: Cao thủ — gọn, đủ thông tin ===== */}
        <section className="game-task game-task-aces mt-3">
          <button
            type="button"
            onClick={openLeaderboard}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="play-heading text-sm sm:text-base">
              Cao thủ dự đoán ›
            </p>
            <span className="text-[10px] font-medium text-white/45">
              Vòng trước
            </span>
          </button>

          <ul className="mt-1.5 space-y-1">
            {(state?.topAces ?? []).length === 0 && (
              <li className="rank-row--empty py-3 text-center text-[11px] text-white/40">
                Chưa có ai thắng vòng trước
              </li>
            )}
            {(state?.topAces ?? []).slice(0, 3).map((ace) => (
              <li
                key={`${ace.rank}-${ace.name}`}
                className={`rank-row flex items-center gap-1.5 px-1.5 py-1 ${
                  ace.isYou ? "rank-row--you" : ""
                }`}
              >
                <span className="font-play w-4 shrink-0 text-center text-xs font-bold text-[var(--gold-soft)] tabular-nums">
                  {ace.rank}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    openPlayerInfo({
                      name: ace.name,
                      avatar: ace.avatar,
                      winToday: ace.winToday,
                    })
                  }
                  className="shrink-0"
                  title="Xem thông tin"
                >
                  <img
                    src={ace.avatar}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-white/25"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold leading-tight text-white">
                    {ace.name}
                    {ace.isYou ? " ·Bạn" : ""}
                  </p>
                  <p className="text-[10px] font-semibold leading-tight text-amber-300/90 tabular-nums">
                    +{formatXu(ace.winToday)}
                  </p>
                </div>
                <div className="flex max-w-[42%] shrink-0 gap-0.5 overflow-x-auto">
                  {ace.chosenCards.length === 0 ? (
                    <span className="px-1 text-[9px] text-white/35">—</span>
                  ) : (
                    ace.chosenCards.map((pick) => {
                      const card = CARDS.find((c) => c.id === pick.cardId);
                      if (!card) return null;
                      return (
                        <div
                          key={pick.cardId}
                          className="rank-thumb relative shrink-0 overflow-hidden"
                          title={`${card.nameVi}: ${formatXu(pick.amount)} xu`}
                        >
                          <img
                            src={card.image}
                            alt={card.nameVi}
                            className="h-8 w-[1.35rem] object-cover"
                          />
                          <span
                            className="pointer-events-none absolute inset-0 bg-black/35"
                            aria-hidden
                          />
                          <span className="ace-card-num font-play absolute inset-0 flex items-center justify-center text-[11px] font-extrabold leading-none tabular-nums">
                            {card.id}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ===== ZONE 8: Sao bài Tarot — xu dùng dự đoán tuần ===== */}
        <section className="game-task game-task-stars mt-4">
          <button
            type="button"
            onClick={openTarotStars}
            className="flex w-full flex-col text-left"
          >
            <p className="play-heading text-base sm:text-lg">Sao bài Tarot ›</p>
            <p className="mt-0.5 text-[11px] text-[var(--cream)]/55">
              Xếp hạng theo số xu dùng dự đoán mỗi tuần
            </p>
          </button>

          <ul className="mt-2 space-y-1.5">
            {(state?.tarotStars ?? []).length === 0 && (
              <li className="rank-row--empty py-4 text-center text-[11px] text-[var(--cream)]/40">
                Chưa có xu dự đoán tuần này
              </li>
            )}
            {(state?.tarotStars ?? []).slice(0, 3).map((star) => (
              <li
                key={`${star.rank}-${star.name}`}
                className={`rank-row flex items-center gap-2 px-2 py-1.5 ${
                  star.isYou ? "rank-row--you" : ""
                }`}
              >
                <span className="font-play w-5 shrink-0 text-center text-sm font-bold text-[var(--gold-soft)] tabular-nums">
                  {star.rank}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    openPlayerInfo({
                      name: star.name,
                      avatar: star.avatar,
                    })
                  }
                  className="shrink-0"
                  title="Xem thông tin"
                >
                  <img
                    src={star.avatar}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">
                    {star.name}
                    {star.isYou ? " ·Bạn" : ""}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300/90 tabular-nums">
                    <img
                      src="/assets/ui/icon-coin-xu.png"
                      alt=""
                      className="h-3.5 w-3.5 rounded-full object-cover"
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
      <PlayersSheet
        open={sheet === "players"}
        players={state?.onlinePlayers ?? []}
        onClose={() => setSheet(null)}
        onSelectPlayer={(p) => {
          setSheet(null);
          openOnlinePlayer(p);
        }}
      />
      <CouponSheet
        open={sheet === "coupon"}
        busy={couponBusy}
        onClose={() => setSheet(null)}
        onRedeem={redeemCoupon}
      />
      <VipTopupSheet
        open={sheet === "vipTopups"}
        loading={topupBusy}
        totalXu={topupTotalXu}
        rows={topupRows}
        onClose={() => setSheet(null)}
        onSelect={(row) => {
          setSheet(null);
          openPlayerInfo({
            name: row.name,
            avatar: row.avatar,
            userId: row.userId,
            code: row.code ?? undefined,
          });
        }}
      />
      <AutoBetSheet
        open={sheet === "autoBet"}
        initial={autoBet}
        onClose={() => setSheet(null)}
        onSave={(cfg) => {
          // Cho phép đặt lại ngay trong ván betting hiện tại khi bật/đổi preset
          if (cfg.enabled && state?.phase === "betting") {
            autoRoundRef.current = null;
          }
          setAutoBet(cfg);
          saveAutoBet(cfg);
          showToast(
            cfg.enabled
              ? state?.phase === "betting"
                ? `Auto ON · đang đặt ${cfg.slots.length} lá…`
                : `Auto ON · ${cfg.slots.length} lá (ván sau)`
              : "Đã tắt Auto",
          );
        }}
      />
      <PlayerInfoSheet
        open={sheet === "playerInfo"}
        player={profile}
        staff={isStaff(me)}
        busy={adminBusy}
        onClose={() => {
          setProfile(null);
          setSheet(null);
        }}
        onSetOutcome={adminSetOutcome}
        onSetVip={adminSetVip}
        onAdjustBalance={adminAdjustBalance}
      />

      <HistorySheet
        open={sheet === "history"}
        rows={historyRows}
        onClose={() => setSheet(null)}
      />
      <MyBetsSheet
        open={sheet === "myBets"}
        bets={myBets}
        loading={myBetsLoading}
        error={myBetsError}
        needsLogin={!getToken() || !me}
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
      <RulesSheet open={sheet === "rules"} onClose={() => setSheet(null)} />
      <AvatarPickerSheet
        open={sheet === "avatar"}
        current={me ? me.avatar : guestAvatar}
        busy={avatarBusy}
        onClose={() => setSheet(null)}
        onPick={pickAvatar}
        onUploadFile={uploadAvatarFile}
      />

      {playtimeNudge && (
        <PlaytimeNudge
          nudge={playtimeNudge}
          menuHref={me ? homePath(me) : "/login"}
          onContinue={dismissNudge}
        />
      )}

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
