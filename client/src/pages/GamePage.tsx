import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CARDS,
  formatXu,
  type BalanceLeaderboardEntry,
  type LevelLeaderboardEntry,
  type StakeEntry,
  type GameState,
  type LeaderboardEntry,
  type RoundResult,
  type TarotStarEntry,
} from "../cards";
import { mergeGameState } from "../lib/gameStateMerge";
import { PlayBoard } from "../components/PlayBoard";
import { StakeSheet } from "../components/StakeSheet";
import { HistorySheet } from "../components/HistorySheet";
import { MyRoundsSheet } from "../components/MyRoundsSheet";
import { LeaderboardSheet } from "../components/LeaderboardSheet";
import { BalanceLeaderboardSheet } from "../components/BalanceLeaderboardSheet";
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
  AutoStakeSheet,
  clampAutoStake,
  loadAutoStake,
  saveAutoStake,
  type AutoStakeConfig,
} from "../components/AutoStakeSheet";
import { DEFAULT_MAX_CARDS_PER_ROUND } from "../tableConfig";
import { GiftHubSheet, type GiftHubTarget } from "../components/GiftHubSheet";
import {
  RingHubSheet,
  RingProposeSheet,
  type RingHubTarget,
} from "../components/RingHubSheet";
import type { UserBondSnippet } from "../rings";
import {
  GiftFlyOverlay,
  type GiftFlyQueueItem,
} from "../components/GiftFlyOverlay";
import { findDemoGift, type GiftFlyEvent } from "../gifts";
import { ShoutBar } from "../components/ShoutBar";
import { ShoutMarquee } from "../components/ShoutMarquee";
import { SaintOverlay } from "../components/SaintOverlay";
import { TarotStarsSheet } from "../components/TarotStarsSheet";
import { StreakLeaderboardSheet } from "../components/StreakLeaderboardSheet";
import { RoundWinnersSheet } from "../components/RoundWinnersSheet";
import { LevelLeaderboardSheet } from "../components/LevelLeaderboardSheet";
import { RankBadge, zoneRowClass } from "../components/RankBadge";
import { RulesSheet } from "../components/RulesSheet";
import type { ChatMode, ShoutEvent } from "../shouts";
import { SAINT_DISPLAY_MS } from "../shouts";
import type { OnlinePlayerPublic } from "../cards";
import { ensureCultivationColors } from "../cultivation";
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
  isBalanceOperator,
  isStaff,
  canSeeOnline,
  saveSession,
  userDisplayName,
  userShowsVip,
  VIP_ROUNDS_REQUIRED,
  type AuthUser,
} from "../auth";
import {
  clearGuestBalanceAfterLimit,
  ensureGuestCode,
  getGuestAvatar,
  getGuestCode,
  getGuestBalanceHint,
  getGuestName,
  setGuestAvatar,
  setGuestBalanceHint,
  setGuestName,
} from "../guest";
import { normalizeAvatar } from "../avatars";
import { AvatarPickerSheet } from "../components/AvatarPickerSheet";
import { IdentityBadge } from "../components/IdentityBadge";
import { PlayToolsBar } from "../components/PlayToolsBar";
import { StaffNotiPopup } from "../components/StaffNotiPopup";
import { PlayRecentBar } from "../components/PlayRecentBar";
import { uploadAvatarFromFile } from "../uploadAvatar";
import { getDevicePayload } from "../device";
import { formatGem } from "../gem";
import { Link, useNavigate } from "react-router-dom";
import { usePlaySocket } from "../socket/PlaySocketContext";

type Sheet =
  | "stake"
  | "history"
  | "myStakes"
  | "leaderboard"
  | "balanceBoard"
  | "tarotStars"
  | "streak"
  | "roundWinners"
  | "levelBoard"
  | "avatar"
  | "players"
  | "coupon"
  | "playerInfo"
  | "vipTopups"
  | "autoStake"
  | "rules"
  | "giftHub"
  | "ringHub"
  | "ringPropose"
  | null;

export default function GamePage() {
  const nav = useNavigate();
  const playSock = usePlaySocket();
  const socket = playSock.socket;
  const connected = playSock.connected;
  const me = playSock.me;
  const setMe = playSock.setMe;
  const sessionAuthed = playSock.sessionAuthed;
  const setSessionAuthed = playSock.setSessionAuthed;
  const voiceStatus = playSock.voiceStatus;
  const [name, setName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef<HTMLDivElement>(null);
  const [stakeLimits, setStakeLimits] = useState<{
    maxStakePerCard: number;
    quickAdds: number[];
  }>({
    maxStakePerCard: 1_000_000,
    quickAdds: [10, 100, 1_000, 10_000, 100_000, 1_000_000],
  });
  const [guestAvatar, setGuestAvatarState] = useState(() => getGuestAvatar());
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [stakeCardId, setStakeCardId] = useState<number | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<RoundResult[]>([]);
  const [myStakes, setMyStakes] = useState<StakeEntry[]>([]);
  const [myStakesLoading, setMyStakesLoading] = useState(false);
  const [myStakesError, setMyStakesError] = useState<string | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>(
    [],
  );
  const [balanceBoardRows, setBalanceBoardRows] = useState<
    BalanceLeaderboardEntry[]
  >([]);
  const [levelBoardRows, setLevelBoardRows] = useState<LevelLeaderboardEntry[]>(
    [],
  );
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftPreset, setGiftPreset] = useState<GiftHubTarget | null>(null);
  const [giftFlyQueue, setGiftFlyQueue] = useState<GiftFlyQueueItem[]>([]);
  const [ringBusy, setRingBusy] = useState(false);
  const [ringPreset, setRingPreset] = useState<RingHubTarget | null>(null);
  const [pendingBondId, setPendingBondId] = useState<string | null>(null);
  const [pendingIsProposee, setPendingIsProposee] = useState(false);
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
  const [autoStake, setAutoStake] = useState<AutoStakeConfig>(() => loadAutoStake());
  const autoRoundRef = useRef<number | null>(null);
  const [profile, setProfile] = useState<PlayerInfoView | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
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

  const staffViewer = isStaff(me);
  const onlineViewer = canSeeOnline(me);
  const staffViewerRef = useRef(staffViewer);
  const onlineViewerRef = useRef(onlineViewer);
  staffViewerRef.current = staffViewer;
  onlineViewerRef.current = onlineViewer;

  const lbFlags = {
    winToday: state?.leaderboardFlags?.winToday !== false,
    balance: state?.leaderboardFlags?.balance !== false,
    tarotStars: state?.leaderboardFlags?.tarotStars !== false,
    streak: state?.leaderboardFlags?.streak !== false,
    roundWinners: state?.leaderboardFlags?.roundWinners !== false,
    level: state?.leaderboardFlags?.level !== false,
  };
  const showLbWinToday = lbFlags.winToday || staffViewer;
  const showLbBalance = lbFlags.balance || staffViewer;
  const showLbTarotStars = lbFlags.tarotStars || staffViewer;
  const showLbStreak = lbFlags.streak || staffViewer;
  const showLbRoundWinners = lbFlags.roundWinners || staffViewer;
  const showLbLevel = lbFlags.level || staffViewer;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  const lastJackpotRoundRef = useRef<number | null>(null);
  const lastStreakAtRef = useRef(0);

  useEffect(() => {
    void ensureCultivationColors();
  }, []);

  useEffect(() => {
    const j = state?.lastJackpotWin;
    if (!j?.round) return;
    if (lastJackpotRoundRef.current === j.round) return;
    lastJackpotRoundRef.current = j.round;
    showToast(`Hũ Tarot · ${j.name} +${formatXu(j.amount)} xu`);
  }, [state?.lastJackpotWin, showToast]);

  useEffect(() => {
    const top = state?.streakHighlights?.[0];
    if (!top?.at || top.at === lastStreakAtRef.current) return;
    lastStreakAtRef.current = top.at;
    showToast(`${top.name} thắng ${top.streak} ván liên tiếp`);
  }, [state?.streakHighlights, showToast]);

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
    const s = socket;
    if (!s) return;

    const emitJoin = () => {
      const auth = getStoredUser();
      const token = getToken();
      const guestCode = ensureGuestCode();
      const saved = auth
        ? userDisplayName(auth)
        : getGuestName() ||
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
        guestBalance: auth ? undefined : getGuestBalanceHint(),
        ...getDevicePayload(),
      });
    };

    const onConnect = () => {
      void (async () => {
        const token = getToken();
        const stored = getStoredUser();
        if (token && stored) {
          try {
            const r = await api<{
              ok: true;
              user: AuthUser;
              stakeLimits?: { maxStakePerCard: number; quickAdds: number[] };
            }>("/api/auth/me");
            setMe(r.user);
            if (r.stakeLimits) setStakeLimits(r.stakeLimits);
            saveSession(token, r.user);
          } catch {
            clearSession();
            setMe(null);
            showToast(
              "Phiên đăng nhập hết hạn — đăng nhập lại để khôi phục xu ván này",
            );
            return;
          }
        }
        emitJoin();
      })();
    };

    const onDisconnect = () => {
      setSessionAuthed(false);
    };

    const onJoined = (payload: {
      name: string;
      balance: number;
      userId?: string;
      recoveredStakes?: boolean;
      guestPlayExpired?: boolean;
      guestPlayRemainingMs?: number;
    }) => {
      setName(payload.name);
      prevBalance.current = payload.balance;
      setSessionAuthed(!!payload.userId);
      if (!payload.userId) {
        setGuestBalanceHint(payload.balance);
        if (payload.guestPlayExpired) {
          clearGuestBalanceAfterLimit();
          showToast("Hết 20 phút chơi khách — xu reset về 20.000");
        }
      }
      if (payload.recoveredStakes) {
        showToast("Đã khôi phục xu ván đang chơi");
      }
      if (getToken() && getStoredUser() && !payload.userId) {
        showToast("Phiên hết hạn — đăng nhập lại để chat & lưu ván");
      }
      if (payload.userId && getToken()) {
        void api<{
          ok: true;
          user: AuthUser;
          stakeLimits?: { maxStakePerCard: number; quickAdds: number[] };
        }>("/api/auth/me")
          .then((r) => {
            setMe(r.user);
            if (r.stakeLimits) setStakeLimits(r.stakeLimits);
            const t = getToken();
            if (t) saveSession(t, r.user);
          })
          .catch(() => {});
      }
      s.emit("getBalanceLeaderboard");
    };

    const onJoinRejected = (payload: { reason?: string }) => {
      showToast(payload.reason || "Không vào được phòng");
      if (payload.reason?.includes("khóa") || payload.reason?.includes("hết hạn")) {
        clearSession();
        setMe(null);
        setSessionAuthed(false);
      }
    };

    const onSessionReplaced = (payload: { reason?: string }) => {
      showToast(payload.reason || "Phiên đã bị thay thế");
      if (payload.reason?.includes("khóa") || payload.reason?.includes("Mật khẩu")) {
        clearSession();
        setMe(null);
        setSessionAuthed(false);
      }
    };

    const onState = (payload: GameState) => {
      setState((prev) =>
        mergeGameState(prev, payload, {
          trackOnlinePlayers: onlineViewerRef.current,
        }),
      );
    };

    const onStakeRejected = (payload: { reason: string }) => {
      showToast(payload.reason);
    };

    const onBalanceUpdate = (payload: { balance: number }) => {
      setState((prev) =>
        prev ? { ...prev, yourBalance: payload.balance } : prev,
      );
      if (!getStoredUser()) setGuestBalanceHint(payload.balance);
    };

    const onHistoryData = (rows: RoundResult[]) => {
      setHistoryRows(rows);
    };

    const onLeaderboardData = (rows: LeaderboardEntry[]) => {
      setLeaderboardRows(rows);
    };

    const onBalanceLeaderboardData = (rows: BalanceLeaderboardEntry[]) => {
      setBalanceBoardRows(rows);
    };

    const onLevelLeaderboardData = (rows: LevelLeaderboardEntry[]) => {
      setLevelBoardRows(rows);
    };

    const onTarotStarsData = (rows: TarotStarEntry[]) => {
      setTarotStarRows(rows);
    };

    const onShout = (payload: ShoutEvent) => {
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
    };

    const onGiftReceived = (payload: {
      amount?: number;
      fromName?: string;
      giftKey?: string;
      giftEmoji?: string;
      giftNameVi?: string;
      note?: string;
    }) => {
      // Fly overlay covers most styles; keep a brief recipient toast for toast-tier or missing fly.
      const gift = payload.giftKey ? findDemoGift(payload.giftKey) : undefined;
      const label =
        payload.giftEmoji && payload.giftNameVi
          ? `${payload.giftEmoji} ${payload.giftNameVi}`
          : gift
            ? `${gift.emoji} ${gift.nameVi}`
            : `${formatXu(payload.amount ?? 0)} xu`;
      const from = payload.fromName?.trim() || "Ai đó";
      showToast(`${from} tặng bạn ${label}`);
    };

    const onGiftFly = (payload: GiftFlyEvent) => {
      if (!payload?.fly?.style) return;
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setGiftFlyQueue((prev) =>
        [...prev, { ...payload, key }].slice(-6),
      );
    };

    const onRingProposed = (payload: {
      fromName?: string;
      ringNameVi?: string;
      bondId?: string;
    }) => {
      if (payload.bondId) setPendingBondId(payload.bondId);
      setPendingIsProposee(true);
      const from = payload.fromName?.trim() || "Ai đó";
      const ring = payload.ringNameVi?.trim() || "nhẫn";
      showToast(`${from} cầu hôn bạn với ${ring}`);
      void api<{ ok: true; user: AuthUser }>("/api/auth/me")
        .then((r) => {
          const token = getToken();
          if (token && r.user) {
            saveSession(token, r.user);
            setMe(r.user);
          }
        })
        .catch(() => {});
    };

    const onRingAccepted = (payload: {
      partnerName?: string;
      ringNameVi?: string;
    }) => {
      setPendingBondId(null);
      setPendingIsProposee(false);
      const partner = payload.partnerName?.trim() || "Đối phương";
      const ring = payload.ringNameVi?.trim() || "nhẫn";
      showToast(`Đã lên nhẫn với ${partner} · ${ring}`);
      void api<{ ok: true; user: AuthUser }>("/api/auth/me")
        .then((r) => {
          const token = getToken();
          if (token && r.user) {
            saveSession(token, r.user);
            setMe(r.user);
          }
        })
        .catch(() => {});
    };

    const onRingBroken = (payload?: {
      reason?: string;
      refunded?: number;
    }) => {
      setPendingBondId(null);
      setPendingIsProposee(false);
      const refunded = Math.floor(Number(payload?.refunded) || 0);
      if (refunded > 0) {
        showToast(`Đã hoàn ${formatXu(refunded)} xu lời cầu hôn`);
      } else if (payload?.reason === "admin") {
        showToast("Staff đã hủy nhẫn / lời cầu hôn");
      } else {
        showToast("Nhẫn / lời cầu hôn đã kết thúc");
      }
      void api<{ ok: true; user: AuthUser }>("/api/auth/me")
        .then((r) => {
          const token = getToken();
          if (token && r.user) {
            saveSession(token, r.user);
            setMe(r.user);
          }
        })
        .catch(() => {});
    };

    const onRingPhraseUpdated = () => {
      void api<{ ok: true; user: AuthUser }>("/api/auth/me")
        .then((r) => {
          const token = getToken();
          if (token && r.user) {
            saveSession(token, r.user);
            setMe(r.user);
          }
        })
        .catch(() => {});
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("joined", onJoined);
    s.on("joinRejected", onJoinRejected);
    s.on("sessionReplaced", onSessionReplaced);
    s.on("state", onState);
    s.on("stakeRejected", onStakeRejected);
    s.on("balanceUpdate", onBalanceUpdate);
    s.on("historyData", onHistoryData);
    s.on("leaderboardData", onLeaderboardData);
    s.on("balanceLeaderboardData", onBalanceLeaderboardData);
    s.on("levelLeaderboardData", onLevelLeaderboardData);
    s.on("tarotStarsData", onTarotStarsData);
    s.on("shout", onShout);
    s.on("giftReceived", onGiftReceived);
    s.on("giftFly", onGiftFly);
    s.on("ringProposed", onRingProposed);
    s.on("ringAccepted", onRingAccepted);
    s.on("ringBroken", onRingBroken);
    s.on("ringPhraseUpdated", onRingPhraseUpdated);

    if (s.connected) onConnect();

    return () => {
      if (saintTimerRef.current != null) {
        window.clearTimeout(saintTimerRef.current);
        saintTimerRef.current = null;
      }
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("joined", onJoined);
      s.off("joinRejected", onJoinRejected);
      s.off("sessionReplaced", onSessionReplaced);
      s.off("state", onState);
      s.off("stakeRejected", onStakeRejected);
      s.off("balanceUpdate", onBalanceUpdate);
      s.off("historyData", onHistoryData);
      s.off("leaderboardData", onLeaderboardData);
      s.off("balanceLeaderboardData", onBalanceLeaderboardData);
      s.off("levelLeaderboardData", onLevelLeaderboardData);
      s.off("tarotStarsData", onTarotStarsData);
      s.off("shout", onShout);
      s.off("giftReceived", onGiftReceived);
      s.off("giftFly", onGiftFly);
      s.off("ringProposed", onRingProposed);
      s.off("ringAccepted", onRingAccepted);
      s.off("ringBroken", onRingBroken);
      s.off("ringPhraseUpdated", onRingPhraseUpdated);
    };
  }, [socket, showToast, setMe, setSessionAuthed]);

  useEffect(() => {
    if (state?.chatLines) {
      setChatLines(state.chatLines);
    }
  }, [state?.chatLines]);

  // Đồng bộ VIP / số ván / ID từ phòng (không cần online list)
  useEffect(() => {
    if (!me?.id || !state?.viewerAuth) return;
    const v = state.viewerAuth;
    const nextVip = v.isVip != null ? !!v.isVip : !!me.isVip;
    const nextRounds = v.roundsPlayed ?? me.roundsPlayed ?? 0;
    const nextGranted = v.vipGranted ?? me.vipGranted ?? false;
    const nextCode = v.code ?? me.code;
    const nextLevel = v.playLevel ?? me.playLevel;
    if (
      nextVip === !!me.isVip &&
      nextRounds === (me.roundsPlayed ?? 0) &&
      nextGranted === !!me.vipGranted &&
      nextCode === me.code &&
      nextLevel === me.playLevel
    ) {
      return;
    }
    const next = {
      ...me,
      isVip: nextVip,
      roundsPlayed: nextRounds,
      playLevel: nextLevel,
      vipGranted: nextGranted,
      code: nextCode,
    };
    setMe(next);
    const token = getToken();
    if (token) saveSession(token, next);
    if (!next.isVip) setChatMode((m) => (m === "vip" ? "no" : m));
  }, [me, state?.viewerAuth]);

  // Popup đang mở: cập nhật ID/VIP khi phòng refresh (admin vừa đổi)
  useEffect(() => {
    if (!canSeeOnline(me)) return;
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
        cultivationRank: match.cultivationRank ?? prev.cultivationRank,
        nameColor: match.nameColor ?? prev.nameColor,
        nameEffect: match.nameEffect ?? prev.nameEffect,
        avatarFrame: match.avatarFrame ?? prev.avatarFrame,
        profileTheme: match.profileTheme ?? prev.profileTheme,
        nameFrame: match.nameFrame ?? prev.nameFrame,
        idFrame: match.idFrame ?? prev.idFrame,
        displayBadges: match.displayBadges ?? prev.displayBadges,
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
        next.cultivationRank === prev.cultivationRank &&
        next.nameColor === prev.nameColor &&
        next.nameEffect === prev.nameEffect &&
        next.avatarFrame === prev.avatarFrame &&
        next.profileTheme === prev.profileTheme &&
        next.nameFrame === prev.nameFrame &&
        next.idFrame === prev.idFrame &&
        JSON.stringify(next.displayBadges ?? []) ===
          JSON.stringify(prev.displayBadges ?? []) &&
        next.isGuest === prev.isGuest
      ) {
        return prev;
      }
      return next;
    });
  }, [me, state?.onlinePlayers]);

  // Tick SFX 5 giây cuối (local timer — không re-render GamePage mỗi giây)
  useEffect(() => {
    if (state?.phase !== "placing" || !state.phaseEndsAt) {
      lastTickSec.current = null;
      return;
    }
    const offset = state.serverTime - Date.now();
    const ends = state.phaseEndsAt;
    const tick = () => {
      const rem = Math.max(
        0,
        Math.ceil((ends - (Date.now() + offset)) / 1000),
      );
      if (rem > 0 && rem <= 5 && lastTickSec.current !== rem) {
        lastTickSec.current = rem;
        play("tick");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state?.phase, state?.phaseEndsAt, state?.serverTime, play]);

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
    if (state.phase === "placing") {
      setRevealOpen(false);
      setResultOpen(false);
    }

    if (state.yourBalance != null) {
      prevBalance.current = state.yourBalance;
    }
    prevPhase.current = state.phase;
  }, [state]);

  const tableMaxCards =
    state?.tableTiming?.maxCardsPerRound ?? DEFAULT_MAX_CARDS_PER_ROUND;

  // Trần bàn / tu tiên đổi → cắt preset Auto cho khớp
  useEffect(() => {
    setAutoStake((prev) => {
      const next = clampAutoStake(
        prev,
        tableMaxCards,
        stakeLimits.maxStakePerCard,
      );
      if (
        next.slots.length === prev.slots.length &&
        next.enabled === prev.enabled &&
        next.slots.every(
          (s, i) =>
            s.cardId === prev.slots[i]?.cardId &&
            s.amount === prev.slots[i]?.amount,
        )
      ) {
        return prev;
      }
      saveAutoStake(next);
      return next;
    });
  }, [tableMaxCards, stakeLimits.maxStakePerCard]);

  const runAutoPlace = useCallback(
    async (cfg: AutoStakeConfig, roundId: number) => {
      if (!socket || !connected || !state) return;
      if (state.phase !== "placing") return;
      if (!cfg.enabled || cfg.slots.length === 0) return;
      if (autoRoundRef.current === roundId) return;
      if (state.yourBalance == null || !Number.isFinite(state.yourBalance)) {
        return;
      }

      // Khóa ngay để tránh double-fire khi state cập nhật
      autoRoundRef.current = roundId;

      const lim =
        state.tableTiming?.maxCardsPerRound ?? DEFAULT_MAX_CARDS_PER_ROUND;
      const slots = clampAutoStake(
        cfg,
        lim,
        stakeLimits.maxStakePerCard,
      ).slots;
      const stakes = [...(state.yourStakes ?? [])];
      let balance = state.yourBalance;
      let placed = 0;
      let lastError: string | null = null;

      for (const slot of slots) {
        const idx = slot.cardId - 1;
        const current = stakes[idx] ?? 0;
        const need = Math.max(0, slot.amount - current);
        if (need <= 0) continue;
        if (current <= 0) {
          const distinct = stakes.filter((v) => v > 0).length;
          if (distinct >= lim) {
            lastError = `Mỗi lượt tối đa ${lim} lá`;
            continue;
          }
        }
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
            "placeStake",
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
        stakes[idx] = current + need;
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
    [socket, connected, state, showToast, stakeLimits.maxStakePerCard],
  );

  // Auto đặt khi vào pha đặt xu / khi bật Auto giữa ván
  useEffect(() => {
    if (!state || state.phase !== "placing") return;
    void runAutoPlace(autoStake, state.roundId);
  }, [
    state?.phase,
    state?.roundId,
    state?.yourBalance,
    autoStake,
    runAutoPlace,
  ]);

  const openStake = (cardId: number) => {
    if (!state || state.phase !== "placing") return;
    const stakes = state.yourStakes ?? [];
    const alreadyOnCard = (stakes[cardId - 1] ?? 0) > 0;
    if (!alreadyOnCard) {
      const distinct = stakes.filter((v) => v > 0).length;
      const lim =
        state.tableTiming?.maxCardsPerRound ?? DEFAULT_MAX_CARDS_PER_ROUND;
      if (distinct >= lim) {
        showToast(`Mỗi lượt chỉ được đặt tối đa ${lim} lá`);
        return;
      }
    }
    setStakeCardId(cardId);
    setSheet("stake");
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
      if (!canSeeOnline(me)) {
        return {
          ...partial,
          isGuest:
            partial.isGuest ??
            (!partial.isBot && !partial.code && !partial.userId),
        };
      }
      const online = state?.onlinePlayers ?? [];
      const match = online.find((p) =>
        partial.userId
          ? p.userId === partial.userId
          : partial.code
            ? p.code === partial.code
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
      const base = {
        ...partial,
        name: match.name || partial.name,
        avatar: match.avatar || partial.avatar,
        isBot: match.isBot,
        code: match.code ?? partial.code,
        winToday: match.winToday ?? partial.winToday,
        guessesToday: match.guessesToday ?? partial.guessesToday,
        userId: match.userId ?? partial.userId,
        isVip: match.isVip ?? partial.isVip,
        roundsPlayed: match.roundsPlayed ?? partial.roundsPlayed,
        vipGranted: match.vipGranted ?? partial.vipGranted,
        cultivationRank: match.cultivationRank ?? partial.cultivationRank,
        isGuest: !match.isBot && !match.code && !match.userId,
      };
      if (!isStaff(me)) return base;
      return {
        ...base,
        balance: match.balance ?? partial.balance,
        outcomeMode: match.outcomeMode ?? partial.outcomeMode,
      };
    },
    [state?.onlinePlayers, me],
  );

  const fetchPlayerCard = useCallback(async (info: PlayerInfoView) => {
    if (info.isBot) return null;
    const q = info.userId
      ? `userId=${encodeURIComponent(info.userId)}`
      : info.code
        ? `code=${encodeURIComponent(info.code)}`
        : "";
    if (!q) return null;
    try {
      const r = await api<{
        ok: true;
        card: {
          userId: string;
          displayName?: string;
          username: string;
          code: string;
          avatar: string;
          isVip: boolean;
          vipGranted: boolean;
          roundsPlayed: number;
          cultivationRank?: string;
          nameColor?: string;
          nameEffect?: string;
          avatarFrame?: string;
          profileTheme?: string;
          nameFrame?: string;
          idFrame?: string;
          displayBadges?: string[];
          bond?: UserBondSnippet | null;
        };
      }>(`/api/players/card?${q}`);
      return r.card;
    } catch {
      return null;
    }
  }, []);

  const openPlayerInfo = useCallback(
    (info: PlayerInfoView) => {
      const base = enrichPlayerInfo(info);
      setProfile(base);
      setSheet("playerInfo");
      if (base.isGuest || base.guestCode) return;
      void (async () => {
        const card = await fetchPlayerCard(base);
        if (!card) return;
        setProfile((prev) => {
          if (!prev) return prev;
          const same =
            (base.userId && prev.userId === base.userId) ||
            (base.code && prev.code === base.code) ||
            (prev.name === base.name && prev.avatar === base.avatar);
          if (!same) return prev;
          return {
            ...prev,
            name: card.displayName || card.username || prev.name,
            avatar: card.avatar || prev.avatar,
            code: card.code,
            userId: card.userId,
            isVip: card.isVip,
            vipGranted: card.vipGranted,
            roundsPlayed: card.roundsPlayed,
            cultivationRank: card.cultivationRank ?? prev.cultivationRank,
            nameColor: card.nameColor ?? prev.nameColor,
            nameEffect: card.nameEffect ?? prev.nameEffect,
            avatarFrame: card.avatarFrame ?? prev.avatarFrame,
            profileTheme: card.profileTheme ?? prev.profileTheme,
            nameFrame: card.nameFrame ?? prev.nameFrame,
            idFrame: card.idFrame ?? prev.idFrame,
            displayBadges: card.displayBadges ?? prev.displayBadges,
            bond: card.bond ?? prev.bond ?? null,
            isGuest: false,
          };
        });
      })();
    },
    [enrichPlayerInfo, fetchPlayerCard],
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
        socketId: p.id,
        guestCode: p.guestCode,
        balance: p.balance,
        outcomeMode: p.outcomeMode,
        isVip: p.isVip,
        roundsPlayed: p.roundsPlayed,
        vipGranted: p.vipGranted,
        cultivationRank: p.cultivationRank,
        nameColor: p.nameColor,
        nameEffect: p.nameEffect,
        avatarFrame: p.avatarFrame,
        profileTheme: p.profileTheme,
        nameFrame: p.nameFrame,
        idFrame: p.idFrame,
        displayBadges: p.displayBadges,
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
          ? "Đã cấp VIP10K"
          : r.user.isVip
            ? "Đã tắt VIP10K — vẫn VIP do đủ ván"
            : "Đã tắt VIP10K",
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

  const adminAdjustGuestBalance = async (opts: {
    socketId?: string;
    guestCode?: string;
    delta: number;
  }) => {
    setAdminBusy(true);
    try {
      const r = await api<{
        ok: true;
        balance: number;
        name: string;
        guestCode?: string;
      }>("/api/admin/guest/adjust-balance", {
        method: "POST",
        body: JSON.stringify(opts),
      });
      setProfile((prev) => {
        if (!prev) return prev;
        const sameSocket = opts.socketId && prev.socketId === opts.socketId;
        const sameCode =
          opts.guestCode &&
          prev.guestCode &&
          prev.guestCode.toUpperCase() === opts.guestCode.toUpperCase();
        if (!sameSocket && !sameCode) return prev;
        return { ...prev, balance: r.balance };
      });
      showToast(
        `${opts.delta > 0 ? "+" : ""}${formatXu(opts.delta)} → ${formatXu(r.balance)} xu (${r.name})`,
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

  const confirmStake = (cardId: number, amount: number) => {
    if (!socket || !state) return;
    // Đóng sheet ngay để đặt tiếp lá khác (Bước 2)
    setSheet(null);
    setStakeCardId(null);
    socket.emit("placeStake", {
      cardId,
      amount,
      roundId: state.roundId,
    });
  };

  const openHistory = () => {
    socket?.emit("getHistory", { limit: 30 });
    setSheet("history");
  };

  const openMyStakes = () => {
    setSheet("myStakes");
    setMyStakesError(null);
    if (!getToken() || !getStoredUser()) {
      setMyStakes([]);
      setMyStakesLoading(false);
      return;
    }
    setMyStakesLoading(true);
    api<{ ok: true; stakes: StakeEntry[] }>("/api/auth/stakes?limit=50")
      .then((r) => setMyStakes(r.stakes))
      .catch((e) =>
        setMyStakesError(
          e instanceof Error ? e.message : "Không tải được lịch sử",
        ),
      )
      .finally(() => setMyStakesLoading(false));
  };

  const openLeaderboard = () => {
    if (!showLbWinToday) return;
    socket?.emit("getLeaderboard");
    setSheet("leaderboard");
  };

  const openBalanceBoard = () => {
    if (!showLbBalance) return;
    socket?.emit("getBalanceLeaderboard");
    setSheet("balanceBoard");
  };

  const openTarotStars = () => {
    if (!showLbTarotStars) return;
    socket?.emit("getTarotStars");
    setSheet("tarotStars");
  };

  const openStreakBoard = () => {
    if (!showLbStreak) return;
    setSheet("streak");
  };

  const openRoundWinners = () => {
    if (!showLbRoundWinners) return;
    setSheet("roundWinners");
  };

  const openLevelBoard = () => {
    if (!showLbLevel) return;
    socket?.emit("getLevelLeaderboard");
    setSheet("levelBoard");
  };

  const giftXuToPlayer = async (opts: {
    toUserId?: string;
    toCode?: string;
    toUsername?: string;
    amount: number;
    giftKey?: string;
    note?: string;
  }) => {
    if (giftBusy) return;
    if (!getToken() || !me) {
      showToast("Đăng nhập để tặng quà");
      return;
    }
    setGiftBusy(true);
    try {
      const r = await api<{
        ok: true;
        amount: number;
        from: AuthUser;
        to: AuthUser;
        giftKey?: string;
      }>("/api/auth/gift-xu", {
        method: "POST",
        body: JSON.stringify({
          toUserId: opts.toUserId,
          toCode: opts.toCode,
          toUsername: opts.toUsername,
          amount: opts.amount,
          giftKey: opts.giftKey,
          note: opts.note,
        }),
      });
      const token = getToken();
      if (token) saveSession(token, r.from);
      setMe(r.from);
      const gift = opts.giftKey ? findDemoGift(opts.giftKey) : undefined;
      const label = gift
        ? `${gift.emoji} ${gift.nameVi}`
        : `${formatXu(r.amount)} xu`;
      showToast(
        `Đã tặng ${label} cho ${r.to.displayName ?? r.to.username}`,
      );
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không tặng được");
      return false;
    } finally {
      setGiftBusy(false);
    }
  };

  const openGiftHub = (preset?: GiftHubTarget | null) => {
    if (!getToken() || !me) {
      showToast("Đăng nhập để tặng quà");
      return;
    }
    setGiftPreset(preset ?? null);
    setSheet("giftHub");
  };

  const openRingHub = () => {
    if (!getToken() || !me) {
      showToast("Đăng nhập để lên nhẫn");
      return;
    }
    void (async () => {
      try {
        const r = await api<{
          ok: true;
          bond?: { id: string; status: string; proposedBy: string } | null;
          user: AuthUser;
        }>("/api/auth/ring-status");
        if (r.user) {
          const token = getToken();
          if (token) {
            saveSession(token, r.user);
            setMe(r.user);
          }
        }
        if (r.bond?.status === "pending") {
          setPendingBondId(r.bond.id);
          setPendingIsProposee(r.bond.proposedBy !== r.user.id);
        } else {
          setPendingBondId(null);
          setPendingIsProposee(false);
        }
      } catch {
        /* ignore */
      }
      setSheet("ringHub");
    })();
  };

  const openRingPropose = (preset?: RingHubTarget | null) => {
    if (!getToken() || !me) {
      showToast("Đăng nhập để cầu hôn");
      return;
    }
    setRingPreset(preset ?? null);
    setSheet("ringPropose");
  };

  const sendDemoGift = async (opts: {
    gift: { key: string; nameVi: string; emoji: string; price: number };
    toUserId?: string;
    toCode?: string;
    toUsername?: string;
    note?: string;
  }) => {
    const ok = await giftXuToPlayer({
      toUserId: opts.toUserId,
      toCode: opts.toCode,
      toUsername: opts.toUsername,
      amount: opts.gift.price,
      giftKey: opts.gift.key,
      note: opts.note
        ? `${opts.gift.nameVi}: ${opts.note}`.slice(0, 80)
        : opts.gift.nameVi,
    });
    if (ok) {
      setSheet(null);
      setGiftPreset(null);
    }
  };

  const proposeRing = async (opts: {
    ring: { key: string; nameVi: string; price: number };
    toUserId?: string;
    toCode?: string;
    toUsername?: string;
    note?: string;
  }) => {
    if (ringBusy) return;
    setRingBusy(true);
    try {
      const r = await api<{
        ok: true;
        from: AuthUser;
        bond: { id: string };
        ring: { nameVi: string };
      }>("/api/auth/ring-propose", {
        method: "POST",
        body: JSON.stringify({
          ringKey: opts.ring.key,
          toUserId: opts.toUserId,
          toCode: opts.toCode,
          toUsername: opts.toUsername,
          note: opts.note,
        }),
      });
      const token = getToken();
      if (token && r.from) {
        saveSession(token, r.from);
        setMe(r.from);
      }
      setPendingBondId(r.bond.id);
      showToast(`Đã gửi lời cầu hôn · ${r.ring.nameVi}`);
      setPendingIsProposee(false);
      setSheet(null);
      setRingPreset(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không cầu hôn được");
    } finally {
      setRingBusy(false);
    }
  };

  const acceptRing = async () => {
    if (ringBusy || !pendingBondId) return;
    setRingBusy(true);
    try {
      const r = await api<{ ok: true; user: AuthUser }>(
        "/api/auth/ring-accept",
        {
          method: "POST",
          body: JSON.stringify({ bondId: pendingBondId }),
        },
      );
      const token = getToken();
      if (token && r.user) {
        saveSession(token, r.user);
        setMe(r.user);
      }
      setPendingBondId(null);
      setPendingIsProposee(false);
      showToast("Đã chấp nhận lời cầu hôn");
      setSheet(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không chấp nhận được");
    } finally {
      setRingBusy(false);
    }
  };

  const rejectRing = async () => {
    if (ringBusy) return;
    let bondId = pendingBondId;
    if (!bondId && me?.bond?.status === "pending") {
      try {
        const st = await api<{
          ok: true;
          bond?: { id: string } | null;
        }>("/api/auth/ring-status");
        bondId = st.bond?.id ?? null;
      } catch {
        /* ignore */
      }
    }
    if (!bondId) {
      showToast("Không có lời cầu hôn");
      return;
    }
    setRingBusy(true);
    try {
      const r = await api<{ ok: true; user: AuthUser }>(
        "/api/auth/ring-reject",
        {
          method: "POST",
          body: JSON.stringify({ bondId }),
        },
      );
      const token = getToken();
      if (token && r.user) {
        saveSession(token, r.user);
        setMe(r.user);
      }
      setPendingBondId(null);
      setPendingIsProposee(false);
      showToast("Đã từ chối / hủy lời cầu hôn");
      setSheet(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không hủy được");
    } finally {
      setRingBusy(false);
    }
  };

  const breakRing = async () => {
    if (ringBusy) return;
    if (!window.confirm("Tháo nhẫn / chia tay?")) return;
    setRingBusy(true);
    try {
      const r = await api<{ ok: true; user: AuthUser }>(
        "/api/auth/ring-break",
        { method: "POST", body: JSON.stringify({}) },
      );
      const token = getToken();
      if (token && r.user) {
        saveSession(token, r.user);
        setMe(r.user);
      }
      setPendingBondId(null);
      setPendingIsProposee(false);
      showToast("Đã tháo nhẫn");
      setSheet(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không tháo được");
    } finally {
      setRingBusy(false);
    }
  };

  const saveCouplePhrase = async (phrase: string) => {
    if (ringBusy) return;
    setRingBusy(true);
    try {
      const r = await api<{ ok: true; user: AuthUser; couplePhrase: string | null }>(
        "/api/auth/ring-couple-phrase",
        {
          method: "POST",
          body: JSON.stringify({ phrase }),
        },
      );
      const token = getToken();
      if (token && r.user) {
        saveSession(token, r.user);
        setMe(r.user);
      }
      showToast(
        r.couplePhrase
          ? `Đã đặt chữ «${r.couplePhrase}»`
          : "Đã về chữ mặc định «Với»",
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không lưu chữ được");
    } finally {
      setRingBusy(false);
    }
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
  const canPlace = state?.phase === "placing";
  const winning = state?.winningCard ?? null;
  const guessesToday = state?.guessesToday ?? 0;
  const myStakeOnWinner =
    winning != null ? (state?.yourStakes?.[winning - 1] ?? 0) : 0;
  const winCard = winning != null ? CARDS.find((c) => c.id === winning) : null;
  const didWin = myStakeOnWinner > 0;
  const payoutAmount = winCard ? myStakeOnWinner * winCard.multiplier : 0;
  const profitAmount = payoutAmount - myStakeOnWinner;
  const topWinners = state?.roundTopWinners ?? [];

  // Cập nhật snapshot trong lúc đặt xu; giữ khi mở bài / trả xu
  useEffect(() => {
    if (!state || state.phase !== "placing") return;
    const stakes = state.yourStakes ?? [];
    const next = CARDS.filter((c) => (stakes[c.id - 1] ?? 0) > 0).map((c) => ({
      cardId: c.id,
      amount: stakes[c.id - 1] ?? 0,
    }));
    setPickedSnapshot(next);
  }, [state?.phase, state?.yourStakes, state?.roundId]);

  const displayPicked = useMemo(() => {
    type Row = {
      card: (typeof CARDS)[number];
      amount: number;
      pending?: boolean;
    };
    const phase = state?.phase;
    if (phase !== "placing") {
      return pickedSnapshot
        .map(({ cardId, amount }) => {
          const card = CARDS.find((c) => c.id === cardId);
          return card ? ({ card, amount } satisfies Row) : null;
        })
        .filter((x): x is Row => !!x);
    }

    const stakes = state?.yourStakes ?? [];
    const live = CARDS.filter((c) => (stakes[c.id - 1] ?? 0) > 0).map((c) => ({
      card: c,
      amount: stakes[c.id - 1] ?? 0,
      pending: false as boolean,
    }));

    const cardLim =
      state?.tableTiming?.maxCardsPerRound ?? DEFAULT_MAX_CARDS_PER_ROUND;
    const autoSlots = clampAutoStake(
      autoStake,
      cardLim,
      stakeLimits.maxStakePerCard,
    ).slots;

    // Auto ON: hiện preset nếu chưa có đặt xu live (hoặc bổ sung slot pending)
    if (autoStake.enabled && autoSlots.length > 0) {
      if (live.length === 0) {
        return autoSlots
          .map((s) => {
            const card = CARDS.find((c) => c.id === s.cardId);
            return card
              ? ({ card, amount: s.amount, pending: true } satisfies Row)
              : null;
          })
          .filter((x): x is Exclude<typeof x, null> => x != null);
      }
      const liveIds = new Set(live.map((r) => r.card.id));
      const pending = autoSlots
        .filter((s) => !liveIds.has(s.cardId))
        .map((s) => {
          const card = CARDS.find((c) => c.id === s.cardId);
          return card
            ? ({ card, amount: s.amount, pending: true } satisfies Row)
            : null;
        })
        .filter((x): x is Exclude<typeof x, null> => x != null);
      return [...live, ...pending].slice(0, cardLim);
    }

    return live;
  }, [
    state?.phase,
    state?.yourStakes,
    state?.tableTiming?.maxCardsPerRound,
    pickedSnapshot,
    autoStake.enabled,
    autoStake.slots,
    stakeLimits.maxStakePerCard,
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
              decoding="async"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <h1 className="play-heading truncate text-base leading-tight tracking-wide sm:text-lg">
                SOFIAORE-TAROT
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PlayToolsBar
                muted={muted}
                showBalance={showLbBalance}
                jackpotLabel={`Hũ ${formatXu(state?.jackpotPool ?? 0)}`}
                voiceLabel={
                  voiceStatus.inRoom && voiceStatus.roomId
                    ? `Room ${voiceStatus.roomId}${voiceStatus.isHost ? " · H" : ""}`
                    : "Room"
                }
                voiceLive={!!(voiceStatus.inRoom && voiceStatus.roomOpen)}
                onRules={() => setSheet("rules")}
                onGift={() => openGiftHub()}
                onRing={() => openRingHub()}
                onBalance={openBalanceBoard}
                onToggleMute={toggleMute}
                onVoice={() => playSock.openVoiceRoom()}
              />
            </div>
          </div>
          {!!(getToken() && getStoredUser() && !sessionAuthed) && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-rose-500/15 px-2.5 py-2 ring-1 ring-rose-400/40">
              <p className="text-[11px] font-semibold text-rose-100">
                Phiên đăng nhập hết hạn — vào lại để chat, nạp xu và lưu lịch sử ván.
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
              roleDisplay={state?.roleDisplay}
              onAvatarClick={openAvatarPicker}
              onNameClick={() => {
                setRenameDraft(
                  me ? userDisplayName(me) : name,
                );
                setRenameOpen((v) => !v);
              }}
            />
            {me && (
              <div className="mt-1 flex flex-wrap items-center gap-2 px-0.5">
                {!userShowsVip(me) ? (
                  <p className="text-[10px] font-semibold tabular-nums text-amber-200/90">
                    VIP {(me.roundsPlayed ?? 0).toLocaleString("vi-VN")}/
                    {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván
                  </p>
                ) : (
                  <p className="text-[10px] font-extrabold text-amber-300">
                    VIP
                  </p>
                )}
              </div>
            )}
            <p
              className="mt-1 px-0.5 text-[10px] font-semibold tabular-nums text-[var(--play-muted)]"
              title="Thời gian chơi (chỉ đếm khi tab đang mở)"
            >
              Đã chơi {formatDuration(sessionMs)} · Hôm nay{" "}
              {formatDuration(dayMs)}
            </p>
            {renameOpen && (
              <form
                className="absolute left-10 right-0 top-[calc(100%-0.15rem)] z-30 flex gap-1 rounded-xl bg-[rgba(232,250,245,0.97)] p-1.5 shadow-lg ring-1 ring-[var(--jade)]/45 backdrop-blur-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (me) {
                    const raw = renameDraft.trim();
                    if (raw.length > 0 && raw.length < 2) {
                      showToast("Nickname 2–12 ký tự (để trống = dùng username)");
                      return;
                    }
                    void (async () => {
                      try {
                        const r = await api<{ ok: true; user: AuthUser }>(
                          "/api/auth/nickname",
                          {
                            method: "POST",
                            body: JSON.stringify({ nickname: raw }),
                          },
                        );
                        setMe(r.user);
                        setName(userDisplayName(r.user));
                        const token = getToken();
                        if (token) saveSession(token, r.user);
                        setRenameDraft(userDisplayName(r.user));
                        setRenameOpen(false);
                        showToast(
                          raw
                            ? "Đã đổi nickname"
                            : "Đã xóa nickname — hiện username",
                        );
                      } catch (err) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : "Không đổi nickname được",
                        );
                      }
                    })();
                    return;
                  }
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
                  onChange={(e) =>
                    setRenameDraft(
                      me
                        ? e.target.value.slice(0, 12)
                        : e.target.value.slice(0, 16),
                    )
                  }
                  maxLength={me ? 12 : 16}
                  placeholder={me ? "Nickname…" : "Tên khách…"}
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
              Hôm nay: {guessesToday} lần ›
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
              {me && (
                <div
                  className="ui-pill flex items-center gap-1 px-2.5 py-1 !text-[var(--play-ink)]"
                  title="Gem (Kim Cương) — bàn Gem để sau"
                >
                  <span aria-hidden className="text-[11px]">
                    ◆
                  </span>
                  <span className="font-play text-xs font-bold text-sky-800 tabular-nums">
                    {formatGem(me.gemBalance ?? 0)}
                  </span>
                </div>
              )}
              <div className="flex flex-col items-end gap-0.5">
                <StaffNotiPopup user={me ?? getStoredUser()} />
                <button
                  type="button"
                  onClick={openCoupon}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void openVipTopups();
                  }}
                  title="Nạp xu · giữ/chuột phải xem danh sách nạp"
                  className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                    balance <= 0
                      ? "animate-pulse rounded-full bg-rose-500 text-white ring-1 ring-rose-300"
                      : "ui-pill ui-pill--strong"
                  }`}
                >
                  Nạp!
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ===== ZONE 2: Đồng bộ phòng — admin mở list người chơi ===== */}
        {onlineViewer ? (
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
        ) : (
        <>
          {!connected && (
            <div
              className="game-task mt-2 flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-[var(--play-muted)]"
              aria-live="polite"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"
                aria-hidden
              />
              <span className="font-semibold text-[var(--play-ink)]">
                Mất kết nối
              </span>
            </div>
          )}
          {connected &&
            !sessionAuthed &&
            state?.guestPlayRemainingMs != null &&
            state.guestPlayRemainingMs > 0 && (
              <div className="game-task mt-2 px-3 py-1.5 text-[10px] text-amber-900">
                <span className="font-semibold tabular-nums">
                  Khách còn {formatDuration(state.guestPlayRemainingMs)}
                </span>
              </div>
            )}
        </>
        )}

        {/* ===== ZONE 3: Kết quả gần đây (bar popup) ===== */}
        <div className="mt-2.5">
          <PlayRecentBar
            onOpenFull={openHistory}
            items={(state?.history ?? []).map((row, i) => {
              const card = CARDS.find((c) => c.id === row.win);
              return {
                key: `${row.round}-${i}`,
                image: card?.image,
                badge: row.win,
                title: card ? `#${card.id} ${card.nameVi}` : `#${row.win}`,
              };
            })}
          />
        </div>

        {/* ===== ZONE 4+6: Form bàn đặt xu (deck) ===== */}
        {/* ===== Tip bàn: chuỗi thua + admin/player tip — khung cố định, chữ rõ ===== */}
        {(() => {
          const warm = !!state?.viewerEngagement?.warmActive;
          const loss = state?.viewerEngagement?.lossStreak ?? 0;
          const ux = state?.aiUx;
          const tipText = ux?.tips?.[0]?.trim() || "";
          const showTip =
            !!tipText && !!(staffViewer || ux?.playTipsForPlayers);
          if (!warm && !showTip) return null;
          return (
            <div
              className="play-tip-board mt-2"
              aria-live="polite"
            >
              <table className="play-tip-board__table">
                <tbody>
                  {warm && (
                    <tr>
                      <th scope="row">Chuỗi thua</th>
                      <td>
                        {loss} — vận ấm nhẹ lá bạn đặt xu nhiều nhất
                      </td>
                    </tr>
                  )}
                  {showTip && (
                    <tr>
                      <th scope="row">
                        {staffViewer && !ux?.playTipsForPlayers
                          ? "Admin tip"
                          : "Gợi ý"}
                      </th>
                      <td>{tipText}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
        <PlayBoard
          phaseEndsAt={state?.phaseEndsAt ?? 0}
          serverTime={state?.serverTime ?? Date.now()}
          canPlace={canPlace}
          playerCounts={state?.playerCounts ?? []}
          yourStakes={state?.yourStakes ?? []}
          winningCardId={winning}
          phase={state?.phase ?? null}
          cardHeat={state?.cardHeat}
          winStreak={state?.viewerEngagement?.winStreak ?? 0}
          lossStreak={state?.viewerEngagement?.lossStreak ?? 0}
          maxCardsPerRound={
            state?.tableTiming?.maxCardsPerRound ?? 4
          }
          onPick={openStake}
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
                onClick={openMyStakes}
                className="app-btn-soft !px-2.5 !py-0.5 !text-[10px] font-extrabold uppercase tracking-wide"
                title="Lịch sử thắng/thua của bạn"
              >
                Lịch sử
              </button>
              <button
                type="button"
                onClick={() => setSheet("autoStake")}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  autoStake.enabled
                    ? "ui-pill ui-pill--strong"
                    : "app-btn-soft !px-2.5 !py-0.5 !text-[10px]"
                }`}
                title="Cấu hình tự động đặt lá"
              >
                Auto{autoStake.enabled ? " · ON" : ""}
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
                    decoding="async"
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
              ? autoStake.enabled
                ? `Auto ON · ${autoStake.slots.length} lá preset`
                : "Chạm lá trên bàn để đặt"
              : state?.phase === "placing"
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
          chatCosts={state?.chatCosts}
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
          chatSuggests={
            state?.aiUx &&
            (staffViewer || state.aiUx.chatSuggestsForPlayers)
              ? state.aiUx.chatSuggests
              : undefined
          }
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
        {showLbWinToday && (
        <section className="game-task game-task-aces mt-3">
          <button
            type="button"
            onClick={openLeaderboard}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="play-heading flex items-center gap-1.5 text-sm sm:text-base">
              Cao thủ dự đoán ›
              {!lbFlags.winToday && staffViewer ? (
                <span className="rounded bg-slate-600/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  Staff
                </span>
              ) : null}
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
                className={`flex items-center gap-1.5 px-1.5 py-1 ${zoneRowClass(ace.rank, ace.isYou)}`}
              >
                <RankBadge rank={ace.rank} size="sm" />
                <button
                  type="button"
                  onClick={() =>
                    openPlayerInfo({
                      name: ace.name,
                      avatar: ace.avatar,
                      winToday: ace.winToday,
                      userId: ace.userId,
                      code: ace.code,
                      isVip: ace.isVip,
                    })
                  }
                  className="shrink-0"
                  title="Xem thông tin"
                >
                  <img
                    src={normalizeAvatar(ace.avatar)}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.src.includes("avatar-default")) return;
                      el.src = "/assets/ui/avatar-default.png";
                    }}
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
                            decoding="async"
                            loading="lazy"
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
        )}

        {/* ===== ZONE 8: Sao bài Tarot — xu dùng dự đoán tuần ===== */}
        {showLbTarotStars && (
        <section className="game-task game-task-stars mt-4">
          <button
            type="button"
            onClick={openTarotStars}
            className="flex w-full flex-col text-left"
          >
            <p className="play-heading flex items-center gap-1.5 text-base sm:text-lg">
              Sao bài Tarot ›
              {!lbFlags.tarotStars && staffViewer ? (
                <span className="rounded bg-slate-600/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  Staff
                </span>
              ) : null}
            </p>
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
                className={`flex items-center gap-2 px-2 py-1.5 ${zoneRowClass(star.rank, star.isYou)}`}
              >
                <RankBadge rank={star.rank} size="sm" />
                <button
                  type="button"
                  onClick={() =>
                    openPlayerInfo({
                      name: star.name,
                      avatar: star.avatar,
                      userId: star.userId,
                      code: star.code,
                      isVip: star.isVip,
                    })
                  }
                  className="shrink-0"
                  title="Xem thông tin"
                >
                  <img
                    src={normalizeAvatar(star.avatar)}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.src.includes("avatar-default")) return;
                      el.src = "/assets/ui/avatar-default.png";
                    }}
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
        )}

        {/* ===== ZONE 9: Chuỗi thắng ===== */}
        {showLbStreak && (
        <section className="game-task game-task-lb mt-3">
          <button
            type="button"
            onClick={openStreakBoard}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="play-heading flex items-center gap-1.5 text-sm sm:text-base">
              Chuỗi thắng ›
              {!lbFlags.streak && staffViewer ? (
                <span className="rounded bg-slate-600/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  Staff
                </span>
              ) : null}
            </p>
            <span className="text-[10px] font-medium text-white/45">
              Gần đây
            </span>
          </button>
          <ul className="mt-1.5 space-y-1">
            {(state?.streakHighlights ?? []).length === 0 && (
              <li className="rank-row--empty py-3 text-center text-[11px] text-white/40">
                Chưa có chuỗi thắng nổi bật
              </li>
            )}
            {(state?.streakHighlights ?? []).slice(0, 3).map((row, i) => {
              const rank = i + 1;
              return (
                <li
                  key={`${row.at}-${row.name}-${row.streak}`}
                  className={`flex items-center gap-1.5 px-1.5 py-1 ${zoneRowClass(rank)}`}
                >
                  <RankBadge rank={rank} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold leading-tight text-white">
                      {row.name}
                    </p>
                    <p className="text-[10px] font-semibold leading-tight text-amber-300/90 tabular-nums">
                      {row.streak} ván liên tiếp
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        )}

        {/* ===== ZONE 9b: Cấp độ ===== */}
        {showLbLevel && (
        <section className="game-task game-task-lb mt-3">
          <button
            type="button"
            onClick={openLevelBoard}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="play-heading flex items-center gap-1.5 text-sm sm:text-base">
              Cấp độ ›
              {!lbFlags.level && staffViewer ? (
                <span className="rounded bg-slate-600/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  Staff
                </span>
              ) : null}
            </p>
            <span className="text-[10px] font-medium text-white/45">
              Lifetime
            </span>
          </button>
          <ul className="mt-1.5 space-y-1">
            {(state?.levelLeaders ?? []).length === 0 && (
              <li className="rank-row--empty py-3 text-center text-[11px] text-white/40">
                Chưa có dữ liệu cấp độ
              </li>
            )}
            {(state?.levelLeaders ?? []).slice(0, 3).map((row) => (
              <li
                key={`${row.rank}-${row.userId ?? row.name}`}
                className={`flex items-center gap-1.5 px-1.5 py-1 ${zoneRowClass(row.rank, row.isYou)}`}
              >
                <RankBadge rank={row.rank} size="sm" />
                <button
                  type="button"
                  onClick={() =>
                    openPlayerInfo({
                      name: row.name,
                      avatar: row.avatar,
                      userId: row.userId,
                      code: row.code,
                      isVip: row.isVip,
                      roundsPlayed: row.roundsPlayed,
                      playLevel: row.playLevel,
                    })
                  }
                  className="shrink-0"
                  title="Xem thông tin"
                >
                  <img
                    src={normalizeAvatar(row.avatar)}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.src.includes("avatar-default")) return;
                      el.src = "/assets/ui/avatar-default.png";
                    }}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold leading-tight text-white">
                    {row.name}
                    {row.isYou ? " ·Bạn" : ""}
                  </p>
                  <p className="text-[10px] font-semibold leading-tight text-amber-300/90 tabular-nums">
                    Lv.{row.playLevel} · {row.roundsPlayed.toLocaleString("vi-VN")} ván
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        )}

        {/* ===== ZONE 10: Top ván vừa ===== */}
        {showLbRoundWinners && (
        <section className="game-task game-task-lb mt-3">
          <button
            type="button"
            onClick={openRoundWinners}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="play-heading flex items-center gap-1.5 text-sm sm:text-base">
              Top ván vừa ›
              {!lbFlags.roundWinners && staffViewer ? (
                <span className="rounded bg-slate-600/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  Staff
                </span>
              ) : null}
            </p>
            <span className="text-[10px] font-medium text-white/45">
              Ván này
            </span>
          </button>
          <ul className="mt-1.5 space-y-1">
            {(state?.roundTopWinners ?? []).length === 0 && (
              <li className="rank-row--empty py-3 text-center text-[11px] text-white/40">
                Chưa có top ván này
              </li>
            )}
            {(state?.roundTopWinners ?? []).slice(0, 3).map((row) => (
              <li
                key={`${row.rank}-${row.name}`}
                className={`flex items-center gap-1.5 px-1.5 py-1 ${zoneRowClass(row.rank, row.isYou)}`}
              >
                <RankBadge rank={row.rank} size="sm" />
                <button
                  type="button"
                  onClick={() =>
                    openPlayerInfo({
                      name: row.name,
                      avatar: row.avatar,
                    })
                  }
                  className="shrink-0"
                  title="Xem thông tin"
                >
                  <img
                    src={normalizeAvatar(row.avatar)}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.src.includes("avatar-default")) return;
                      el.src = "/assets/ui/avatar-default.png";
                    }}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold leading-tight text-white">
                    {row.name}
                    {row.isYou ? " ·Bạn" : ""}
                  </p>
                  <p className="text-[10px] font-semibold leading-tight text-amber-300/90 tabular-nums">
                    +{formatXu(row.profit)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        )}
      </div>

      <RevealPopup
        open={revealOpen}
        winningCardId={winning}
        yourStake={myStakeOnWinner}
        revealStyle={state?.tableTiming?.revealStyle}
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
        onClose={() => setResultOpen(false)}
      />

      <StakeSheet
        open={sheet === "stake"}
        cardId={stakeCardId}
        balance={balance}
        currentStake={
          stakeCardId != null ? (state?.yourStakes?.[stakeCardId - 1] ?? 0) : 0
        }
        maxStakePerCard={stakeLimits.maxStakePerCard}
        quickAdds={stakeLimits.quickAdds}
        onClose={() => {
          setSheet(null);
          setStakeCardId(null);
        }}
        onConfirm={confirmStake}
      />
      {onlineViewer && (
      <PlayersSheet
        open={sheet === "players"}
        players={state?.onlinePlayers ?? []}
        onClose={() => setSheet(null)}
        onSelectPlayer={(p) => {
          setSheet(null);
          openOnlinePlayer(p);
        }}
      />
      )}
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
      <AutoStakeSheet
        open={sheet === "autoStake"}
        initial={autoStake}
        maxCardsPerRound={tableMaxCards}
        maxStakePerCard={stakeLimits.maxStakePerCard}
        quickAdds={stakeLimits.quickAdds}
        onClose={() => setSheet(null)}
        onSave={(cfg) => {
          const next = clampAutoStake(
            cfg,
            tableMaxCards,
            stakeLimits.maxStakePerCard,
          );
          // Cho phép đặt lại ngay trong ván đặt xu hiện tại khi bật/đổi preset
          if (next.enabled && state?.phase === "placing") {
            autoRoundRef.current = null;
          }
          setAutoStake(next);
          saveAutoStake(next);
          showToast(
            next.enabled
              ? state?.phase === "placing"
                ? `Auto ON · đang đặt ${next.slots.length}/${tableMaxCards} lá…`
                : `Auto ON · ${next.slots.length}/${tableMaxCards} lá (ván sau)`
              : "Đã tắt Auto",
          );
        }}
      />
      <PlayerInfoSheet
        open={sheet === "playerInfo"}
        player={profile}
        meId={me?.id}
        canGift={!!me && !!getToken()}
        giftBusy={giftBusy}
        staff={isStaff(me)}
        balanceOperator={isBalanceOperator(me)}
        busy={adminBusy}
        onClose={() => {
          setProfile(null);
          setSheet(null);
        }}
        onSetOutcome={isStaff(me) ? adminSetOutcome : undefined}
        onSetVip={isStaff(me) ? adminSetVip : undefined}
        onAdjustBalance={
          isBalanceOperator(me) ? adminAdjustBalance : undefined
        }
        onAdjustGuestBalance={
          isStaff(me) ? adminAdjustGuestBalance : undefined
        }
        onGiftXu={me && getToken() ? giftXuToPlayer : undefined}
        onOpenGiftHub={
          me && getToken()
            ? () => {
                if (!profile) return;
                openGiftHub({
                  userId: profile.userId,
                  code: profile.code,
                  name: profile.name,
                });
              }
            : undefined
        }
        onOpenRingPropose={
          me && getToken()
            ? () => {
                if (!profile) return;
                openRingPropose({
                  userId: profile.userId,
                  code: profile.code,
                  name: profile.name,
                });
              }
            : undefined
        }
        viewerBonded={!!me?.bond}
      />

      <GiftHubSheet
        open={sheet === "giftHub"}
        balance={me?.balance ?? state?.yourBalance}
        busy={giftBusy}
        preset={giftPreset}
        onlineHints={(state?.onlinePlayers ?? [])
          .filter(
            (p) =>
              !p.isBot &&
              !!p.userId &&
              p.userId !== me?.id &&
              !!(p.code || p.userId),
          )
          .map((p) => ({
            userId: p.userId,
            code: p.code,
            name: p.name,
          }))}
        onClose={() => {
          setSheet(null);
          setGiftPreset(null);
        }}
        onSend={sendDemoGift}
      />

      <RingHubSheet
        open={sheet === "ringHub"}
        balance={me?.balance ?? state?.yourBalance}
        busy={ringBusy}
        myBond={me?.bond ?? null}
        pendingBondId={pendingBondId}
        canAcceptPending={pendingIsProposee && !!pendingBondId}
        onClose={() => setSheet(null)}
        onOpenPropose={() => openRingPropose()}
        onAccept={acceptRing}
        onReject={rejectRing}
        onBreak={breakRing}
        onSaveCouplePhrase={saveCouplePhrase}
      />

      <RingProposeSheet
        open={sheet === "ringPropose"}
        balance={me?.balance ?? state?.yourBalance}
        busy={ringBusy}
        preset={ringPreset}
        onlineHints={(state?.onlinePlayers ?? [])
          .filter(
            (p) =>
              !p.isBot &&
              !!p.userId &&
              p.userId !== me?.id &&
              !!(p.code || p.userId),
          )
          .map((p) => ({
            userId: p.userId,
            code: p.code,
            name: p.name,
          }))}
        onClose={() => {
          setSheet(null);
          setRingPreset(null);
        }}
        onPropose={proposeRing}
      />

      <GiftFlyOverlay
        queue={giftFlyQueue}
        onDone={(key) =>
          setGiftFlyQueue((prev) => prev.filter((x) => x.key !== key))
        }
      />

      <HistorySheet
        open={sheet === "history"}
        rows={historyRows}
        onClose={() => setSheet(null)}
      />
      <MyRoundsSheet
        open={sheet === "myStakes"}
        stakes={myStakes}
        loading={myStakesLoading}
        error={myStakesError}
        needsLogin={!getToken() || !me}
        onClose={() => setSheet(null)}
      />
      <LeaderboardSheet
        open={sheet === "leaderboard" && showLbWinToday}
        rows={leaderboardRows}
        onClose={() => setSheet(null)}
      />
      <BalanceLeaderboardSheet
        open={sheet === "balanceBoard" && showLbBalance}
        rows={balanceBoardRows}
        onClose={() => setSheet(null)}
        onOpenPlayer={(row) => {
          openPlayerInfo({
            name: row.name,
            avatar: row.avatar,
            userId: row.userId,
            code: row.code,
            balance: row.balance,
          });
        }}
      />
      <TarotStarsSheet
        open={sheet === "tarotStars" && showLbTarotStars}
        rows={
          tarotStarRows.length > 0
            ? tarotStarRows
            : (state?.tarotStars ?? [])
        }
        onClose={() => setSheet(null)}
      />
      <StreakLeaderboardSheet
        open={sheet === "streak" && showLbStreak}
        rows={state?.streakHighlights ?? []}
        onClose={() => setSheet(null)}
      />
      <RoundWinnersSheet
        open={sheet === "roundWinners" && showLbRoundWinners}
        rows={state?.roundTopWinners ?? []}
        onClose={() => setSheet(null)}
        onOpenPlayer={(row) => {
          openPlayerInfo({
            name: row.name,
            avatar: row.avatar,
          });
        }}
      />
      <LevelLeaderboardSheet
        open={sheet === "levelBoard" && showLbLevel}
        rows={
          levelBoardRows.length > 0
            ? levelBoardRows
            : (state?.levelLeaders ?? [])
        }
        onClose={() => setSheet(null)}
        onOpenPlayer={(row) => {
          openPlayerInfo({
            name: row.name,
            avatar: row.avatar,
            userId: row.userId,
            code: row.code,
            isVip: row.isVip,
            roundsPlayed: row.roundsPlayed,
            playLevel: row.playLevel,
          });
        }}
      />
      <RulesSheet
        open={sheet === "rules"}
        onClose={() => setSheet(null)}
        maxCardsPerRound={state?.tableTiming?.maxCardsPerRound ?? 4}
      />
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
