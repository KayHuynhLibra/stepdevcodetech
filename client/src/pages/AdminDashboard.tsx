import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  homePath,
  isMainAdmin,
  isStaff,
  playPath,
  saveSession,
  VIP_ROUNDS_REQUIRED,
  type AuthUser,
} from "../auth";
import { AVATARS, isCustomAvatar, normalizeAvatar } from "../avatars";
import { CARDS, formatXu } from "../cards";
import { AppShell } from "../components/AppShell";
import { IdentityBadge } from "../components/IdentityBadge";
import { uploadAvatarFromFile } from "../uploadAvatar";

type TabId =
  | "overview"
  | "users"
  | "vault"
  | "traffic"
  | "coupons"
  | "inter"
  | "mod"
  | "ips"
  | "tools";

interface IpRow {
  ip: string;
  kind: string;
  guestCode?: string;
  online: boolean;
  lastSeen: number;
  blocked: boolean;
  blockedUntil: number;
  joinCount?: number;
  clusterFlag?: boolean;
  stake24h?: number;
  bets24h?: number;
  profit24h?: number;
  geo?: {
    local?: boolean;
    country?: string;
    regionName?: string;
    city?: string;
    isp?: string;
    org?: string;
    as?: string;
    proxy?: boolean;
    hosting?: boolean;
  } | null;
  seenUsers?: {
    userId: string;
    username: string;
    firstAt: number;
    lastAt: number;
    joins: number;
  }[];
  seenGuests?: {
    code: string;
    firstAt: number;
    lastAt: number;
    joins: number;
  }[];
  sessions: {
    kind: string;
    name?: string;
    guestCode?: string;
    username?: string;
  }[];
  users: {
    id: string;
    code: string;
    username: string;
    role: string;
    balance: number;
    isVip: boolean;
    banned: boolean;
    muted: boolean;
    roundsPlayed: number;
    stake24h?: number;
    bets24h?: number;
    profit24h?: number;
  }[];
}

function formatIpGeo(geo: IpRow["geo"]): string {
  if (!geo) return "—";
  if (geo.local) return "Local / private";
  const place = [geo.city, geo.regionName, geo.country].filter(Boolean).join(", ");
  const isp = geo.isp || geo.org || "";
  const flags = [
    geo.proxy ? "proxy" : "",
    geo.hosting ? "hosting" : "",
  ]
    .filter(Boolean)
    .join("/");
  return [place || "—", isp, flags].filter(Boolean).join(" · ");
}

interface UserHisPayload {
  user: {
    id: string;
    username: string;
    code: string;
    balance: number;
    role: string;
    banned: boolean;
    muted: boolean;
    isVip: boolean;
    roundsPlayed: number;
  };
  lastIp: string | null;
  lastIpAt: number | null;
  ipHistory: {
    ip: string;
    firstAt: number;
    lastAt: number;
    hits: number;
  }[];
  relatedIps: {
    ip: string;
    lastSeen: number;
    joins: number;
    firstAt: number;
    lastAt: number;
  }[];
  recentBets: {
    id: string;
    at: number;
    round: number;
    cardId: number;
    amount: number;
    result: string;
    profit: number;
  }[];
  stake24h: {
    stake24h: number;
    bets24h: number;
    profit24h: number;
  };
}
type ForceCardMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type InterMode =
  | "all"
  | "auto"
  | "small"
  | "big"
  | "flat"
  | "cool"
  | "app"
  | "hedge"
  | "user"
  | "fed"
  | ForceCardMode;

interface InterProb {
  cardId: number;
  nameVi: string;
  weight: number;
  percent: number;
  group: "small" | "big";
  liability?: number;
  houseProfit?: number;
}

interface InterAllRotation {
  rotation: string[];
  slotMs: number;
  slotIndex: number;
  effectiveMode: string;
  nextMode: string;
  remainingMs: number;
  nextRotateAt: number;
}

interface InterSnapshot {
  mode: InterMode;
  effectiveMode?: string;
  updatedAt: number;
  updatedBy: string;
  labels: Record<InterMode, string>;
  groups: { small: number[]; big: number[] };
  prefShare: number;
  otherShare: number;
  realBetsRound?: number[];
  authBetsRound?: number[];
  recentWins?: number[];
  probabilities: InterProb[];
  probabilitiesByMode: Partial<Record<InterMode, InterProb[]>>;
  all?: InterAllRotation;
}

interface BetRow {
  id: string;
  at: number;
  username: string;
  round: number;
  cardId: number;
  amount: number;
  result: "win" | "lose";
  payout: number;
  profit: number;
  winningCardId: number;
}

interface VaultSnapshot {
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  totalMinted: number;
  totalBurned: number;
  netHouse: number;
  ledger: {
    id: string;
    at: number;
    type: string;
    amount: number;
    balanceAfter: number;
    note: string;
    byUsername: string;
    username?: string;
  }[];
}

interface Overview {
  ok: true;
  me: { id: string; username: string; role: AuthUser["role"] };
  stats: {
    realPlayers: number;
    displayOnline: number;
    phase: string;
    roundNumber: number;
    botTarget: number;
    botActive: number;
    vipPool: number;
  };
  users: AuthUser[];
  botPanel: {
    targetCount: number;
    activeCount: number;
    logs?: {
      id: string;
      at: number;
      round: number;
      botId: string;
      botName: string;
      cardId: number;
      amount: number;
      action: string;
      message: string;
    }[];
  };
  history: { round: number; win: number }[];
  recentBets: BetRow[];
  betStats: {
    rows: number;
    stakeTotal: number;
    payoutTotal: number;
    winCount: number;
    loseCount: number;
  };
  vault?: VaultSnapshot;
  inter?: InterSnapshot;
  coupons?: {
    code: string;
    amount: number;
    secret: boolean;
    label: string;
    enabled: boolean;
    oncePerUser: boolean;
    redeemCount: number;
  }[];
  couponRedemptions?: {
    id: string;
    at: number;
    code: string;
    username: string;
    amount: number;
  }[];
  /** Chỉ mainadmin */
  traffic?: {
    realStakeRound: number;
    botStakeRound: number;
    displayStakeRound: number;
    realBettorsRound: number;
    botBettorsRound: number;
    loggedInOnline: number;
    guestOnline: number;
    historyRounds: number;
    nextRound: number;
    totalAccounts: number;
    playerAccounts: number;
    adminAccounts: number;
    mainadminAccounts: number;
    balanceTotal: number;
    betRows: number;
    uniqueUsers: number;
    uniqueRounds: number;
    stakeTotal: number;
    payoutTotal: number;
    profitTotal: number;
    winCount: number;
    loseCount: number;
    stakeToday: number;
    betsToday: number;
    stakeHour: number;
    betsHour: number;
    vaultBalance: number;
    vaultStakeIn: number;
    vaultPayoutOut: number;
    vaultNetHouse: number;
    houseEdgeXu: number;
    interMode?: InterMode;
  };
  audit?: {
    id: string;
    at: number;
    actorName: string;
    action: string;
    targetName?: string;
    detail?: string;
  }[];
  reports?: {
    id: string;
    at: number;
    reporterName: string;
    targetName: string;
    text: string;
    status: "open" | "done";
  }[];
}

function cardName(id: number) {
  return CARDS.find((c) => c.id === id)?.nameVi ?? `Lá ${id}`;
}

const LEDGER_LABEL: Record<string, string> = {
  stake_in: "Cược vào",
  payout_out: "Trả thưởng",
  mint: "Bơm kho",
  burn: "Rút kho",
  grant_user: "Cấp user",
  seize_user: "Thu user",
  set_balance: "Đặt số dư",
};

export default function AdminDashboard() {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState<AuthUser | null>(getStoredUser());
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [botCount, setBotCount] = useState(25);
  const [msg, setMsg] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<{ userId: string; delta: string }>({
    userId: "",
    delta: "100",
  });
  const [vaultDelta, setVaultDelta] = useState("10000");
  const [vaultSet, setVaultSet] = useState("");
  const [vaultNote, setVaultNote] = useState("");
  const [vaultUser, setVaultUser] = useState({
    userId: "",
    amount: "1000",
  });
  const [interBusy, setInterBusy] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "",
    amount: "10000",
    label: "",
    oncePerUser: true,
    enabled: true,
  });
  const [couponBusy, setCouponBusy] = useState(false);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [codeBusyId, setCodeBusyId] = useState<string | null>(null);
  const [ipRows, setIpRows] = useState<IpRow[]>([]);
  const [ipBusy, setIpBusy] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [userQuick, setUserQuick] = useState<
    "all" | "vip" | "banned" | "muted"
  >("all");
  const [ipFilter, setIpFilter] = useState("");
  const [ipQuick, setIpQuick] = useState<
    "all" | "online" | "cluster" | "blocked"
  >("all");
  const [hisBusy, setHisBusy] = useState(false);
  const [hisData, setHisData] = useState<UserHisPayload | null>(null);
  const [toolsQ, setToolsQ] = useState("");
  const [toolsBusy, setToolsBusy] = useState(false);
  const [toolsResult, setToolsResult] = useState<{
    users: (AuthUser & {
      stake24h?: number;
      bets24h?: number;
      profit24h?: number;
    })[];
    ips: IpRow[];
    recentBets: {
      id: string;
      at: number;
      round: number;
      cardId: number;
      amount: number;
      result: string;
      profit: number;
    }[];
    counts: {
      users: number;
      ips: number;
      vip: number;
      banned: number;
      muted: number;
      clusters: number;
    };
  } | null>(null);

  const load = useCallback(async () => {
    const overview = await api<Overview>("/api/admin/overview");
    setData(overview);
    setBotCount(overview.stats.botTarget);
    if (overview.vault) {
      setVaultSet(String(overview.vault.balance));
    }
    if (overview.me.role === "mainadmin") {
      try {
        const ips = await api<{ ok: true; rows: IpRow[] }>(
          "/api/mainadmin/ips",
        );
        setIpRows(ips.rows);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    api<{ ok: true; user: AuthUser }>("/api/auth/me")
      .then((r) => {
        if (!isStaff(r.user)) {
          nav(homePath(r.user), { replace: true });
          return;
        }
        const expected = homePath(r.user);
        const onOwnPlay = loc.pathname === `${expected}/play`;
        if (loc.pathname !== expected && !onOwnPlay) {
          nav(expected, { replace: true });
          return;
        }
        setMe(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
        return load();
      })
      .catch(() => {
        clearSession();
        nav("/login", { replace: true });
      });
  }, [nav, load, loc.pathname]);

  // ALL mode: refresh countdown / effective slot
  useEffect(() => {
    if (tab !== "inter" || data?.inter?.mode !== "all") return;
    const id = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [tab, data?.inter?.mode, load]);

  const logout = () => {
    clearSession();
    nav("/login", { replace: true });
  };

  const pickAvatar = async (avatar: string) => {
    if (!me || avatar === normalizeAvatar(me.avatar)) return;
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/avatar", {
        method: "POST",
        body: JSON.stringify({ avatar }),
      });
      setMe(r.user);
      const token = getToken();
      if (token) saveSession(token, r.user);
      setMsg("Đã đổi avatar");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi avatar");
    }
  };

  const uploadFromDevice = async (file: File) => {
    if (!me) return;
    try {
      const r = await uploadAvatarFromFile(file);
      if (r.user) {
        setMe(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
      }
      setMsg("Đã đổi avatar từ máy");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload avatar thất bại");
    }
  };

  const applyBots = async () => {
    try {
      await api("/api/admin/bots", {
        method: "POST",
        body: JSON.stringify({ count: botCount }),
      });
      setMsg(`Đã đặt ${botCount} bot`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const applyAdjust = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/adjust-balance", {
        method: "POST",
        body: JSON.stringify({
          userId: adjust.userId,
          delta: Number(adjust.delta),
        }),
      });
      setMsg("Đã cập nhật số dư user");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserOutcome = async (
    userId: string,
    mode: "normal" | "win" | "lose",
  ) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({ userId, mode }),
      });
      setMsg(
        mode === "normal"
          ? "Đã về Normal"
          : mode === "win"
            ? "User: ưu tiên WIN"
            : "User: ưu tiên LOSE",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserVip = async (userId: string, isVip: boolean) => {
    try {
      await api("/api/admin/user-vip", {
        method: "POST",
        body: JSON.stringify({ userId, isVip }),
      });
      setMsg(isVip ? "Đã cấp VIP admin" : "Đã tắt VIP admin");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserCode = async (userId: string, code: string) => {
    if (codeBusyId) return;
    setCodeBusyId(userId);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/admin/user-code", {
        method: "POST",
        body: JSON.stringify({ userId, code }),
      });
      setMsg(`Đã đổi ID → ${r.user.code}`);
      setCodeDrafts((d) => {
        const next = { ...d };
        delete next[userId];
        return next;
      });
      if (me && me.id === userId) {
        const token = getToken();
        if (token) saveSession(token, { ...me, ...r.user });
        setMe((prev) => (prev ? { ...prev, ...r.user } : prev));
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi đổi ID");
    } finally {
      setCodeBusyId(null);
    }
  };

  const setUserBan = async (userId: string, banned: boolean) => {
    try {
      const reason = banned
        ? window.prompt("Lý do khóa (tuỳ chọn)", "Vi phạm") ?? "Vi phạm"
        : "";
      await api("/api/admin/user-ban", {
        method: "POST",
        body: JSON.stringify({ userId, banned, reason }),
      });
      setMsg(banned ? "Đã khóa tài khoản" : "Đã mở khóa");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserMute = async (
    userId: string,
    opts: { minutes?: number; permanent?: boolean; off?: boolean },
  ) => {
    try {
      await api("/api/admin/user-mute", {
        method: "POST",
        body: JSON.stringify({
          userId,
          minutes: opts.off ? 0 : opts.minutes ?? 0,
          permanent: !!opts.permanent,
        }),
      });
      setMsg(
        opts.off
          ? "Đã unmute"
          : opts.permanent
            ? "Mute vĩnh viễn"
            : `Mute ${opts.minutes} phút`,
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const resetUserPassword = async (userId: string) => {
    try {
      const r = await api<{
        ok: true;
        tempPassword: string;
        recoveryCode?: string;
      }>("/api/admin/user-reset-password", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setMsg(
        `MK tạm: ${r.tempPassword}` +
          (r.recoveryCode ? ` · recovery: ${r.recoveryCode}` : ""),
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const markReport = async (id: string, status: "open" | "done") => {
    try {
      await api("/api/admin/reports/status", {
        method: "POST",
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const runIpAction = async (
    path: string,
    body: Record<string, unknown>,
    okMsg: string,
  ) => {
    setIpBusy(true);
    try {
      const r = await api<{ ok: true; rows?: IpRow[] }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (r.rows) setIpRows(r.rows);
      setMsg(okMsg);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi IP");
    } finally {
      setIpBusy(false);
    }
  };

  const openUserHis = async (userId: string) => {
    if (!userId || !main) return;
    setHisBusy(true);
    setHisData(null);
    try {
      const r = await api<{ ok: true } & UserHisPayload>(
        `/api/mainadmin/users/${encodeURIComponent(userId)}/history`,
      );
      setHisData(r);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Không tải His");
      setHisData(null);
    } finally {
      setHisBusy(false);
    }
  };

  const runLookup = async (q?: string) => {
    const query = (q ?? toolsQ).trim();
    if (!query) {
      setMsg("Nhập username / ID / IP / guest");
      return;
    }
    setToolsBusy(true);
    try {
      const r = await api<{
        ok: true;
        users: (AuthUser & {
          stake24h?: number;
          bets24h?: number;
          profit24h?: number;
        })[];
        ips: IpRow[];
        recentBets: {
          id: string;
          at: number;
          round: number;
          cardId: number;
          amount: number;
          result: string;
          profit: number;
        }[];
        counts: {
          users: number;
          ips: number;
          vip: number;
          banned: number;
          muted: number;
          clusters: number;
        };
      }>(`/api/mainadmin/lookup?q=${encodeURIComponent(query)}`);
      setToolsResult(r);
      setToolsQ(query);
      setMsg(
        `Tìm thấy ${r.counts.users} user · ${r.counts.ips} IP` +
          (r.counts.clusters ? ` · ${r.counts.clusters} cụm` : ""),
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi tra cứu");
    } finally {
      setToolsBusy(false);
    }
  };

  const createCoupon = async (e: FormEvent) => {
    e.preventDefault();
    setCouponBusy(true);
    try {
      await api("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: couponForm.code.trim(),
          amount: Number(couponForm.amount),
          label: couponForm.label.trim() || undefined,
          oncePerUser: couponForm.oncePerUser,
          enabled: couponForm.enabled,
          secret: true,
        }),
      });
      setMsg("Đã lưu coupon");
      setCouponForm((f) => ({ ...f, code: "", label: "" }));
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi coupon");
    } finally {
      setCouponBusy(false);
    }
  };

  const toggleCoupon = async (code: string, enabled: boolean) => {
    setCouponBusy(true);
    try {
      await api("/api/admin/coupons/toggle", {
        method: "POST",
        body: JSON.stringify({ code, enabled }),
      });
      setMsg(enabled ? `Đã bật ${code}` : `Đã tắt ${code}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setCouponBusy(false);
    }
  };

  const vaultAdjust = async (delta: number) => {
    try {
      await api("/api/mainadmin/vault/adjust", {
        method: "POST",
        body: JSON.stringify({ delta, note: vaultNote }),
      });
      setMsg(delta > 0 ? "Đã bơm kho xu" : "Đã rút kho xu");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const vaultSetBalance = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/mainadmin/vault/set", {
        method: "POST",
        body: JSON.stringify({
          balance: Number(vaultSet),
          note: vaultNote,
        }),
      });
      setMsg("Đã đặt số dư kho xu");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const vaultGrant = async () => {
    try {
      await api("/api/mainadmin/vault/grant", {
        method: "POST",
        body: JSON.stringify({
          userId: vaultUser.userId,
          amount: Number(vaultUser.amount),
          note: vaultNote,
        }),
      });
      setMsg("Đã cấp xu từ kho cho user");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const interModeLabel = (mode: string) => {
    switch (mode) {
      case "all":
        return "ALL (xoay 5 phút)";
      case "auto":
        return "Tự động";
      case "small":
        return "Small";
      case "big":
        return "Big";
      case "flat":
        return "Flat (cân đều)";
      case "cool":
        return "Cool (anti-streak)";
      case "app":
        return "App (hút xu mềm)";
      case "hedge":
        return "Hedge (soft-Fed)";
      case "fed":
        return "Fed (đọc cầu → app lời)";
      case "user":
        return "User (nhả xu)";
      default:
        return `Ép lá #${mode}`;
    }
  };

  const setInterMode = async (mode: InterMode) => {
    if (interBusy) return;
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setMsg(`Inter → ${interModeLabel(mode)}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi Inter");
    } finally {
      setInterBusy(false);
    }
  };

  const vaultSeize = async () => {
    try {
      await api("/api/mainadmin/vault/seize", {
        method: "POST",
        body: JSON.stringify({
          userId: vaultUser.userId,
          amount: Number(vaultUser.amount),
          note: vaultNote,
        }),
      });
      setMsg("Đã thu xu user về kho");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  if (!me || !data) {
    return (
      <AppShell center maxWidth="lg">
        <p className="text-[var(--play-muted)]">Đang tải admin…</p>
      </AppShell>
    );
  }

  const s = data.stats;
  const main = isMainAdmin(me);
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "overview", label: "Tổng quan", show: true },
    { id: "tools", label: "Tra cứu", show: main },
    { id: "traffic", label: "Lưu lượng", show: main },
    { id: "inter", label: "Inter", show: main },
    { id: "ips", label: "IP", show: main },
    { id: "users", label: "User & Bot", show: true },
    { id: "mod", label: "Mod", show: true },
    { id: "coupons", label: "Coupon ẩn", show: true },
    { id: "vault", label: "Kho xu", show: main },
  ];

  const filteredUsers = data.users.filter((u) => {
    if (userQuick === "vip" && !u.isVip) return false;
    if (userQuick === "banned" && !u.banned) return false;
    if (userQuick === "muted" && !u.muted) return false;
    const q = userFilter.trim().toLowerCase();
    if (!q) return true;
    return `${u.username} ${u.code} ${u.id} ${u.role}`
      .toLowerCase()
      .includes(q);
  });

  const filteredIps = ipRows.filter((row) => {
    if (ipQuick === "online" && !row.online) return false;
    if (ipQuick === "cluster" && !row.clusterFlag) return false;
    if (ipQuick === "blocked" && !row.blocked) return false;
    const q = ipFilter.trim().toLowerCase();
    if (!q) return true;
    const blob = [
      row.ip,
      row.guestCode,
      row.kind,
      formatIpGeo(row.geo),
      ...(row.users ?? []).map((u) => `${u.username} ${u.code}`),
      ...(row.seenUsers ?? []).map((s) => s.username),
      ...(row.seenGuests ?? []).map((s) => s.code),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });

  return (
    <AppShell maxWidth="lg">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <IdentityBadge
            user={me}
            showPath={false}
            onAvatarClick={() => {
              document
                .getElementById("avatar-picker")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
        <button type="button" onClick={logout} className="app-btn-ghost shrink-0">
          Thoát
        </button>
      </header>

      <nav className="mt-4 flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                tab === t.id
                  ? "bg-[var(--wood-deep)] text-white shadow-sm"
                  : "bg-white/80 text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
              }`}
            >
              {t.label}
            </button>
          ))}
      </nav>

      <section id="avatar-picker" className="app-panel mt-3 p-2.5">
        <p className="mb-2 text-[11px] font-semibold text-[var(--play-muted)]">
          Avatar của bạn
        </p>
        <label className="mb-2 flex cursor-pointer items-center justify-center rounded-lg bg-[var(--cream)]/80 px-2 py-1.5 text-[11px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--amber)]/40">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadFromDevice(file);
            }}
          />
          Chọn ảnh từ máy
        </label>
        <div className="flex flex-wrap gap-1.5">
          {isCustomAvatar(me.avatar) && (
            <button
              type="button"
              className="rounded-full p-0.5 ring-2 ring-[var(--amber)]"
              title="Avatar từ máy"
            >
              <img
                src={normalizeAvatar(me.avatar)}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            </button>
          )}
          {AVATARS.map((src) => {
            const selected = src === normalizeAvatar(me.avatar);
            return (
              <button
                key={src}
                type="button"
                onClick={() => pickAvatar(src)}
                className={`rounded-full p-0.5 ${
                  selected ? "ring-2 ring-[var(--amber)]" : "opacity-80"
                }`}
              >
                <img
                  src={src}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </section>

      {msg && (
        <p className="mt-3 text-center text-xs font-semibold text-[var(--wood-deep)]">
          {msg}
        </p>
      )}

      {tab === "tools" && main && (
        <section className="app-panel mt-4 space-y-3 p-3 sm:p-4">
          <div>
            <p className="play-heading text-sm">Tra cứu nhanh</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Username · ID · IP · guest code — kèm cược 24h & IP liên quan
            </p>
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runLookup();
            }}
          >
            <input
              value={toolsQ}
              onChange={(e) => setToolsQ(e.target.value)}
              placeholder="vd: demo · 12345 · 1.2.3.4 · GABC1234"
              className="app-input flex-1 !py-2 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={toolsBusy || !toolsQ.trim()}
              className="rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white disabled:opacity-45"
            >
              {toolsBusy ? "…" : "Tra"}
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["vip", "VIP đang có"],
                ["banned", "Đang ban"],
                ["muted", "Đang mute"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
                onClick={() => {
                  setTab("users");
                  setUserQuick(key);
                  setUserFilter("");
                  setMsg(`Đã mở User & Bot · lọc ${label}`);
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
              onClick={() => {
                setTab("ips");
                setIpQuick("cluster");
                setIpFilter("");
                setMsg("Đã mở IP · lọc cụm");
              }}
            >
              Cụm IP
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
              onClick={() => {
                setTab("ips");
                setIpQuick("online");
                setMsg("Đã mở IP · online");
              }}
            >
              IP online
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
              onClick={() => {
                setTab("ips");
                setIpQuick("blocked");
                setMsg("Đã mở IP · blocked");
              }}
            >
              IP blocked
            </button>
          </div>

          {toolsResult && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["User", toolsResult.counts.users],
                  ["IP", toolsResult.counts.ips],
                  ["VIP", toolsResult.counts.vip],
                  ["Ban", toolsResult.counts.banned],
                  ["Mute", toolsResult.counts.muted],
                  ["Cụm", toolsResult.counts.clusters],
                ].map(([label, n]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {label}
                    </p>
                    <p className="font-play text-lg font-bold tabular-nums text-[var(--play-ink)]">
                      {n}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                  User khớp
                </p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                  {toolsResult.users.length === 0 && (
                    <li className="text-[11px] text-[var(--play-muted)]">
                      Không có user
                    </li>
                  )}
                  {toolsResult.users.map((u) => (
                    <li
                      key={u.id}
                      className="rounded-lg bg-white/80 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                    >
                      <span className="font-semibold">{u.username}</span> · ID{" "}
                      {u.code} · {formatXu(u.balance)} xu
                      {u.isVip ? " · VIP" : ""}
                      {u.banned ? " · BAN" : ""}
                      {u.muted ? " · MUTE" : ""} · stake24h{" "}
                      {formatXu(u.stake24h ?? 0)}
                      <button
                        type="button"
                        className="ml-2 text-[10px] font-bold text-[var(--wood-deep)] underline"
                        onClick={() => {
                          setTab("users");
                          setUserFilter(u.username);
                          setUserQuick("all");
                        }}
                      >
                        Mở User
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-[10px] font-bold text-[var(--wood-deep)] underline"
                        onClick={() => {
                          setTab("ips");
                          setIpFilter(u.username);
                          setIpQuick("all");
                        }}
                      >
                        Mở IP
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                  IP khớp / liên quan
                </p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                  {toolsResult.ips.length === 0 && (
                    <li className="text-[11px] text-[var(--play-muted)]">
                      Không có IP
                    </li>
                  )}
                  {toolsResult.ips.map((row) => (
                    <li
                      key={row.ip}
                      className={`rounded-lg px-2 py-1.5 text-[11px] ring-1 ${
                        row.clusterFlag
                          ? "bg-amber-50 ring-amber-400/60"
                          : "bg-white/80 ring-[var(--wood-deep)]/10"
                      }`}
                    >
                      <span className="font-mono font-bold">{row.ip}</span>
                      {row.online ? " · online" : ""}
                      {row.clusterFlag ? " · cụm" : ""}
                      <span className="block text-[10px] text-[var(--play-muted)]">
                        {formatIpGeo(row.geo)}
                      </span>
                      <button
                        type="button"
                        className="mt-0.5 text-[10px] font-bold text-[var(--wood-deep)] underline"
                        onClick={() => {
                          setTab("ips");
                          setIpFilter(row.ip);
                          setIpQuick("all");
                        }}
                      >
                        Mở IP
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {toolsResult.recentBets.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                    Cược gần của user đầu tiên
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-[10px]">
                    {toolsResult.recentBets.map((b) => (
                      <li
                        key={b.id}
                        className="rounded bg-white/70 px-2 py-1 ring-1 ring-[var(--wood-deep)]/10"
                      >
                        Ván #{b.round} · lá {b.cardId} · {formatXu(b.amount)} ·{" "}
                        {b.result} · {formatXu(b.profit)} ·{" "}
                        {new Date(b.at).toLocaleString("vi-VN")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "overview" && (
        <>
          {main && data.traffic && (
            <section className="app-frame mt-4 px-3 py-3">
              <p className="play-heading text-sm">Lưu lượng tổng (mainadmin)</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Online login", String(data.traffic.loggedInOnline)],
                  ["Online khách", String(data.traffic.guestOnline)],
                  ["Cược hôm nay", formatXu(data.traffic.stakeToday)],
                  ["Edge nhà cái", formatXu(data.traffic.houseEdgeXu)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white/80 px-2 py-2">
                    <p className="text-[10px] text-[var(--play-muted)]">{label}</p>
                    <p className="font-play text-sm font-bold text-amber-800 tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTab("traffic")}
                className="mt-2 text-[11px] font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
              >
                Xem đầy đủ lưu lượng ›
              </button>
            </section>
          )}

          <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[
              ["Phase", s.phase],
              ["Ván #", String(s.roundNumber)],
              ["Online thật", String(s.realPlayers)],
              ["Hiển thị", String(s.displayOnline)],
              ["Bot active", String(s.botActive)],
              ["VIP pool", formatXu(s.vipPool)],
            ].map(([label, value]) => (
              <div key={label} className="app-panel p-3">
                <p className="play-section-title !normal-case !tracking-wide">
                  {label}
                </p>
                <p className="font-play mt-1 text-sm font-bold text-[var(--play-ink)]">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              ["Cược gần đây", String(data.betStats.rows)],
              ["Tổng stake", formatXu(data.betStats.stakeTotal)],
              ["Tổng trả", formatXu(data.betStats.payoutTotal)],
              [
                "Win / Lose",
                `${data.betStats.winCount}/${data.betStats.loseCount}`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="app-panel p-3">
                <p className="play-section-title !normal-case !tracking-wide">
                  {label}
                </p>
                <p className="font-play mt-1 text-sm font-bold text-[var(--play-ink)]">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading mb-2 text-sm">
              Lịch sử ván ({data.history.length})
            </p>
            <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {data.history.length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">Chưa có ván</li>
              ) : (
                data.history.map((h) => (
                  <li
                    key={h.round}
                    className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/10"
                    title={cardName(h.win)}
                  >
                    #{h.round} · {h.win}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading mb-2 text-sm">
              Cược user gần đây ({data.recentBets.length})
            </p>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {data.recentBets.length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">
                  Chưa ghi nhận cược.
                </li>
              ) : (
                data.recentBets.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {b.username} · #{b.round} · {cardName(b.cardId)}
                    </span>
                    <span
                      className={`shrink-0 font-play font-bold tabular-nums ${
                        b.result === "win" ? "text-[var(--wood-deep)]" : "text-rose-600"
                      }`}
                    >
                      {b.result === "win" ? "+" : ""}
                      {formatXu(b.profit)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      {tab === "traffic" && main && data.traffic && (
        <>
          <section className="mt-4">
            <p className="play-heading text-sm">Online & bàn hiện tại</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                ["Login online", String(data.traffic.loggedInOnline)],
                ["Khách online", String(data.traffic.guestOnline)],
                ["Hiển thị CCU", String(s.displayOnline)],
                ["Stake thật (ván)", formatXu(data.traffic.realStakeRound)],
                ["Stake bot (ván)", formatXu(data.traffic.botStakeRound)],
                ["Stake hiển thị", formatXu(data.traffic.displayStakeRound)],
                ["Người đặt (thật)", String(data.traffic.realBettorsRound)],
                ["Bot đặt", String(data.traffic.botBettorsRound)],
                ["Ván tiếp theo", `#${data.traffic.nextRound}`],
              ].map(([label, value]) => (
                <div key={label} className="app-panel p-3">
                  <p className="play-section-title !normal-case !tracking-wide">
                    {label}
                  </p>
                  <p className="font-play mt-1 text-sm font-bold text-[var(--play-ink)] tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <p className="play-heading text-sm">Lưu lượng cược (đã ghi)</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                ["Tổng stake", formatXu(data.traffic.stakeTotal)],
                ["Tổng trả thưởng", formatXu(data.traffic.payoutTotal)],
                ["Profit user", formatXu(data.traffic.profitTotal)],
                ["Stake 1 giờ", formatXu(data.traffic.stakeHour)],
                ["Cược 1 giờ", String(data.traffic.betsHour)],
                ["Stake hôm nay", formatXu(data.traffic.stakeToday)],
                ["Cược hôm nay", String(data.traffic.betsToday)],
                ["User có cược", String(data.traffic.uniqueUsers)],
                ["Ván có cược", String(data.traffic.uniqueRounds)],
                ["Dòng cược", String(data.traffic.betRows)],
                ["Win / Lose", `${data.traffic.winCount}/${data.traffic.loseCount}`],
                ["Lịch sử ván", String(data.traffic.historyRounds)],
              ].map(([label, value]) => (
                <div key={label} className="app-panel p-3">
                  <p className="play-section-title !normal-case !tracking-wide">
                    {label}
                  </p>
                  <p className="font-play mt-1 text-sm font-bold text-[var(--play-ink)] tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <p className="play-heading text-sm">Tài khoản & kho</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                ["Tổng tài khoản", String(data.traffic.totalAccounts)],
                ["Player", String(data.traffic.playerAccounts)],
                ["Admin", String(data.traffic.adminAccounts)],
                ["Xu đang cầm (user)", formatXu(data.traffic.balanceTotal)],
                ["Kho xu", formatXu(data.traffic.vaultBalance)],
                ["Cược vào kho", formatXu(data.traffic.vaultStakeIn)],
                ["Trả từ kho", formatXu(data.traffic.vaultPayoutOut)],
                ["Edge nhà cái", formatXu(data.traffic.houseEdgeXu)],
                ["Net kho", formatXu(data.traffic.vaultNetHouse)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={`app-panel p-3 ${
                    label === "Edge nhà cái" || label === "Kho xu"
                      ? "ring-2 ring-amber-300/50"
                      : ""
                  }`}
                >
                  <p className="play-section-title !normal-case !tracking-wide">
                    {label}
                  </p>
                  <p
                    className={`font-play mt-1 text-sm font-bold tabular-nums ${
                      label === "Edge nhà cái" || label === "Kho xu"
                        ? "text-amber-800"
                        : "text-[var(--play-ink)]"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "users" && (
        <>
          <section className="app-frame mt-4 px-3 py-3">
            <p className="play-heading text-sm">Số lượng bot</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={50}
                value={botCount}
                onChange={(e) => setBotCount(Number(e.target.value))}
                className="flex-1 accent-[var(--amber)]"
              />
              <input
                type="number"
                min={0}
                max={50}
                value={botCount}
                onChange={(e) => setBotCount(Number(e.target.value))}
                className="app-input w-16 !px-2 !py-1 text-center"
              />
              <button
                type="button"
                onClick={applyBots}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
              >
                Áp dụng
              </button>
            </div>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading text-sm">Cộng / trừ xu user</p>
            <form onSubmit={applyAdjust} className="mt-2 space-y-2">
              <select
                value={adjust.userId}
                onChange={(e) =>
                  setAdjust((a) => ({ ...a, userId: e.target.value }))
                }
                className="app-input"
                required
              >
                <option value="">Chọn user…</option>
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} · ID {u.code || "—"} ({formatXu(u.balance)} xu)
                    — {u.role}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={adjust.delta}
                  onChange={(e) =>
                    setAdjust((a) => ({ ...a, delta: e.target.value }))
                  }
                  placeholder="Delta (+/-)"
                  className="app-input flex-1"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white"
                >
                  Cập nhật
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[100, 1000, -100, -1000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setAdjust((a) => ({ ...a, delta: String(n) }))
                    }
                    className="app-btn-ghost !text-[10px]"
                  >
                    {n > 0 ? `+${formatXu(n)}` : formatXu(n)}
                  </button>
                ))}
              </div>
            </form>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading mb-1 text-sm">
              Chỉnh ID user · Danh sách ({filteredUsers.length}/
              {data.users.length})
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <input
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Lọc username / ID…"
                className="app-input !py-1.5 text-xs sm:!max-w-xs"
              />
              {(
                [
                  ["all", "Tất cả"],
                  ["vip", "VIP"],
                  ["banned", "Ban"],
                  ["muted", "Mute"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setUserQuick(id)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    userQuick === id
                      ? "bg-[var(--wood-deep)] text-white"
                      : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[11px] text-[var(--play-muted)]">
              Mỗi user: ô ID + nút <strong>Lưu ID</strong> (3–8 chữ/số, không
              trùng). Mode Lose/Normal/Win khi user có cược. VIP hiện ID nền
              vàng nổi.
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {filteredUsers.map((u) => {
                const om = u.outcomeMode ?? "normal";
                const granted = !!u.vipGranted;
                const rounds = u.roundsPlayed ?? 0;
                const vip = !!u.isVip;
                const vipLabel = granted
                  ? "Admin"
                  : rounds >= VIP_ROUNDS_REQUIRED
                    ? "10k ván"
                    : null;
                const draft =
                  codeDrafts[u.id] !== undefined
                    ? codeDrafts[u.id]!
                    : u.code || "";
                return (
                  <li
                    key={u.id}
                    className="rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <img
                          src={u.avatar || "/assets/ui/avatar-default.png"}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--play-ink)]">
                            {u.username}{" "}
                            <span className="text-[var(--wood-deep)]">{u.role}</span>
                            {vip && (
                              <span className="ml-1 text-amber-700">
                                VIP{vipLabel ? ` · ${vipLabel}` : ""}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-[var(--play-muted)]">
                            <span
                              className={`identity-chip identity-chip--code${
                                vip ? " identity-chip--code-vip" : ""
                              } !text-[9px]`}
                            >
                              ID {u.code || "—"}
                            </span>{" "}
                            · {rounds.toLocaleString("vi-VN")} ván · Thưởng:{" "}
                            {formatXu(u.winToday)} · Đoán: {u.guessesToday}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 font-play font-bold text-amber-700 tabular-nums">
                        {formatXu(u.balance)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <input
                        value={draft}
                        onChange={(e) =>
                          setCodeDrafts((d) => ({
                            ...d,
                            [u.id]: e.target.value.toUpperCase(),
                          }))
                        }
                        maxLength={8}
                        placeholder="ID mới"
                        className="app-input !w-24 !px-2 !py-1 !text-[11px] font-mono uppercase"
                        title="ID riêng 3–8 chữ/số"
                      />
                      <button
                        type="button"
                        disabled={
                          codeBusyId === u.id ||
                          !draft.trim() ||
                          draft.trim().toUpperCase() === (u.code || "")
                        }
                        onClick={() => setUserCode(u.id, draft)}
                        className="rounded-full bg-[var(--wood-deep)] px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                      >
                        {codeBusyId === u.id ? "…" : "Lưu ID"}
                      </button>
                      {(
                        [
                          ["lose", "Lose"],
                          ["normal", "Normal"],
                          ["win", "Win"],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setUserOutcome(u.id, mode)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            om === mode
                              ? mode === "win"
                                ? "bg-emerald-600 text-white"
                                : mode === "lose"
                                  ? "bg-rose-600 text-white"
                                  : "bg-[var(--wood-deep)] text-white"
                              : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setUserVip(u.id, !granted)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          granted
                            ? "bg-amber-500 text-[#1a1208]"
                            : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                        }`}
                      >
                        {granted ? "VIP admin ✓" : "VIP admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserBan(u.id, !u.banned)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          u.banned
                            ? "bg-rose-600 text-white"
                            : "bg-white text-rose-700 ring-1 ring-rose-300/60"
                        }`}
                      >
                        {u.banned ? "Mở khóa" : "Khóa"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          u.muted
                            ? setUserMute(u.id, { off: true })
                            : setUserMute(u.id, { minutes: 30 })
                        }
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      >
                        {u.muted ? "Unmute" : "Mute 30p"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserMute(u.id, { permanent: true })}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      >
                        Mute ∞
                      </button>
                      <button
                        type="button"
                        onClick={() => resetUserPassword(u.id)}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      >
                        Reset MK
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {tab === "mod" && (
        <>
          <section className="app-panel mt-4 p-3 sm:p-4">
            <p className="play-heading text-sm">Audit log</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Thao tác staff gần đây (Inter, VIP, ban, vault…).
            </p>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto sm:max-h-80">
              {(data.audit ?? []).length === 0 && (
                <li className="text-[11px] text-[var(--play-muted)]">
                  Chưa có bản ghi
                </li>
              )}
              {(data.audit ?? []).map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                >
                  <span className="font-semibold text-[var(--play-ink)]">
                    {a.actorName}
                  </span>{" "}
                  · {a.action}
                  {a.targetName ? ` → ${a.targetName}` : ""}
                  {a.detail ? ` · ${a.detail}` : ""}
                  <span className="block text-[10px] text-[var(--play-muted)]">
                    {new Date(a.at).toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="app-panel mt-4 p-3 sm:p-4">
            <p className="play-heading text-sm">Báo cáo chat</p>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto sm:max-h-80">
              {(data.reports ?? []).length === 0 && (
                <li className="text-[11px] text-[var(--play-muted)]">
                  Chưa có báo cáo
                </li>
              )}
              {(data.reports ?? []).map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                >
                  <p>
                    <span className="font-semibold">{r.reporterName}</span> báo{" "}
                    <span className="font-semibold">{r.targetName}</span>
                    {r.status === "done" ? " · xong" : " · mở"}
                  </p>
                  <p className="text-[var(--play-ink)]">“{r.text}”</p>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      className="rounded-full bg-[var(--wood-deep)] px-2 py-0.5 text-[10px] font-bold text-white"
                      onClick={() =>
                        markReport(
                          r.id,
                          r.status === "done" ? "open" : "done",
                        )
                      }
                    >
                      {r.status === "done" ? "Mở lại" : "Đánh dấu xong"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === "ips" && main && (
        <section className="app-panel mt-4 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="play-heading text-sm">IP · geo & lịch sử</p>
              <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                Geo/ISP · joins · stake 24h · cụm · ({filteredIps.length}/
                {ipRows.length})
              </p>
            </div>
            <button
              type="button"
              disabled={ipBusy}
              className="app-btn-ghost !text-[10px]"
              onClick={() => void load().then(() => setMsg("Đã làm mới IP"))}
            >
              Refresh
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <input
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
              placeholder="Lọc IP / user / guest / city…"
              className="app-input !py-1.5 text-xs sm:!max-w-xs"
            />
            {(
              [
                ["all", "Tất cả"],
                ["online", "Online"],
                ["cluster", "Cụm"],
                ["blocked", "Blocked"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setIpQuick(id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  ipQuick === id
                    ? "bg-[var(--wood-deep)] text-white"
                    : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">
            {filteredIps.length === 0 && (
              <li className="text-[11px] text-[var(--play-muted)]">
                Không khớp bộ lọc
              </li>
            )}
            {filteredIps.map((row) => (
              <li
                key={row.ip}
                className={`rounded-lg px-2.5 py-2 text-[11px] ring-1 ${
                  row.clusterFlag
                    ? "bg-amber-50 ring-amber-400/70"
                    : "bg-white/70 ring-[var(--wood-deep)]/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-[var(--play-ink)]">
                      {row.ip}
                      {row.online ? (
                        <span className="ml-1 text-emerald-700">· online</span>
                      ) : (
                        <span className="ml-1 text-[var(--play-muted)]">
                          · offline
                        </span>
                      )}
                      {row.blocked && (
                        <span className="ml-1 text-rose-700">· blocked</span>
                      )}
                      {row.clusterFlag && (
                        <span className="ml-1 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#1a1208]">
                          cụm
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                      {formatIpGeo(row.geo)}
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {row.kind}
                      {row.guestCode ? ` · guest ${row.guestCode}` : ""}
                      {` · ${row.joinCount ?? 0} joins`}
                      {` · stake 24h ${formatXu(row.stake24h ?? 0)}`}
                      {row.lastSeen
                        ? ` · ${new Date(row.lastSeen).toLocaleString("vi-VN")}`
                        : ""}
                    </p>
                    {row.users.map((u) => (
                      <p
                        key={u.id}
                        className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--play-ink)]"
                      >
                        <span>
                          <span className="font-semibold">{u.username}</span> ·
                          ID {u.code} · {formatXu(u.balance)} xu
                          {u.isVip ? " · VIP" : ""}
                          {u.banned ? " · BAN" : ""}
                          {u.muted ? " · MUTE" : ""} · {u.roundsPlayed} ván
                          {typeof u.stake24h === "number"
                            ? ` · 24h ${formatXu(u.stake24h)}`
                            : ""}{" "}
                          · {u.role}
                        </span>
                        <button
                          type="button"
                          disabled={hisBusy}
                          className="rounded-full bg-[var(--wood-deep)] px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
                          onClick={() => void openUserHis(u.id)}
                        >
                          His
                        </button>
                      </p>
                    ))}
                    {(row.seenUsers ?? []).length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[10px] font-semibold text-[var(--play-muted)]">
                          Từng user:
                        </p>
                        {(row.seenUsers ?? []).slice(0, 12).map((s) => (
                          <p
                            key={s.userId}
                            className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--play-muted)]"
                          >
                            <span>
                              {s.username} ({s.joins}× ·{" "}
                              {new Date(s.lastAt).toLocaleDateString("vi-VN")})
                            </span>
                            <button
                              type="button"
                              disabled={hisBusy}
                              className="rounded-full bg-[var(--wood-deep)]/90 px-2 py-0.5 text-[9px] font-bold text-white disabled:opacity-40"
                              onClick={() => void openUserHis(s.userId)}
                            >
                              His
                            </button>
                          </p>
                        ))}
                      </div>
                    )}
                    {(row.seenGuests ?? []).length > 0 && (
                      <p className="text-[10px] text-[var(--play-muted)]">
                        Từng guest:{" "}
                        {(row.seenGuests ?? [])
                          .slice(0, 6)
                          .map((s) => `${s.code}(${s.joins}×)`)
                          .join(" · ")}
                      </p>
                    )}
                    {row.sessions
                      .filter((s) => s.kind === "guest")
                      .map((s, i) => (
                        <p
                          key={`g-${i}`}
                          className="text-[10px] text-[var(--play-muted)]"
                        >
                          Khách online: {s.name || "—"}{" "}
                          {s.guestCode ? `(${s.guestCode})` : ""}
                        </p>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={ipBusy || !row.guestCode}
                      className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-40"
                      onClick={() =>
                        void runIpAction(
                          "/api/mainadmin/ips/clear-guest",
                          { ip: row.ip },
                          `Đã xóa bind guest ${row.ip}`,
                        )
                      }
                    >
                      Xóa bind
                    </button>
                    <button
                      type="button"
                      disabled={ipBusy || !row.online}
                      className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-40"
                      onClick={() =>
                        void runIpAction(
                          "/api/mainadmin/ips/kick",
                          { ip: row.ip },
                          `Đã kick ${row.ip}`,
                        )
                      }
                    >
                      Kick
                    </button>
                    <button
                      type="button"
                      disabled={ipBusy}
                      className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
                      onClick={() =>
                        void runIpAction(
                          "/api/mainadmin/ips/block",
                          { ip: row.ip, hours: 1 },
                          `Block 1h ${row.ip}`,
                        )
                      }
                    >
                      Block 1h
                    </button>
                    <button
                      type="button"
                      disabled={ipBusy}
                      className="rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
                      onClick={() =>
                        void runIpAction(
                          "/api/mainadmin/ips/block",
                          { ip: row.ip, hours: 24 },
                          `Block 24h ${row.ip}`,
                        )
                      }
                    >
                      Block 24h
                    </button>
                    <button
                      type="button"
                      disabled={ipBusy || !row.blocked}
                      className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
                      onClick={() =>
                        void runIpAction(
                          "/api/mainadmin/ips/block",
                          { ip: row.ip, hours: 0 },
                          `Mở khóa ${row.ip}`,
                        )
                      }
                    >
                      Mở
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "coupons" && (
        <>
          <section className="app-panel mt-4 p-3">
            <p className="play-heading text-sm">Tạo / cập nhật coupon</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Mã trùng sẽ cập nhật số xu &amp; cấu hình. Redeem trừ kho xu.
            </p>
            <form onSubmit={createCoupon} className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="Mã (vd NAP50K)"
                  className="app-input !py-1.5 text-xs"
                  required
                />
                <input
                  value={couponForm.amount}
                  onChange={(e) =>
                    setCouponForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="Số xu"
                  type="number"
                  min={10}
                  className="app-input !w-28 !py-1.5 text-xs"
                  required
                />
              </div>
              <input
                value={couponForm.label}
                onChange={(e) =>
                  setCouponForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="Nhãn (tuỳ chọn)"
                className="app-input !py-1.5 text-xs"
              />
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1.5 font-semibold text-[var(--play-ink)]">
                  <input
                    type="checkbox"
                    checked={couponForm.oncePerUser}
                    onChange={(e) =>
                      setCouponForm((f) => ({
                        ...f,
                        oncePerUser: e.target.checked,
                      }))
                    }
                  />
                  1 lần / user
                </label>
                <label className="flex items-center gap-1.5 font-semibold text-[var(--play-ink)]">
                  <input
                    type="checkbox"
                    checked={couponForm.enabled}
                    onChange={(e) =>
                      setCouponForm((f) => ({
                        ...f,
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  Bật ngay
                </label>
                <button
                  type="submit"
                  disabled={couponBusy || !couponForm.code.trim()}
                  className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45"
                >
                  Lưu mã
                </button>
              </div>
            </form>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading text-sm">Coupon ẩn (chỉ admin biết)</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              User chỉ thấy ô nhập mã — không thấy danh sách này.
            </p>
            <ul className="mt-3 space-y-2">
              {(data.coupons ?? []).length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">Chưa có coupon</li>
              ) : (
                (data.coupons ?? []).map((c) => (
                  <li
                    key={c.code}
                    className="rounded-lg bg-white/80 px-3 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-play text-sm font-bold text-amber-800">
                        {c.code}
                      </span>
                      <span className="font-play font-bold tabular-nums text-[var(--wood-deep)]">
                        {formatXu(c.amount)} xu
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                      {c.label}
                      {c.secret ? " · bí mật" : ""}
                      {c.oncePerUser ? " · 1 lần/user" : ""}
                      {c.enabled ? "" : " · tắt"}
                      {" · "}đã đổi {c.redeemCount} lần
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        disabled={couponBusy}
                        onClick={() => toggleCoupon(c.code, !c.enabled)}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold disabled:opacity-45 ${
                          c.enabled
                            ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300/60"
                            : "bg-[var(--amber)] text-white"
                        }`}
                      >
                        {c.enabled ? "Tắt mã" : "Bật mã"}
                      </button>
                      <button
                        type="button"
                        disabled={couponBusy}
                        onClick={() =>
                          setCouponForm({
                            code: c.code,
                            amount: String(c.amount),
                            label: c.label,
                            oncePerUser: c.oncePerUser,
                            enabled: c.enabled,
                          })
                        }
                        className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      >
                        Sửa form
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading mb-2 text-sm">
              Lịch sử đổi mã ({(data.couponRedemptions ?? []).length})
            </p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {(data.couponRedemptions ?? []).length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">
                  Chưa ai đổi mã
                </li>
              ) : (
                (data.couponRedemptions ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {r.username} · {r.code}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-play font-bold text-[var(--wood-deep)] tabular-nums">
                        +{formatXu(r.amount)}
                      </span>
                      <span className="ml-2 text-[10px] text-[var(--play-muted)]">
                        {new Date(r.at).toLocaleString("vi-VN")}
                      </span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      {tab === "inter" && main && data.inter && (
        <>
          <section className="app-panel mt-4 space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="play-heading text-sm">Inter — thuật toán lá thắng</p>
                <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                  ALL xoay mỗi 5 phút. Policy đọc cầu user đăng nhập. Cool dùng
                  3 lá thắng gần nhất.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300/60">
                Mode:{" "}
                {data.inter.mode === "all"
                  ? `ALL→${(data.inter.effectiveMode ?? data.inter.all?.effectiveMode ?? "?").toUpperCase()}`
                  : interModeLabel(data.inter.mode)}
              </span>
            </div>

            {data.inter.mode === "all" && data.inter.all && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-300/70">
                <p className="text-xs font-bold text-amber-950">
                  Đang chạy:{" "}
                  <span className="uppercase">
                    {data.inter.all.effectiveMode}
                  </span>
                  {" · "}
                  tiếp theo{" "}
                  <span className="uppercase">{data.inter.all.nextMode}</span>
                  {" · "}
                  còn{" "}
                  {Math.floor(
                    Math.max(0, data.inter.all.remainingMs) / 60000,
                  )}
                  :
                  {String(
                    Math.floor(
                      (Math.max(0, data.inter.all.remainingMs) / 1000) % 60,
                    ),
                  ).padStart(2, "0")}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-200/80">
                  <div
                    className="h-full rounded-full bg-amber-600 transition-[width] duration-1000"
                    style={{
                      width: `${Math.max(
                        2,
                        Math.min(
                          100,
                          (1 -
                            Math.max(0, data.inter.all.remainingMs) /
                              Math.max(1, data.inter.all.slotMs)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-amber-900/80">
                  Chuỗi: {data.inter.all.rotation.join(" → ")} (mỗi{" "}
                  {Math.round(data.inter.all.slotMs / 60000)} phút)
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={interBusy}
              onClick={() => setInterMode("all")}
              className={`w-full rounded-xl px-3 py-3 text-left transition ring-1 ${
                data.inter.mode === "all"
                  ? "bg-[var(--wood-deep)] text-white ring-[var(--wood)] shadow-sm"
                  : "bg-white/90 text-[var(--play-ink)] ring-amber-300/50 hover:bg-amber-50"
              } ${interBusy ? "opacity-60" : ""}`}
            >
              <p className="text-sm font-bold">ALL — xoay mode 5 phút</p>
              <p
                className={`mt-1 text-[10px] leading-snug ${
                  data.inter.mode === "all"
                    ? "text-white/80"
                    : "text-[var(--play-muted)]"
                }`}
              >
                auto → small → big → flat → app → hedge → fed → cool → user
              </p>
            </button>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                Policy — đọc cầu auth
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    {
                      id: "fed" as const,
                      title: "Fed — đọc cầu",
                      desc: "Cứng: lá app lời max",
                      activeClass:
                        "bg-rose-700 text-white ring-rose-800 shadow-sm",
                    },
                    {
                      id: "hedge" as const,
                      title: "Hedge — soft-Fed",
                      desc: "Lệch profit², vẫn random",
                      activeClass:
                        "bg-rose-500 text-white ring-rose-600 shadow-sm",
                    },
                    {
                      id: "app" as const,
                      title: "App — hút xu mềm",
                      desc: "Ưu tiên lá trả ít",
                      activeClass:
                        "bg-rose-600 text-white ring-rose-700 shadow-sm",
                    },
                    {
                      id: "user" as const,
                      title: "User — nhả xu",
                      desc: "Ưu tiên lá trả cao",
                      activeClass:
                        "bg-emerald-600 text-white ring-emerald-700 shadow-sm",
                    },
                  ] as const
                ).map((m) => {
                  const active = data.inter!.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={interBusy}
                      onClick={() => setInterMode(m.id)}
                      className={`rounded-xl px-3 py-3 text-left transition ring-1 ${
                        active
                          ? m.activeClass
                          : "bg-white/90 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
                      } ${interBusy ? "opacity-60" : ""}`}
                    >
                      <p className="text-sm font-bold">{m.title}</p>
                      <p
                        className={`mt-1 text-[10px] leading-snug ${
                          active ? "text-white/80" : "text-[var(--play-muted)]"
                        }`}
                      >
                        {m.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                Bias — không đọc stake
              </p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    {
                      id: "auto" as const,
                      title: "Tự động",
                      desc: "Weight gốc",
                    },
                    {
                      id: "small" as const,
                      title: "Small",
                      desc: "Lá 1–4 ~72%",
                    },
                    {
                      id: "big" as const,
                      title: "Big",
                      desc: "Lá 5–8 ~72%",
                    },
                    {
                      id: "flat" as const,
                      title: "Flat",
                      desc: "Cân ~12.5%",
                    },
                    {
                      id: "cool" as const,
                      title: "Cool",
                      desc: "Anti-streak",
                    },
                  ] as const
                ).map((m) => {
                  const active = data.inter!.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={interBusy}
                      onClick={() => setInterMode(m.id)}
                      className={`rounded-xl px-3 py-3 text-left transition ring-1 ${
                        active
                          ? "bg-[var(--wood-deep)] text-white ring-[var(--wood-deep)] shadow-sm"
                          : "bg-white/90 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
                      } ${interBusy ? "opacity-60" : ""}`}
                    >
                      <p className="text-sm font-bold">{m.title}</p>
                      <p
                        className={`mt-1 text-[10px] leading-snug ${
                          active ? "text-white/75" : "text-[var(--play-muted)]"
                        }`}
                      >
                        {m.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                Force — ép lá thắng (100%)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {CARDS.map((card) => {
                  const id = String(card.id) as ForceCardMode;
                  const active = data.inter!.mode === id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={interBusy}
                      onClick={() => setInterMode(id)}
                      className={`rounded-xl px-2 py-2.5 text-left transition ring-1 ${
                        active
                          ? "bg-amber-500 text-white ring-amber-600 shadow-sm"
                          : "bg-white/90 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
                      } ${interBusy ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <img
                          src={card.image}
                          alt=""
                          className="h-9 w-6 rounded object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold">#{card.id}</p>
                          <p
                            className={`truncate text-[9px] leading-tight ${
                              active ? "text-white/80" : "text-[var(--play-muted)]"
                            }`}
                          >
                            {card.nameVi}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-[var(--play-muted)]">
              {data.inter.labels[data.inter.mode]}
              {data.inter.updatedBy ? (
                <>
                  {" "}
                  · cập nhật bởi <strong>{data.inter.updatedBy}</strong>
                  {data.inter.updatedAt
                    ? ` · ${new Date(data.inter.updatedAt).toLocaleString("vi-VN")}`
                    : null}
                </>
              ) : null}
            </p>
          </section>

          <section className="app-panel mt-3 space-y-2 p-3">
            <p className="play-heading text-sm">Cầu auth + lời nhà (ván này)</p>
            <p className="text-[10px] text-[var(--play-muted)]">
              Stake user đăng nhập · Lời ước lượng nếu lá đó thắng
              {data.inter.recentWins && data.inter.recentWins.length > 0
                ? ` · cool gần đây: #${data.inter.recentWins.join(", #")}`
                : ""}
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {CARDS.map((card, i) => {
                const stake = data.inter!.authBetsRound?.[i] ?? 0;
                const profit =
                  data.inter!.probabilities.find((p) => p.cardId === card.id)
                    ?.houseProfit ?? 0;
                return (
                  <div
                    key={card.id}
                    className="rounded-lg bg-white/80 px-1.5 py-1.5 text-center ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <img
                      src={card.image}
                      alt=""
                      className="mx-auto h-8 w-6 rounded object-cover"
                    />
                    <p className="mt-0.5 text-[9px] font-bold text-[var(--play-ink)]">
                      #{card.id}
                    </p>
                    <p className="font-play text-[9px] tabular-nums text-[var(--play-muted)]">
                      {formatXu(stake)}
                    </p>
                    <p
                      className={`font-play text-[9px] font-bold tabular-nums ${
                        profit >= 0
                          ? "text-[var(--jade-deep)]"
                          : "text-rose-600"
                      }`}
                    >
                      {profit > 0 ? "+" : ""}
                      {formatXu(Math.round(profit))}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="app-panel mt-3 space-y-2 p-3">
            <p className="play-heading text-sm">
              Xác suất hiệu dụng
              {data.inter.effectiveMode
                ? ` (${data.inter.effectiveMode})`
                : ""}
            </p>
            {(data.inter.mode === "app" ||
              data.inter.mode === "user" ||
              data.inter.mode === "fed" ||
              data.inter.mode === "hedge" ||
              data.inter.effectiveMode === "app" ||
              data.inter.effectiveMode === "user" ||
              data.inter.effectiveMode === "fed" ||
              data.inter.effectiveMode === "hedge") && (
              <p className="text-[10px] text-[var(--play-muted)]">
                Theo stake user đăng nhập · Trả = cược×hệ số · Lời app = tổng
                stake − trả
              </p>
            )}
            {(() => {
              const probs = data.inter!.probabilities;
              const maxPct = Math.max(...probs.map((p) => p.percent), 0);
              return (
                <div className="space-y-1.5">
                  {probs.map((p) => {
                    const card = CARDS.find((c) => c.id === p.cardId);
                    const forced = data.inter!.mode === String(p.cardId);
                    const isMax = p.percent === maxPct && maxPct > 0;
                    return (
                      <div key={p.cardId} className="flex items-center gap-2">
                        {card ? (
                          <img
                            src={card.image}
                            alt=""
                            className="h-7 w-5 shrink-0 rounded object-cover"
                          />
                        ) : null}
                        <span className="w-16 shrink-0 truncate text-[10px] font-semibold">
                          #{p.cardId}
                        </span>
                        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--wood-deep)]/10">
                          <div
                            className={`h-full rounded-full ${
                              forced || isMax
                                ? "bg-amber-500"
                                : "bg-[var(--wood-deep)]/55"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(2, p.percent))}%`,
                            }}
                          />
                        </div>
                        <span className="font-play w-12 shrink-0 text-right text-xs font-bold tabular-nums text-[var(--wood-deep)]">
                          {p.percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.inter.probabilities.map((p) => {
                const card = CARDS.find((c) => c.id === p.cardId);
                const forced = data.inter!.mode === String(p.cardId);
                const eff = data.inter!.effectiveMode ?? data.inter!.mode;
                const policy =
                  eff === "app" ||
                  eff === "user" ||
                  eff === "fed" ||
                  eff === "hedge";
                const hot =
                  forced ||
                  (eff === "small" && p.group === "small") ||
                  (eff === "big" && p.group === "big") ||
                  (eff === "fed" && p.percent >= 50) ||
                  (eff === "hedge" && p.percent >= 20) ||
                  (policy && eff !== "fed" && p.percent >= 18);
                return (
                  <div
                    key={p.cardId}
                    className={`rounded-xl px-2 py-2 ring-1 ${
                      forced
                        ? "bg-amber-100 ring-amber-400"
                        : (eff === "app" ||
                              eff === "fed" ||
                              eff === "hedge") &&
                            hot
                          ? "bg-rose-50 ring-rose-300/70"
                          : eff === "user" && hot
                            ? "bg-emerald-50 ring-emerald-300/70"
                            : hot
                              ? "bg-amber-50 ring-amber-300/70"
                              : "bg-white/80 ring-[var(--wood-deep)]/10"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {card ? (
                        <img
                          src={card.image}
                          alt=""
                          className="h-8 w-6 rounded object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold">
                          #{p.cardId} {p.nameVi}
                        </p>
                        <p className="font-play text-sm font-bold tabular-nums text-[var(--wood-deep)]">
                          {p.percent}%
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-[9px] leading-snug text-[var(--play-muted)]">
                      {forced
                        ? "Ép thẳng"
                        : policy
                          ? `Trả ${formatXu(p.liability ?? 0)} · App ${formatXu(p.houseProfit ?? 0)}`
                          : p.group === "small"
                            ? "Small 1–4"
                            : "Big 5–8"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="app-panel mt-3 space-y-2 p-3">
            <p className="play-heading text-sm">Log Inter gần đây</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
              {(data.botPanel.logs ?? [])
                .filter(
                  (l) =>
                    l.botId === "system" &&
                    typeof l.message === "string" &&
                    l.message.includes("Inter:"),
                )
                .slice(0, 5)
                .map((l) => (
                  <li
                    key={l.id}
                    className="rounded-lg bg-white/70 px-2 py-1.5 ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <span className="font-semibold text-[var(--wood-deep)]">
                      Ván #{l.round}
                    </span>
                    <span className="text-[var(--play-muted)]">
                      {" "}
                      · {new Date(l.at).toLocaleTimeString("vi-VN")}
                    </span>
                    <p className="mt-0.5 text-[10px] leading-snug text-[var(--play-ink)]">
                      {l.message}
                    </p>
                  </li>
                ))}
              {(data.botPanel.logs ?? []).filter(
                (l) =>
                  l.botId === "system" &&
                  typeof l.message === "string" &&
                  l.message.includes("Inter:"),
              ).length === 0 && (
                <li className="py-3 text-center text-[var(--play-muted)]">
                  Chưa có log Inter — đợi khóa cược ván sau
                </li>
              )}
            </ul>
          </section>
        </>
      )}

      {tab === "vault" && main && data.vault && (
        <>
          <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {[
              ["Kho xu hiện tại", formatXu(data.vault.balance), true],
              ["Tổng cược vào", formatXu(data.vault.totalStakeIn), false],
              ["Tổng trả thưởng", formatXu(data.vault.totalPayoutOut), false],
              ["Đã bơm (mint)", formatXu(data.vault.totalMinted), false],
              ["Đã rút (burn)", formatXu(data.vault.totalBurned), false],
              ["Net nhà cái", formatXu(data.vault.netHouse), false],
            ].map(([label, value, accent]) => (
              <div
                key={String(label)}
                className={`app-panel p-3 ${accent ? "ring-2 ring-amber-300/50" : ""}`}
              >
                <p className="play-section-title !normal-case !tracking-wide">
                  {label}
                </p>
                <p
                  className={`font-play mt-1 text-sm font-bold tabular-nums ${
                    accent ? "text-amber-700" : "text-[var(--play-ink)]"
                  }`}
                >
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="app-panel mt-4 space-y-3 p-3">
            <p className="play-heading text-sm">Can thiệp kho xu</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Chỉ mainadmin. Cược user thật tự vào kho; thắng thì trừ kho.
            </p>
            <input
              value={vaultNote}
              onChange={(e) => setVaultNote(e.target.value)}
              placeholder="Ghi chú (tuỳ chọn)"
              className="app-input"
            />
            <div className="flex flex-wrap gap-2">
              <input
                value={vaultDelta}
                onChange={(e) => setVaultDelta(e.target.value)}
                className="app-input w-36"
                placeholder="Số xu"
              />
              <button
                type="button"
                onClick={() => vaultAdjust(Math.abs(Number(vaultDelta) || 0))}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
              >
                Bơm kho
              </button>
              <button
                type="button"
                onClick={() => vaultAdjust(-Math.abs(Number(vaultDelta) || 0))}
                className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Rút kho
              </button>
            </div>
            <form onSubmit={vaultSetBalance} className="flex flex-wrap gap-2">
              <input
                value={vaultSet}
                onChange={(e) => setVaultSet(e.target.value)}
                className="app-input w-40"
                placeholder="Đặt số dư tuyệt đối"
              />
              <button
                type="submit"
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
              >
                Đặt số dư kho
              </button>
            </form>
          </section>

          <section className="app-panel mt-4 space-y-2 p-3">
            <p className="play-heading text-sm">Xu kho ↔ user</p>
            <select
              value={vaultUser.userId}
              onChange={(e) =>
                setVaultUser((v) => ({ ...v, userId: e.target.value }))
              }
              className="app-input"
            >
              <option value="">Chọn user…</option>
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({formatXu(u.balance)})
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <input
                value={vaultUser.amount}
                onChange={(e) =>
                  setVaultUser((v) => ({ ...v, amount: e.target.value }))
                }
                className="app-input w-36"
                placeholder="Số xu"
              />
              <button
                type="button"
                onClick={vaultGrant}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
              >
                Cấp từ kho
              </button>
              <button
                type="button"
                onClick={vaultSeize}
                className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Thu về kho
              </button>
            </div>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading mb-2 text-sm">Sổ kho (gần đây)</p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {data.vault.ledger.length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">Chưa có giao dịch</li>
              ) : (
                data.vault.ledger.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">
                        {LEDGER_LABEL[row.type] ?? row.type}
                        {row.username ? ` · ${row.username}` : ""}
                      </span>
                      <span
                        className={`font-play font-bold tabular-nums ${
                          row.amount >= 0 ? "text-[var(--wood-deep)]" : "text-rose-600"
                        }`}
                      >
                        {row.amount >= 0 ? "+" : ""}
                        {formatXu(row.amount)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {new Date(row.at).toLocaleString("vi-VN")} · sau{" "}
                      {formatXu(row.balanceAfter)} · {row.byUsername}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      <div className="mt-5 flex gap-2">
        <Link to={playPath(me)} className="app-btn-primary flex-1">
          Vào bàn chơi
        </Link>
        <button
          type="button"
          onClick={() => load().then(() => setMsg("Đã làm mới"))}
          className="app-btn-ghost !rounded-xl !px-4 !py-3 !text-xs"
        >
          Refresh
        </button>
      </div>

      {(hisBusy || hisData) && main && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!hisBusy) setHisData(null);
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--play-cream,#f7f1e6)] p-4 shadow-xl ring-1 ring-[var(--wood-deep)]/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="play-heading text-sm">His · lịch sử user</p>
                <p className="text-[10px] text-[var(--play-muted)]">
                  Chỉ mainadmin · không lộ client
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
                disabled={hisBusy}
                onClick={() => setHisData(null)}
              >
                Đóng
              </button>
            </div>
            {hisBusy && !hisData && (
              <p className="text-xs text-[var(--play-muted)]">Đang tải…</p>
            )}
            {hisData && (
              <div className="space-y-3 text-[11px]">
                <div className="rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-[var(--wood-deep)]/10">
                  <p className="font-semibold text-[var(--play-ink)]">
                    {hisData.user.username} · ID {hisData.user.code}
                  </p>
                  <p className="text-[var(--play-muted)]">
                    {formatXu(hisData.user.balance)} xu ·{" "}
                    {hisData.user.roundsPlayed} ván
                    {hisData.user.isVip ? " · VIP" : ""}
                    {hisData.user.banned ? " · BAN" : ""}
                    {hisData.user.muted ? " · MUTE" : ""} · {hisData.user.role}
                  </p>
                  <p className="mt-1 text-[var(--play-muted)]">
                    IP cuối:{" "}
                    <span className="font-mono font-bold text-[var(--play-ink)]">
                      {hisData.lastIp ?? "—"}
                    </span>
                    {hisData.lastIpAt
                      ? ` · ${new Date(hisData.lastIpAt).toLocaleString("vi-VN")}`
                      : ""}
                  </p>
                  <p className="text-[var(--play-muted)]">
                    24h: stake {formatXu(hisData.stake24h.stake24h)} ·{" "}
                    {hisData.stake24h.bets24h} cược · P/L{" "}
                    {formatXu(hisData.stake24h.profit24h)}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                    IP trên account
                  </p>
                  <ul className="max-h-36 space-y-1 overflow-y-auto">
                    {hisData.ipHistory.length === 0 && (
                      <li className="text-[var(--play-muted)]">
                        Chưa ghi (user login/vào bàn sau bản này mới có)
                      </li>
                    )}
                    {hisData.ipHistory.map((h) => (
                      <li
                        key={h.ip}
                        className="rounded bg-white/70 px-2 py-1 font-mono ring-1 ring-[var(--wood-deep)]/10"
                      >
                        {h.ip} · {h.hits}× ·{" "}
                        {new Date(h.lastAt).toLocaleString("vi-VN")}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                    IP liên quan (guest-ips)
                  </p>
                  <ul className="max-h-28 space-y-1 overflow-y-auto">
                    {hisData.relatedIps.length === 0 && (
                      <li className="text-[var(--play-muted)]">Không có</li>
                    )}
                    {hisData.relatedIps.map((r) => (
                      <li
                        key={r.ip}
                        className="rounded bg-white/70 px-2 py-1 font-mono ring-1 ring-[var(--wood-deep)]/10"
                      >
                        {r.ip} · {r.joins} joins ·{" "}
                        {new Date(r.lastAt).toLocaleString("vi-VN")}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                    Cược gần
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {hisData.recentBets.length === 0 && (
                      <li className="text-[var(--play-muted)]">Không có</li>
                    )}
                    {hisData.recentBets.map((b) => (
                      <li
                        key={b.id}
                        className="rounded bg-white/70 px-2 py-1 ring-1 ring-[var(--wood-deep)]/10"
                      >
                        Ván #{b.round} · lá {b.cardId} · {formatXu(b.amount)} ·{" "}
                        {b.result} · {formatXu(b.profit)} ·{" "}
                        {new Date(b.at).toLocaleString("vi-VN")}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
