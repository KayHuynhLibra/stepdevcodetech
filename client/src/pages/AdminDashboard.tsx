import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  api,
  arcanaPath,
  canAccessRoomAdmin,
  canManageCultivation,
  clearSession,
  getStoredUser,
  getToken,
  homePath,
  isMainAdmin,
  isMod,
  isStaff,
  isTutien,
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
import {
  CULTIVATION_LABELS,
  CULTIVATION_RANKS,
  DEFAULT_CULTIVATION_COLORS,
  ensureCultivationColors,
  setCultivationColorsCache,
  type CultivationColorMap,
  type CultivationRank,
} from "../cultivation";
import { CultivationChip } from "../components/CultivationChip";
import { onArcanaImgError } from "../lib/arcanaImages";

type CultBenefitDraft = Record<
  CultivationRank,
  {
    chatDiscountPct: number;
    voiceSeatPriority: number;
    voiceHoldBonusMs: number;
  }
>;
type CultMaintDraft = Record<
  CultivationRank,
  { period: "day" | "week"; feeXu: number }
>;

function defaultBenefitDraft(): CultBenefitDraft {
  const o = {} as CultBenefitDraft;
  CULTIVATION_RANKS.forEach((r, i) => {
    o[r] = {
      chatDiscountPct: Math.min(50, i * 5 + (i >= 7 ? 10 : 0)),
      voiceSeatPriority: i,
      voiceHoldBonusMs: i * 60_000,
    };
  });
  return o;
}
function defaultMaintDraft(): CultMaintDraft {
  const fees = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000];
  const o = {} as CultMaintDraft;
  CULTIVATION_RANKS.forEach((r, i) => {
    o[r] = {
      period: i >= 5 ? "week" : "day",
      feeXu: fees[i] ?? 10,
    };
  });
  return o;
}

type ManagedGame = "tarot" | "arcana";
const MANAGED_GAME_KEY = "tarot_admin_managed_game";

type TabId =
  | "overview"
  | "users"
  | "vault"
  | "traffic"
  | "coupons"
  | "invites"
  | "inter"
  | "mod"
  | "ips"
  | "chat"
  | "tools"
  | "arcana"
  | "rolead"
  | "tutien"
  | "room";

interface VoiceRoomSeatAdmin {
  seat: number;
  socketId: string;
  userId: string;
  name: string;
  avatar: string;
  muted: boolean;
  forceMuted: boolean;
  joinedAt: number;
}

interface VoiceRoomAdmin {
  roomId: number;
  hostSocketId: string | null;
  hostUserId: string | null;
  seats: (VoiceRoomSeatAdmin | null)[];
  occupied: number;
  open: boolean;
}

interface InviteRow {
  code: string;
  maxUses: number;
  usedCount: number;
  enabled: boolean;
  note?: string;
  createdAt: number;
  createdBy: string;
}

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
  devices?: {
    deviceId: string;
    shortId: string;
    lastAt: number;
    blocked: boolean;
    blockedUntil: number;
    online: boolean;
    joinCount: number;
    meta: {
      platform?: string;
      screen?: string;
      timezone?: string;
      language?: string;
      ua?: string;
    };
    seenUsers: { userId: string; username: string; lastAt: number; joins: number }[];
    seenGuests: { code: string; lastAt: number; joins: number }[];
  }[];
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
  recentArcanaSpins?: {
    id: string;
    at: number;
    username: string;
    stake: number;
    pickId: number;
    pickIds?: number[];
    winId: number;
    won: boolean;
    profit: number;
    seed: string;
  }[];
  stake24h: {
    stake24h: number;
    bets24h: number;
    profit24h: number;
  };
}
type ForceCardMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type PackMode = "pack1" | "pack2" | "pack3" | "pack4";
type RotateStep =
  | "auto"
  | "small"
  | "big"
  | "flat"
  | "cool"
  | "hot"
  | "mid"
  | "lowmult"
  | "highmult"
  | "app"
  | "softapp"
  | "hedge"
  | "softfed"
  | "fed"
  | "user"
  | "contrarian"
  | "momentum"
  | "sparse"
  | "dense"
  | "wild";

type InterMode = "all" | PackMode | RotateStep | ForceCardMode;

const PACK_MODES: PackMode[] = ["pack1", "pack2", "pack3", "pack4"];

const FALLBACK_ROTATE_CATALOG: { id: RotateStep; label: string }[] = [
  { id: "auto", label: "Auto — weight gốc" },
  { id: "small", label: "Small — ưu tiên lá 1–4" },
  { id: "big", label: "Big — ưu tiên lá 5–8" },
  { id: "flat", label: "Flat — ~12.5% mỗi lá" },
  { id: "cool", label: "Cool — giảm 3 lá thắng gần nhất" },
  { id: "hot", label: "Hot — tăng lá vừa thắng gần đây" },
  { id: "mid", label: "Mid — ưu tiên lá 3–6" },
  { id: "lowmult", label: "LowMult — thiên hệ số thấp (1–4)" },
  { id: "highmult", label: "HighMult — thiên hệ số cao (5–8)" },
  { id: "app", label: "App — hút xu (mềm)" },
  { id: "softapp", label: "SoftApp — hút xu rất nhẹ" },
  { id: "hedge", label: "Hedge — lệch profit² nhà" },
  { id: "softfed", label: "SoftFed — giữ xu vừa phải" },
  { id: "fed", label: "Fed — lá nhà lời tối đa" },
  { id: "user", label: "User — nhả xu (cược cao)" },
  { id: "contrarian", label: "Contrarian — ưu tiên lá ít cược" },
  { id: "momentum", label: "Momentum — theo lá nhiều cược" },
  { id: "sparse", label: "Sparse — boost lá chưa ai đánh" },
  { id: "dense", label: "Dense — boost lá đông cược" },
  { id: "wild", label: "Wild — ngẫu nhiên 2 lá trọng số cao" },
];

const DEFAULT_ALL_ROTATION: RotateStep[] = [
  "auto",
  "small",
  "big",
  "flat",
  "app",
  "hedge",
  "fed",
  "cool",
  "user",
];

function isInterRotating(mode: string): mode is "all" | PackMode {
  return mode === "all" || PACK_MODES.includes(mode as PackMode);
}

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
  slotMinutes?: number;
  slotIndex: number;
  effectiveMode: string;
  nextMode: string;
  remainingMs: number;
  nextRotateAt: number;
}

interface InterSnapshot {
  mode: InterMode;
  effectiveMode?: string;
  allSlotMinutes?: number;
  allRotation?: string[];
  defaultRotation?: string[];
  winBiasPct?: number;
  vaultInterLink?: {
    enabled: boolean;
    lossThresholdXu: number;
    profitThresholdXu: number;
    onLossMode: string;
    onProfitMode: string;
  };
  rotateCatalog?: { id: RotateStep; label: string }[];
  modePacks?: { id: PackMode; label: string; rotation: string[] }[];
  updatedAt: number;
  updatedBy: string;
  labels: Record<string, string>;
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
  label?: string;
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  totalMinted: number;
  totalBurned: number;
  netHouse: number;
  netFromPlay?: number;
  breakdown?: Record<string, { count: number; sum: number }>;
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

interface ArcanaSlotAdmin {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  ratio: number;
  weight: number;
  image: string;
}

interface ArcanaConfig {
  version: number;
  enabled: boolean;
  betTiers: number[];
  pickMin?: number;
  pickMax?: number;
  maxStake?: number;
  tutienMaxByRank?: Record<string, number>;
  payoutScale?: number;
  streakBonusEnabled?: boolean;
  streakBonusMinStreak?: number;
  streakBonusPercentPerStep?: number;
  streakBonusCapPercent?: number;
  slots: ArcanaSlotAdmin[];
  updatedAt: number;
  updatedBy?: string;
}

interface ArcanaRtpRow {
  pickCount: number;
  winProbability: number;
  rtpSequential: number;
  rtpOptimal: number;
}

interface ArcanaStats {
  spinCount: number;
  winCount: number;
  loseCount: number;
  winRate: number;
  vaultBalance: number;
  vaultStakeIn: number;
  vaultPayoutOut: number;
  vaultNetHouse: number;
  houseEdgeXu: number;
  enabled: boolean;
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
  cultivation?: {
    colors: CultivationColorMap;
    labels: Record<string, string>;
    ranks: CultivationRank[];
    benefits?: Record<
      string,
      {
        chatDiscountPct: number;
        voiceSeatPriority: number;
        voiceHoldBonusMs: number;
      }
    >;
    maintenance?: Record<
      string,
      { period: "day" | "week"; feeXu: number }
    >;
    updatedAt?: number;
    updatedBy?: string;
  };
  botPanel?: {
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
  history?: { round: number; win: number }[];
  recentBets?: BetRow[];
  betStats?: {
    rows: number;
    stakeTotal: number;
    payoutTotal: number;
    winCount: number;
    loseCount: number;
  };
  vault?: VaultSnapshot;
  vaultArcana?: VaultSnapshot;
  arcanaStats?: ArcanaStats;
  arcanaConfig?: ArcanaConfig;
  arcanaRtpPreview?: ArcanaRtpRow[];
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
  invites?: InviteRow[];
  couponRedemptions?: {
    id: string;
    at: number;
    code: string;
    username: string;
    amount: number;
  }[];
  chatConfig?: {
    noCost: number;
    vipCost: number;
    saintCost: number;
    updatedAt: number;
    updatedBy?: string;
  };
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
    vaultArcanaBalance?: number;
    vaultArcanaStakeIn?: number;
    vaultArcanaPayoutOut?: number;
    vaultArcanaNetHouse?: number;
    arcanaHouseEdgeXu?: number;
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
  liveGuests?: {
    socketId: string;
    guestCode?: string;
    name: string;
    balance: number;
    inOrphan: boolean;
  }[];
}

function cardName(id: number) {
  return CARDS.find((c) => c.id === id)?.nameVi ?? `Lá ${id}`;
}

const LEDGER_LABEL: Record<string, string> = {
  stake_in: "Cược vào",
  stake_refund: "Hoàn cược",
  payout_out: "Trả thưởng",
  mint: "Bơm kho",
  burn: "Rút kho",
  grant_user: "Cấp user",
  seize_user: "Thu user",
  set_balance: "Đặt số dư",
  coupon_mint: "Coupon",
  admin_adjust: "Admin chỉnh xu",
  chat_fee: "Phí chat",
  cultivation_fee: "Phí cảnh giới",
};

export default function AdminDashboard() {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState<AuthUser | null>(getStoredUser());
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<TabId>(() =>
    getStoredUser()?.role === "tutien" ? "tutien" : "overview",
  );
  const [managedGame, setManagedGame] = useState<ManagedGame>(() => {
    try {
      const v = localStorage.getItem(MANAGED_GAME_KEY);
      return v === "arcana" ? "arcana" : "tarot";
    } catch {
      return "tarot";
    }
  });
  const [botCount, setBotCount] = useState(25);
  const [msg, setMsg] = useState<string | null>(null);
  const [cultivationColors, setCultivationColors] =
    useState<CultivationColorMap>(() =>
      structuredClone(DEFAULT_CULTIVATION_COLORS),
    );
  const [cultBenefits, setCultBenefits] = useState<CultBenefitDraft>(
    defaultBenefitDraft,
  );
  const [cultMaint, setCultMaint] = useState<CultMaintDraft>(defaultMaintDraft);
  const [winBiasDraft, setWinBiasDraft] = useState("0");
  const [vaultLinkDraft, setVaultLinkDraft] = useState({
    enabled: false,
    lossThresholdXu: "50000",
    profitThresholdXu: "50000",
    onLossMode: "small",
    onProfitMode: "big",
  });
  const [cultivationBusy, setCultivationBusy] = useState(false);
  const [rankDraftUserId, setRankDraftUserId] = useState("");
  const [rankDraftValue, setRankDraftValue] = useState<string>("");
  const [rankFilter, setRankFilter] = useState("");
  const [adjust, setAdjust] = useState<{ userId: string; delta: string }>({
    userId: "",
    delta: "100",
  });
  const [guestAdjust, setGuestAdjust] = useState<{ key: string; delta: string }>(
    { key: "", delta: "" },
  );
  const [vaultDelta, setVaultDelta] = useState("10000");
  const [vaultSet, setVaultSet] = useState("");
  const [vaultNote, setVaultNote] = useState("");
  const [vaultUser, setVaultUser] = useState({
    userId: "",
    amount: "1000",
  });
  const [interBusy, setInterBusy] = useState(false);
  const [interSubTab, setInterSubTab] = useState<"room" | "userWin">("room");
  const [winPctDrafts, setWinPctDrafts] = useState<Record<string, string>>({});
  const [winPctFilter, setWinPctFilter] = useState("");
  const [allSlotMinutes, setAllSlotMinutes] = useState("5");
  const [rotationDraft, setRotationDraft] = useState<RotateStep[]>([
    ...DEFAULT_ALL_ROTATION,
  ]);
  const [rotationAddMode, setRotationAddMode] = useState<RotateStep>("auto");
  const [couponForm, setCouponForm] = useState({
    code: "",
    amount: "10000",
    label: "",
    oncePerUser: true,
    enabled: true,
  });
  const [couponBusy, setCouponBusy] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    code: "",
    maxUses: "10",
    note: "",
  });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [codeBusyId, setCodeBusyId] = useState<string | null>(null);
  const [selfNickDraft, setSelfNickDraft] = useState<string | null>(null);
  const [selfNickBusy, setSelfNickBusy] = useState(false);
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
  const [pwReset, setPwReset] = useState<{
    id: string;
    username: string;
    code: string;
    role: string;
  } | null>(null);
  const [pwResetValue, setPwResetValue] = useState("");
  const [pwResetBusy, setPwResetBusy] = useState(false);
  const [pwResetResult, setPwResetResult] = useState<{
    tempPassword: string;
    recoveryCode?: string;
  } | null>(null);
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
  const [arcanaSpins, setArcanaSpins] = useState<
    {
      id: string;
      at: number;
      username: string;
      stake: number;
      pickId: number;
      pickIds?: number[];
      winId: number;
      won: boolean;
      profit: number;
      seed: string;
    }[]
  >([]);
  const [arcanaBusy, setArcanaBusy] = useState(false);
  const [arcanaSpinFilter, setArcanaSpinFilter] = useState("");
  const [roomLobby, setRoomLobby] = useState<VoiceRoomAdmin[]>([]);
  const [roomBusy, setRoomBusy] = useState(false);

  const selectManagedGame = (g: ManagedGame) => {
    setManagedGame(g);
    try {
      localStorage.setItem(MANAGED_GAME_KEY, g);
    } catch {
      /* ignore */
    }
    if (g === "tarot" && tab === "arcana") setTab("overview");
    if (g === "arcana" && tab === "inter") setTab("overview");
  };

  const loadRooms = useCallback(async () => {
    const r = await api<{
      ok: true;
      rooms: VoiceRoomAdmin[];
    }>("/api/room/overview");
    setRoomLobby(r.rooms);
  }, []);

  const load = useCallback(async () => {
    const stored = getStoredUser();
    if (stored?.role === "mod") {
      const room = await api<{
        ok: true;
        me: { id: string; username: string; role: AuthUser["role"] };
        rooms: VoiceRoomAdmin[];
      }>("/api/room/overview");
      setRoomLobby(room.rooms);
      setData({
        ok: true,
        me: room.me,
        users: [],
        stats: {
          realPlayers: 0,
          displayOnline: 0,
          phase: "—",
          roundNumber: 0,
          botTarget: 0,
          botActive: 0,
          vipPool: 0,
        },
      });
      return;
    }
    const overview =
      stored?.role === "tutien"
        ? await api<Overview>("/api/tutien/overview")
        : await api<Overview>("/api/admin/overview");
    setData(overview);
    setBotCount(overview.stats.botTarget);
    if (overview.cultivation?.colors) {
      setCultivationColorsCache(overview.cultivation.colors);
      setCultivationColors(structuredClone(overview.cultivation.colors));
    } else {
      void ensureCultivationColors().then((c) =>
        setCultivationColors(structuredClone(c)),
      );
    }
    if (overview.cultivation?.benefits) {
      setCultBenefits((prev) => {
        const next = { ...prev };
        for (const r of CULTIVATION_RANKS) {
          const row = overview.cultivation!.benefits![r];
          if (row) next[r] = { ...row };
        }
        return next;
      });
    }
    if (overview.cultivation?.maintenance) {
      setCultMaint((prev) => {
        const next = { ...prev };
        for (const r of CULTIVATION_RANKS) {
          const row = overview.cultivation!.maintenance![r];
          if (row) next[r] = { ...row };
        }
        return next;
      });
    }
    if (overview.inter?.winBiasPct != null) {
      setWinBiasDraft(String(overview.inter.winBiasPct));
    }
    if (overview.inter?.vaultInterLink) {
      const v = overview.inter.vaultInterLink;
      setVaultLinkDraft({
        enabled: !!v.enabled,
        lossThresholdXu: String(v.lossThresholdXu),
        profitThresholdXu: String(v.profitThresholdXu),
        onLossMode: v.onLossMode || "small",
        onProfitMode: v.onProfitMode || "big",
      });
    }
    const activeVault =
      managedGame === "arcana" ? overview.vaultArcana : overview.vault;
    if (activeVault) {
      setVaultSet(String(activeVault.balance));
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
  }, [managedGame]);

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    api<{ ok: true; user: AuthUser }>("/api/auth/me")
      .then((r) => {
        if (!isStaff(r.user) && !isTutien(r.user) && !isMod(r.user)) {
          nav(homePath(r.user), { replace: true });
          return;
        }
        const expected = homePath(r.user);
        const onOwnPlay =
          loc.pathname === `${expected}/play` ||
          loc.pathname === `${expected}/arcana`;
        if (loc.pathname !== expected && !onOwnPlay) {
          nav(expected, { replace: true });
          return;
        }
        setMe(r.user);
        if (r.user.role === "tutien") setTab("tutien");
        if (r.user.role === "mod") setTab("room");
        const token = getToken();
        if (token) saveSession(token, r.user);
        return load();
      })
      .catch(() => {
        clearSession();
        nav("/login", { replace: true });
      });
  }, [nav, load, loc.pathname]);

  useEffect(() => {
    if (tab !== "room" || !canAccessRoomAdmin(me)) return;
    void loadRooms().catch(() => {});
    const id = window.setInterval(() => {
      void loadRooms().catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, [tab, me, loadRooms]);

  useEffect(() => {
    if (data?.inter?.allSlotMinutes != null) {
      setAllSlotMinutes(String(data.inter.allSlotMinutes));
    }
  }, [data?.inter?.allSlotMinutes]);

  useEffect(() => {
    const r = data?.inter?.allRotation;
    if (r?.length) {
      setRotationDraft(r.filter((x): x is RotateStep => isRotateStep(x)));
    }
  }, [data?.inter?.allRotation]);

  function isRotateStep(v: string): v is RotateStep {
    return FALLBACK_ROTATE_CATALOG.some((o) => o.id === v);
  }

  const interRotateOptions = useMemo(
    () =>
      data?.inter?.rotateCatalog?.length
        ? data.inter.rotateCatalog
        : FALLBACK_ROTATE_CATALOG,
    [data?.inter?.rotateCatalog],
  );

  const interModePacks = useMemo(
    () =>
      data?.inter?.modePacks?.length
        ? data.inter.modePacks
        : PACK_MODES.map((id, i) => ({
            id,
            label: `Bộ ${i + 1}`,
            rotation: [] as string[],
          })),
    [data?.inter?.modePacks],
  );

  // ALL / Bộ mode: refresh countdown / effective slot
  useEffect(() => {
    if (tab !== "inter" || !isInterRotating(data?.inter?.mode ?? "")) return;
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

  const applyGuestAdjust = async (e: FormEvent) => {
    e.preventDefault();
    const key = guestAdjust.key.trim();
    const delta = Number(guestAdjust.delta);
    if (!key || !Number.isFinite(delta) || delta === 0) {
      setMsg("Chọn khách và nhập delta");
      return;
    }
    try {
      await api("/api/admin/guest/adjust-balance", {
        method: "POST",
        body: JSON.stringify({ socketId: key, delta }),
      });
      setMsg("Đã cập nhật số dư khách (bàn Tarot)");
      setGuestAdjust({ key: "", delta: "" });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserOutcome = async (
    userId: string,
    mode: "normal" | "win" | "lose",
    winPct?: number,
  ) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({
          userId,
          mode,
          ...(mode === "win" && winPct != null ? { winPct } : {}),
        }),
      });
      setMsg(
        mode === "normal"
          ? "Đã về Normal"
          : mode === "win"
            ? `User: WIN ${winPct ?? 100}%`
            : "User: ưu tiên LOSE",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserWinPct = async (userId: string, winPct: number) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({ userId, winPct }),
      });
      setMsg(`Win % → ${Math.max(80, Math.min(100, Math.floor(winPct)))}%`);
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
      setMsg(isVip ? "Đã cấp VIP10K" : "Đã tắt VIP10K");
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

  const setUserRole = async (
    userId: string,
    role: "user" | "deal" | "admin" | "onl" | "tutien" | "mod",
  ) => {
    try {
      await api("/api/mainadmin/user-role", {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      setMsg(
        role === "deal"
          ? "Đã cấp role Deal"
          : role === "admin"
            ? "Đã cấp admin"
            : role === "onl"
              ? "Đã cấp role Onl (xem online)"
              : role === "tutien"
                ? "Đã cấp role Tu Tiên"
                : role === "mod"
                  ? "Đã cấp role Mod (Room)"
                  : "Đã chuyển về user",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi đổi role");
    }
  };

  const roomAction = async (
    path: string,
    body: Record<string, unknown>,
    okMsg: string,
  ) => {
    if (roomBusy) return;
    setRoomBusy(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setMsg(okMsg);
      await loadRooms();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi Room");
    } finally {
      setRoomBusy(false);
    }
  };

  const setCultivationRank = async (
    userId: string,
    rank: CultivationRank | null,
  ) => {
    setCultivationBusy(true);
    try {
      await api("/api/admin/cultivation/rank", {
        method: "POST",
        body: JSON.stringify({ userId, rank }),
      });
      setMsg(
        rank
          ? `Đã gán ${CULTIVATION_LABELS[rank]}`
          : "Đã xóa cảnh giới",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi gán cảnh giới");
    } finally {
      setCultivationBusy(false);
    }
  };

  const saveCultivationColors = async () => {
    setCultivationBusy(true);
    try {
      const r = await api<{
        ok: true;
        colors: CultivationColorMap;
      }>("/api/tutien/cultivation/colors", {
        method: "POST",
        body: JSON.stringify({ colors: cultivationColors }),
      });
      setCultivationColorsCache(r.colors);
      setCultivationColors(structuredClone(r.colors));
      setMsg("Đã lưu bảng màu cảnh giới");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi lưu màu");
    } finally {
      setCultivationBusy(false);
    }
  };

  const saveCultivationConfig = async () => {
    setCultivationBusy(true);
    try {
      await api("/api/mainadmin/cultivation/config", {
        method: "POST",
        body: JSON.stringify({
          benefits: cultBenefits,
          maintenance: cultMaint,
        }),
      });
      setMsg("Đã lưu lợi ích + phí duy trì cảnh giới");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi lưu cấu hình Tu Tiên");
    } finally {
      setCultivationBusy(false);
    }
  };

  const saveWinBiasAndVaultLink = async () => {
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({
          winBiasPct: Number(winBiasDraft),
          vaultInterLink: {
            enabled: vaultLinkDraft.enabled,
            lossThresholdXu: Number(vaultLinkDraft.lossThresholdXu),
            profitThresholdXu: Number(vaultLinkDraft.profitThresholdXu),
            onLossMode: vaultLinkDraft.onLossMode,
            onProfitMode: vaultLinkDraft.onProfitMode,
          },
        }),
      });
      setMsg("Đã lưu winBias + Vault→Inter link");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi lưu Inter bias");
    } finally {
      setInterBusy(false);
    }
  };

  const setUserLeaderboardHide = async (userId: string, hidden: boolean) => {
    try {
      await api("/api/mainadmin/user-leaderboard-hide", {
        method: "POST",
        body: JSON.stringify({ userId, hidden }),
      });
      setMsg(hidden ? "Đã ẩn khỏi bảng xếp hạng" : "Đã hiện trên bảng xếp hạng");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi ẩn BXH");
    }
  };

  const setUserHideNickname = async (userId: string, hidden: boolean) => {
    try {
      await api("/api/mainadmin/user-hide-nickname", {
        method: "POST",
        body: JSON.stringify({ userId, hidden }),
      });
      setMsg(hidden ? "Đã ẩn nick công khai" : "Đã hiện nick công khai");
      await load();
      if (userId === me?.id) {
        const token = getToken();
        if (token) {
          try {
            const r = await api<{ ok: true; user: AuthUser }>("/api/auth/me");
            saveSession(token, r.user);
            setMe(r.user);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi ẩn nick");
    }
  };

  const saveSelfNickname = async () => {
    if (selfNickBusy) return;
    setSelfNickBusy(true);
    try {
      const raw = (selfNickDraft ?? "").trim();
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/nickname", {
        method: "POST",
        body: JSON.stringify({ nickname: raw }),
      });
      const token = getToken();
      if (token) {
        saveSession(token, r.user);
        setMe(r.user);
      }
      setSelfNickDraft(r.user.nickname ?? "");
      setMsg(
        r.user.nickname?.trim()
          ? `Nickname → ${r.user.nickname}`
          : "Đã xóa nickname — hiện username",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi lưu nickname");
    } finally {
      setSelfNickBusy(false);
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

  const openPwReset = (u: {
    id: string;
    username: string;
    code?: string;
    role: string;
  }) => {
    setPwReset({
      id: u.id,
      username: u.username,
      code: u.code || "",
      role: u.role,
    });
    setPwResetValue("");
    setPwResetResult(null);
    setPwResetBusy(false);
  };

  const closePwReset = () => {
    setPwReset(null);
    setPwResetValue("");
    setPwResetResult(null);
    setPwResetBusy(false);
  };

  const submitPwReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwReset || pwResetBusy) return;
    setPwResetBusy(true);
    setPwResetResult(null);
    try {
      const r = await api<{
        ok: true;
        tempPassword: string;
        recoveryCode?: string;
      }>("/api/admin/user-reset-password", {
        method: "POST",
        body: JSON.stringify({
          userId: pwReset.id,
          password: pwResetValue.trim(),
        }),
      });
      setPwResetResult({
        tempPassword: r.tempPassword,
        recoveryCode: r.recoveryCode,
      });
      setMsg(`Đã đặt mật khẩu cho ${pwReset.username}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi đặt MK");
    } finally {
      setPwResetBusy(false);
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

  const createInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteBusy(true);
    try {
      const r = await api<{ ok: true; invite: InviteRow; invites: InviteRow[] }>(
        "/api/mainadmin/invites",
        {
          method: "POST",
          body: JSON.stringify({
            code: inviteForm.code.trim() || undefined,
            maxUses: Number(inviteForm.maxUses),
            note: inviteForm.note.trim() || undefined,
          }),
        },
      );
      setMsg(`Đã tạo mã thành viên ${r.invite.code}`);
      setInviteForm({ code: "", maxUses: "10", note: "" });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi mã thành viên");
    } finally {
      setInviteBusy(false);
    }
  };

  const toggleInvite = async (code: string, enabled: boolean) => {
    setInviteBusy(true);
    try {
      await api("/api/mainadmin/invites/toggle", {
        method: "POST",
        body: JSON.stringify({ code, enabled }),
      });
      setMsg(enabled ? `Đã bật ${code}` : `Đã tắt ${code}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi toggle mã");
    } finally {
      setInviteBusy(false);
    }
  };

  const randomInviteCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setInviteForm((f) => ({ ...f, code: out }));
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
      const path =
        managedGame === "arcana"
          ? "/api/mainadmin/vault-arcana/adjust"
          : "/api/mainadmin/vault/adjust";
      await api(path, {
        method: "POST",
        body: JSON.stringify({ delta, note: vaultNote }),
      });
      setMsg(
        delta > 0
          ? `Đã bơm ${managedGame === "arcana" ? "Kho Arcana" : "Kho Tarot"}`
          : `Đã rút ${managedGame === "arcana" ? "Kho Arcana" : "Kho Tarot"}`,
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const vaultSetBalance = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const path =
        managedGame === "arcana"
          ? "/api/mainadmin/vault-arcana/set"
          : "/api/mainadmin/vault/set";
      await api(path, {
        method: "POST",
        body: JSON.stringify({
          balance: Number(vaultSet),
          note: vaultNote,
        }),
      });
      setMsg(
        managedGame === "arcana"
          ? "Đã đặt số dư Kho Arcana"
          : "Đã đặt số dư Kho Tarot",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const vaultGrant = async () => {
    if (managedGame === "arcana") {
      setMsg("Cấp/thu xu chỉ dùng Kho Tarot (ví vận hành chung)");
      return;
    }
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
    const fromServer = data?.inter?.labels?.[mode];
    if (fromServer) return fromServer.split(" — ")[0] ?? fromServer;
    if (mode === "all") return "ALL (xoay slot)";
    if (PACK_MODES.includes(mode as PackMode)) return mode.toUpperCase();
    if (mode.startsWith("pack")) return mode;
    return `Ép lá #${mode}`;
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

  const applyAllSlotMinutes = async () => {
    if (interBusy) return;
    const m = Math.floor(Number(allSlotMinutes));
    if (!Number.isFinite(m) || m < 1 || m > 9) {
      setMsg("Chọn 1–9 phút mỗi slot ALL (< 10 phút)");
      return;
    }
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ allSlotMinutes: m }),
      });
      setMsg(`ALL: mỗi slot ${m} phút`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi cấu hình ALL");
    } finally {
      setInterBusy(false);
    }
  };

  const saveAllRotation = async () => {
    if (interBusy) return;
    if (rotationDraft.length < 2) {
      setMsg("Chuỗi xoay cần ít nhất 2 bước");
      return;
    }
    if (rotationDraft.length > 20) {
      setMsg("Chuỗi xoay tối đa 20 bước");
      return;
    }
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ rotation: rotationDraft }),
      });
      setMsg("Đã lưu chuỗi xoay ALL");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi lưu chuỗi xoay");
    } finally {
      setInterBusy(false);
    }
  };

  const resetAllRotationDefault = async () => {
    const def =
      (data?.inter?.defaultRotation?.filter((x): x is RotateStep =>
        isRotateStep(x),
      ) as RotateStep[] | undefined) ?? DEFAULT_ALL_ROTATION;
    setRotationDraft([...def]);
    if (interBusy) return;
    setInterBusy(true);
    try {
      await api("/api/mainadmin/inter", {
        method: "POST",
        body: JSON.stringify({ rotation: def }),
      });
      setMsg("Đã khôi phục chuỗi xoay mặc định");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi khôi phục chuỗi");
    } finally {
      setInterBusy(false);
    }
  };

  const moveRotationStep = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= rotationDraft.length) return;
    setRotationDraft((steps) => {
      const copy = [...steps];
      const t = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = t;
      return copy;
    });
  };

  const removeRotationStep = (index: number) => {
    setRotationDraft((steps) => steps.filter((_, i) => i !== index));
  };

  const addRotationStep = () => {
    if (rotationDraft.length >= 20) {
      setMsg("Tối đa 20 bước");
      return;
    }
    setRotationDraft((steps) => [...steps, rotationAddMode]);
  };

  const vaultSeize = async () => {
    if (managedGame === "arcana") {
      setMsg("Cấp/thu xu chỉ dùng Kho Tarot (ví vận hành chung)");
      return;
    }
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

  const loadArcanaSpins = async (filterRaw?: string) => {
    try {
      const q = (filterRaw ?? arcanaSpinFilter).trim();
      let userId = "";
      if (q) {
        const match = data?.users.find(
          (u) =>
            u.id === q ||
            u.code?.toUpperCase() === q.toUpperCase() ||
            u.username.toLowerCase() === q.toLowerCase(),
        );
        if (!match) {
          setMsg("Không tìm thấy user/code để lọc spins");
          return;
        }
        userId = match.id;
      }
      const url = userId
        ? `/api/mainadmin/arcana/spins?limit=80&userId=${encodeURIComponent(userId)}`
        : "/api/mainadmin/arcana/spins?limit=80";
      const r = await api<{
        ok: true;
        spins: typeof arcanaSpins;
      }>(url);
      setArcanaSpins(r.spins);
      setMsg(
        userId
          ? `Đã tải ${r.spins.length} spin của user`
          : `Đã tải ${r.spins.length} spin gần đây`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi tải spin");
    }
  };

  const toggleArcanaEnabled = async () => {
    if (!data?.arcanaConfig) return;
    setArcanaBusy(true);
    try {
      await api("/api/mainadmin/arcana/config", {
        method: "PATCH",
        body: JSON.stringify({ enabled: !data.arcanaConfig.enabled }),
      });
      setMsg(
        data.arcanaConfig.enabled
          ? "Đã khóa bàn Bánh xe Arcana"
          : "Đã mở bàn Bánh xe Arcana",
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setArcanaBusy(false);
    }
  };

  const saveArcanaSlot = async (slot: ArcanaSlotAdmin) => {
    setArcanaBusy(true);
    try {
      await api("/api/mainadmin/arcana/config", {
        method: "PATCH",
        body: JSON.stringify({
          slots: [{ id: slot.id, ratio: slot.ratio, weight: slot.weight }],
        }),
      });
      setMsg(`Đã lưu ${slot.nameVi}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setArcanaBusy(false);
    }
  };

  const saveArcanaPayoutScale = async () => {
    if (!data?.arcanaConfig) return;
    const el = document.getElementById(
      "arcana-payout-scale",
    ) as HTMLInputElement | null;
    const payoutScale = Number(el?.value);
    if (!Number.isFinite(payoutScale)) {
      setMsg("payoutScale không hợp lệ");
      return;
    }
    setArcanaBusy(true);
    try {
      await api("/api/mainadmin/arcana/config", {
        method: "PATCH",
        body: JSON.stringify({ payoutScale }),
      });
      setMsg("Đã lưu hệ số thưởng (payoutScale)");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setArcanaBusy(false);
    }
  };

  const saveArcanaTutienMax = async () => {
    if (!data?.arcanaConfig) return;
    const tutienMaxByRank: Record<string, number> = {};
    for (const rank of CULTIVATION_RANKS) {
      const el = document.getElementById(
        `arcana-tutien-max-${rank}`,
      ) as HTMLInputElement | null;
      const n = Math.floor(Number(el?.value));
      if (!Number.isFinite(n) || n < 1_000_000 || n > 100_000_000) {
        setMsg(
          `Max ${CULTIVATION_LABELS[rank]} phải từ 1M đến 100M`,
        );
        return;
      }
      tutienMaxByRank[rank] = n;
    }
    setArcanaBusy(true);
    try {
      await api("/api/mainadmin/arcana/config", {
        method: "PATCH",
        body: JSON.stringify({ tutienMaxByRank }),
      });
      setMsg("Đã lưu max cược Tu Tiên (9 bậc)");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setArcanaBusy(false);
    }
  };

  const saveArcanaStreakBonus = async () => {
    if (!data?.arcanaConfig) return;
    const enabled = (
      document.getElementById("arcana-streak-enabled") as HTMLInputElement | null
    )?.checked;
    const minStreak = Number(
      (document.getElementById("arcana-streak-min") as HTMLInputElement | null)
        ?.value,
    );
    const perStep = Number(
      (document.getElementById("arcana-streak-step") as HTMLInputElement | null)
        ?.value,
    );
    const cap = Number(
      (document.getElementById("arcana-streak-cap") as HTMLInputElement | null)
        ?.value,
    );
    if (!Number.isFinite(minStreak) || minStreak < 1) {
      setMsg("Chuỗi tối thiểu phải >= 1");
      return;
    }
    setArcanaBusy(true);
    try {
      await api("/api/mainadmin/arcana/config", {
        method: "PATCH",
        body: JSON.stringify({
          streakBonusEnabled: enabled,
          streakBonusMinStreak: minStreak,
          streakBonusPercentPerStep: perStep,
          streakBonusCapPercent: cap,
        }),
      });
      setMsg("Đã lưu cấu hình chuỗi vận");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setArcanaBusy(false);
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
  const tutienOnly = isTutien(me);
  const modOnly = isMod(me);
  const canCultivation = canManageCultivation(me);
  const canRoom = canAccessRoomAdmin(me);
  const activeVault =
    managedGame === "arcana" ? data.vaultArcana : data.vault;
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "overview", label: "Tổng quan", show: !tutienOnly && !modOnly },
    { id: "tools", label: "Tra cứu", show: main },
    { id: "traffic", label: "Lưu lượng", show: main && managedGame === "tarot" },
    { id: "inter", label: "Inter", show: main && managedGame === "tarot" },
    { id: "arcana", label: "Bánh xe", show: main && managedGame === "arcana" },
    { id: "ips", label: "IP", show: main },
    { id: "chat", label: "Chat", show: main },
    { id: "users", label: "User & Bot", show: !tutienOnly && !modOnly },
    { id: "rolead", label: "RoleAD", show: main },
    { id: "room", label: "Room", show: canRoom },
    { id: "mod", label: "Mod", show: !tutienOnly && !modOnly },
    { id: "coupons", label: "Coupon ẩn", show: !tutienOnly && !modOnly },
    { id: "invites", label: "Mã TV", show: main },
    {
      id: "vault",
      label: managedGame === "arcana" ? "Kho Arcana" : "Kho Tarot",
      show: main,
    },
    { id: "tutien", label: "Tu Tiên", show: canCultivation },
  ];

  const filteredUsers = data.users.filter((u) => {
    if (userQuick === "vip" && !u.isVip) return false;
    if (userQuick === "banned" && !u.banned) return false;
    if (userQuick === "muted" && !u.muted) return false;
    const q = userFilter.trim().toLowerCase();
    if (!q) return true;
    return `${u.username} ${u.code} ${u.id} ${u.role} ${u.cultivationRank ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  const tutienRankUsers = data.users.filter((u) => {
    if (u.role === "mainadmin") return false;
    const q = rankFilter.trim().toLowerCase();
    if (!q) return true;
    return `${u.username} ${u.code} ${u.id} ${u.cultivationRank ?? ""}`
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

      {main && (
        <div className="mt-3 rounded-xl bg-[var(--wood-deep)]/90 p-1.5 ring-1 ring-[var(--gold)]/30">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-soft)]/80">
            Chọn game quản lý
          </p>
          <div className="flex gap-1">
            {(
              [
                ["tarot", "Bàn Tarot"],
                ["arcana", "Bánh xe Arcana"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => selectManagedGame(id)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  managedGame === id
                    ? "bg-[var(--gold)] text-[var(--wood-deep)]"
                    : "bg-transparent text-[var(--cream)]/85 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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
              ["Cược gần đây", String(data.betStats?.rows ?? 0)],
              ["Tổng stake", formatXu(data.betStats?.stakeTotal ?? 0)],
              ["Tổng trả", formatXu(data.betStats?.payoutTotal ?? 0)],
              [
                "Win / Lose",
                `${data.betStats?.winCount ?? 0}/${data.betStats?.loseCount ?? 0}`,
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
              Lịch sử ván ({data.history?.length ?? 0})
            </p>
            <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {(data.history?.length ?? 0) === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">Chưa có ván</li>
              ) : (
                data.history!.map((h) => (
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
              Cược user gần đây ({data.recentBets?.length ?? 0})
            </p>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {(data.recentBets?.length ?? 0) === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">
                  Chưa ghi nhận cược.
                </li>
              ) : (
                data.recentBets!.map((b) => (
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
            <p className="play-heading text-sm">
              Cộng / trừ xu khách (Tarot online)
            </p>
            <p className="mt-1 text-[10px] text-white/45">
              Chỉ khách đang ở bàn hoặc orphan ván hiện tại. Arcana cần đăng
              nhập.
            </p>
            <form onSubmit={applyGuestAdjust} className="mt-2 space-y-2">
              <select
                value={guestAdjust.key}
                onChange={(e) =>
                  setGuestAdjust((a) => ({ ...a, key: e.target.value }))
                }
                className="app-input"
              >
                <option value="">Chọn khách online…</option>
                {(data.liveGuests ?? []).map((g) => (
                  <option key={g.socketId} value={g.socketId}>
                    {g.name}
                    {g.guestCode ? ` · ${g.guestCode}` : ""} (
                    {formatXu(g.balance)} xu)
                    {g.inOrphan ? " · orphan" : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={guestAdjust.delta}
                  onChange={(e) =>
                    setGuestAdjust((a) => ({ ...a, delta: e.target.value }))
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
            </form>
            {(data.liveGuests?.length ?? 0) === 0 && (
              <p className="mt-2 text-[11px] text-white/40">
                Không có khách trên bàn Tarot.
              </p>
            )}
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
                  ? "VIP10K"
                  : rounds >= VIP_ROUNDS_REQUIRED
                    ? "đủ 10k ván"
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
                          src={normalizeAvatar(u.avatar)}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (el.src.includes("avatar-default")) return;
                            el.src = "/assets/ui/avatar-default.png";
                          }}
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
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <CultivationChip rank={u.cultivationRank} />
                          </div>
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
                          {mode === "win" && om === "win"
                            ? `Win ${u.outcomeWinPct ?? 100}%`
                            : label}
                        </button>
                      ))}
                      {om === "win" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-900 ring-1 ring-emerald-300/60">
                          Inter → User Win % để chỉnh 80–100
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setUserVip(u.id, !granted)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          granted
                            ? "bg-amber-500 text-[#1a1208]"
                            : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                        }`}
                      >
                        {granted ? "VIP10K ✓" : "VIP10K"}
                      </button>
                      {data?.me.role === "mainadmin" && (
                          <button
                            type="button"
                            onClick={() =>
                              setUserLeaderboardHide(u.id, !u.hideFromLeaderboard)
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              u.hideFromLeaderboard
                                ? "bg-slate-700 text-white"
                                : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                            }`}
                          >
                            {u.hideFromLeaderboard ? "BXH ẩn ✓" : "Ẩn BXH"}
                          </button>
                        )}
                      {data?.me.role === "mainadmin" && (
                          <button
                            type="button"
                            onClick={() =>
                              setUserHideNickname(u.id, !u.hideNickname)
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              u.hideNickname
                                ? "bg-indigo-800 text-white"
                                : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                            }`}
                          >
                            {u.hideNickname ? "Nick ẩn ✓" : "Ẩn nick"}
                          </button>
                        )}
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
                        onClick={() => openPwReset(u)}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      >
                        Reset MK
                      </button>
                      {data?.me.role === "mainadmin" &&
                        u.role !== "mainadmin" && (
                          <>
                            {u.role !== "deal" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "deal")}
                                className="rounded-full bg-teal-700 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Cấp Deal
                              </button>
                            )}
                            {u.role === "deal" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "user")}
                                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-teal-600/40"
                              >
                                Thu Deal
                              </button>
                            )}
                            {u.role !== "onl" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "onl")}
                                className="rounded-full bg-sky-700 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Cấp Onl
                              </button>
                            )}
                            {u.role === "onl" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "user")}
                                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-sky-600/40"
                              >
                                Thu Onl
                              </button>
                            )}
                            {u.role !== "tutien" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "tutien")}
                                className="rounded-full bg-violet-800 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Cấp Tu Tiên
                              </button>
                            )}
                            {u.role === "tutien" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "user")}
                                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-violet-700/40"
                              >
                                Thu Tu Tiên
                              </button>
                            )}
                            {u.role !== "mod" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "mod")}
                                className="rounded-full bg-indigo-800 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Cấp Mod
                              </button>
                            )}
                            {u.role === "mod" && (
                              <button
                                type="button"
                                onClick={() => setUserRole(u.id, "user")}
                                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-indigo-700/40"
                              >
                                Thu Mod
                              </button>
                            )}
                          </>
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {tab === "rolead" && main && (
        <>
          <section className="app-panel mt-4 space-y-3 p-3">
            <div>
              <p className="play-heading text-sm">RoleAD · Quyền của bạn</p>
              <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                Mainadmin tự bật quyền phụ (áp dụng cả chính mình). Role{" "}
                <strong>mainadmin</strong> không đổi được — bảo vệ tài khoản gốc.
              </p>
            </div>
            {(() => {
              const self =
                data.users.find((u) => u.id === data.me.id) ?? null;
              if (!self) {
                return (
                  <p className="text-xs text-[var(--play-muted)]">
                    Không tải được profile — F5 lại.
                  </p>
                );
              }
              return (
                <div className="rounded-lg bg-white/70 p-3 ring-1 ring-[var(--wood-deep)]/10">
                  <p className="text-sm font-bold text-[var(--play-ink)]">
                    {self.username}{" "}
                    <span className="text-[10px] font-semibold text-[var(--wood-deep)]">
                      {self.role}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                    ID {self.code} · Hiện công khai:{" "}
                    <strong>{self.displayName ?? self.username}</strong>
                  </p>

                  <div className="mt-3 rounded-lg bg-[var(--cream)]/80 px-2.5 py-2 ring-1 ring-[var(--wood-deep)]/10">
                    <p className="text-[11px] font-bold text-[var(--play-ink)]">
                      Nickname trong game
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                      2–12 ký tự · hiện trên bàn / chat / BXH · để trống = dùng
                      username · login vẫn <strong>@{self.username}</strong>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        value={
                          selfNickDraft !== null
                            ? selfNickDraft
                            : (self.nickname ?? "")
                        }
                        onChange={(e) =>
                          setSelfNickDraft(e.target.value.slice(0, 12))
                        }
                        maxLength={12}
                        spellCheck={false}
                        placeholder="Nickname…"
                        className="app-input min-w-[10rem] flex-1 !py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        disabled={selfNickBusy}
                        onClick={() => void saveSelfNickname()}
                        className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {selfNickBusy ? "…" : "Lưu nick"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setUserLeaderboardHide(
                          self.id,
                          !self.hideFromLeaderboard,
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        self.hideFromLeaderboard
                          ? "bg-slate-700 text-white"
                          : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      }`}
                    >
                      {self.hideFromLeaderboard
                        ? "Ẩn BXH · đang bật"
                        : "Ẩn khỏi BXH"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setUserHideNickname(self.id, !self.hideNickname)
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        self.hideNickname
                          ? "bg-indigo-800 text-white"
                          : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                      }`}
                    >
                      {self.hideNickname
                        ? "Ẩn nick · đang bật"
                        : "Ẩn nick (Ẩn danh)"}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--play-muted)]">
                    Ẩn nick: bàn chơi / profile hiện <em>Ẩn danh</em> thay vì
                    nickname. Username login không đổi.
                  </p>
                </div>
              );
            })()}
          </section>

          <section className="app-panel mt-3 space-y-2 p-3">
            <p className="play-heading text-sm">Cấp / thu role</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              user · deal · admin · onl · tutien · mod. Không đụng tài khoản
              mainadmin khác.
            </p>
            <input
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Lọc username / ID / role…"
              className="app-input w-full !py-1.5 text-sm"
            />
            <ul className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto">
              {filteredUsers
                .filter((u) => u.role !== "mainadmin" || u.id === data.me.id)
                .slice(0, 80)
                .map((u) => (
                  <li
                    key={u.id}
                    className="rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--play-ink)]">
                          {u.username}{" "}
                          <span className="text-[var(--wood-deep)]">
                            {u.role}
                          </span>
                          {u.id === data.me.id && (
                            <span className="ml-1 text-amber-700">(bạn)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-[var(--play-muted)]">
                          {u.code} · {u.displayName ?? u.username}
                          {u.hideNickname ? " · nick ẩn" : ""}
                          {u.hideFromLeaderboard ? " · BXH ẩn" : ""}
                        </p>
                      </div>
                    </div>
                    {u.role !== "mainadmin" && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(
                          [
                            ["user", "User"],
                            ["deal", "Deal"],
                            ["admin", "Admin"],
                            ["onl", "Onl"],
                            ["tutien", "Tu Tiên"],
                            ["mod", "Mod"],
                          ] as const
                        ).map(([role, label]) => (
                          <button
                            key={role}
                            type="button"
                            disabled={u.role === role}
                            onClick={() => setUserRole(u.id, role)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold disabled:opacity-40 ${
                              u.role === role
                                ? "bg-[var(--wood-deep)] text-[var(--gold-soft)]"
                                : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setUserLeaderboardHide(
                              u.id,
                              !u.hideFromLeaderboard,
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            u.hideFromLeaderboard
                              ? "bg-slate-700 text-white"
                              : "bg-white ring-1 ring-[var(--wood-deep)]/15"
                          }`}
                        >
                          {u.hideFromLeaderboard ? "BXH ẩn ✓" : "Ẩn BXH"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setUserHideNickname(u.id, !u.hideNickname)
                          }
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            u.hideNickname
                              ? "bg-indigo-800 text-white"
                              : "bg-white ring-1 ring-[var(--wood-deep)]/15"
                          }`}
                        >
                          {u.hideNickname ? "Nick ẩn ✓" : "Ẩn nick"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}

      {tab === "tutien" && canCultivation && (
        <>
          <section className="app-panel mt-4 p-3 sm:p-4">
            <p className="play-heading text-sm">Gán cảnh giới</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              9 bậc công khai — hiện chip màu trên badge / profile người chơi.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-[11px] font-semibold text-[var(--play-muted)]">
                Người chơi
                <select
                  value={rankDraftUserId}
                  onChange={(e) => setRankDraftUserId(e.target.value)}
                  className="app-input mt-1 w-full !py-1.5 text-sm"
                >
                  <option value="">Chọn user…</option>
                  {tutienRankUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} · {u.code}
                      {u.cultivationRank
                        ? ` · ${CULTIVATION_LABELS[u.cultivationRank as CultivationRank] ?? u.cultivationRank}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:w-44 text-[11px] font-semibold text-[var(--play-muted)]">
                Cảnh giới
                <select
                  value={rankDraftValue}
                  onChange={(e) => setRankDraftValue(e.target.value)}
                  className="app-input mt-1 w-full !py-1.5 text-sm"
                >
                  <option value="">— Xóa —</option>
                  {CULTIVATION_RANKS.map((r) => (
                    <option key={r} value={r}>
                      {CULTIVATION_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={cultivationBusy || !rankDraftUserId}
                onClick={() =>
                  void setCultivationRank(
                    rankDraftUserId,
                    rankDraftValue
                      ? (rankDraftValue as CultivationRank)
                      : null,
                  )
                }
                className="rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-50"
              >
                Lưu rank
              </button>
            </div>
            <input
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              placeholder="Lọc danh sách…"
              className="app-input mt-3 w-full !py-1.5 text-sm"
            />
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto sm:max-h-80">
              {tutienRankUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--play-ink)]">
                      {u.username}{" "}
                      <span className="font-mono text-[var(--play-muted)]">
                        · {u.code}
                      </span>
                    </p>
                    <div className="mt-0.5">
                      <CultivationChip rank={u.cultivationRank} />
                      {!u.cultivationRank && (
                        <span className="text-[10px] text-[var(--play-muted)]">
                          Chưa có cảnh giới
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CULTIVATION_RANKS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={cultivationBusy}
                        onClick={() => void setCultivationRank(u.id, r)}
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${
                          u.cultivationRank === r
                            ? "bg-[var(--wood-deep)] text-[var(--cream)] ring-[var(--wood-deep)]"
                            : "bg-white text-[var(--play-ink)] ring-[var(--wood-deep)]/20"
                        }`}
                        title={CULTIVATION_LABELS[r]}
                      >
                        {CULTIVATION_LABELS[r].split(" ")[0]}
                      </button>
                    ))}
                    {u.cultivationRank && (
                      <button
                        type="button"
                        disabled={cultivationBusy}
                        onClick={() => void setCultivationRank(u.id, null)}
                        className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-red-800 ring-1 ring-red-300/60"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="app-panel mt-4 p-3 sm:p-4">
            <p className="play-heading text-sm">Màu cảnh giới</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              bg / text / border (hex) — lưu trên server, chip cập nhật sau khi
              lưu.
              {data.cultivation?.updatedBy
                ? ` · Sửa gần nhất: ${data.cultivation.updatedBy}`
                : ""}
            </p>
            <ul className="mt-3 space-y-2">
              {CULTIVATION_RANKS.map((r) => {
                const row = cultivationColors[r];
                return (
                  <li
                    key={r}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-2 ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <CultivationChip rank={r} colors={row} />
                    <span className="w-20 shrink-0 text-[11px] font-semibold text-[var(--play-ink)]">
                      {CULTIVATION_LABELS[r]}
                    </span>
                    {(
                      [
                        ["bg", "Nền"],
                        ["text", "Chữ"],
                        ["border", "Viền"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-1 text-[10px] text-[var(--play-muted)]"
                      >
                        {label}
                        <input
                          type="color"
                          value={row[key]}
                          onChange={(e) =>
                            setCultivationColors((prev) => ({
                              ...prev,
                              [r]: { ...prev[r], [key]: e.target.value },
                            }))
                          }
                          className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <input
                          value={row[key]}
                          onChange={(e) =>
                            setCultivationColors((prev) => ({
                              ...prev,
                              [r]: { ...prev[r], [key]: e.target.value },
                            }))
                          }
                          className="app-input !w-[5.5rem] !py-1 font-mono text-[10px]"
                        />
                      </label>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={cultivationBusy}
                onClick={() => void saveCultivationColors()}
                className="rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-50"
              >
                Lưu màu
              </button>
              <button
                type="button"
                disabled={cultivationBusy}
                onClick={() =>
                  setCultivationColors(
                    structuredClone(DEFAULT_CULTIVATION_COLORS),
                  )
                }
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
              >
                Reset mặc định (chưa lưu)
              </button>
            </div>
          </section>

          {main && (
            <section className="app-panel mt-4 p-3 sm:p-4">
              <p className="play-heading text-sm">Lợi ích + phí duy trì</p>
              <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                Giảm phí chat %, ưu tiên ghế voice, phí ngày/tuần. Không trả → tụt
                bậc.
              </p>
              <ul className="mt-3 space-y-2">
                {CULTIVATION_RANKS.map((r) => (
                  <li
                    key={r}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-2 text-[10px] ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <span className="w-20 shrink-0 font-semibold">
                      {CULTIVATION_LABELS[r]}
                    </span>
                    <label className="flex items-center gap-1">
                      Chat%
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={cultBenefits[r].chatDiscountPct}
                        onChange={(e) =>
                          setCultBenefits((p) => ({
                            ...p,
                            [r]: {
                              ...p[r],
                              chatDiscountPct: Number(e.target.value),
                            },
                          }))
                        }
                        className="app-input !w-14 !py-1"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      Ưu tiên
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={cultBenefits[r].voiceSeatPriority}
                        onChange={(e) =>
                          setCultBenefits((p) => ({
                            ...p,
                            [r]: {
                              ...p[r],
                              voiceSeatPriority: Number(e.target.value),
                            },
                          }))
                        }
                        className="app-input !w-12 !py-1"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      Phí
                      <input
                        type="number"
                        min={0}
                        value={cultMaint[r].feeXu}
                        onChange={(e) =>
                          setCultMaint((p) => ({
                            ...p,
                            [r]: { ...p[r], feeXu: Number(e.target.value) },
                          }))
                        }
                        className="app-input !w-20 !py-1"
                      />
                    </label>
                    <select
                      value={cultMaint[r].period}
                      onChange={(e) =>
                        setCultMaint((p) => ({
                          ...p,
                          [r]: {
                            ...p[r],
                            period: e.target.value as "day" | "week",
                          },
                        }))
                      }
                      className="app-input !w-24 !py-1"
                    >
                      <option value="day">Ngày</option>
                      <option value="week">Tuần</option>
                    </select>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={cultivationBusy}
                onClick={() => void saveCultivationConfig()}
                className="mt-3 rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-50"
              >
                Lưu lợi ích + phí
              </button>
            </section>
          )}
        </>
      )}

      {tab === "room" && canRoom && (
        <section className="app-panel mt-4 space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="play-heading text-sm">Room — điều hành voice</p>
              <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                Quyền <strong>mainadmin</strong> / <strong>mod</strong>: mở–đóng
                phòng, mute mic, kick, dọn phòng. Tự refresh ~4s.
              </p>
            </div>
            <button
              type="button"
              disabled={roomBusy}
              onClick={() => void loadRooms()}
              className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
            >
              Làm mới
            </button>
          </div>
          <div className="space-y-3">
            {(roomLobby.length
              ? roomLobby
              : [1, 2, 3, 4, 5].map((id) => ({
                  roomId: id,
                  hostSocketId: null,
                  hostUserId: null,
                  seats: Array.from({ length: 8 }, () => null),
                  occupied: 0,
                  open: true,
                }))
            ).map((room) => (
              <div
                key={room.roomId}
                className={`rounded-xl px-3 py-2.5 ring-1 ${
                  room.open === false
                    ? "bg-rose-50 ring-rose-300/60"
                    : "bg-white/80 ring-[var(--wood-deep)]/12"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--play-ink)]">
                    Room {room.roomId}{" "}
                    <span className="text-[10px] font-semibold text-[var(--play-muted)]">
                      {room.occupied}/8 ·{" "}
                      {room.open === false ? "ĐÓNG" : "Mở"}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={roomBusy}
                      onClick={() =>
                        void roomAction(
                          "/api/room/set-open",
                          {
                            roomId: room.roomId,
                            open: room.open === false,
                          },
                          room.open === false
                            ? `Đã mở Room ${room.roomId}`
                            : `Đã đóng Room ${room.roomId}`,
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        room.open === false
                          ? "bg-emerald-700 text-white"
                          : "bg-rose-700 text-white"
                      }`}
                    >
                      {room.open === false ? "Mở phòng" : "Đóng phòng"}
                    </button>
                    <button
                      type="button"
                      disabled={roomBusy || room.occupied === 0}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Dọn hết ghế Room ${room.roomId}?`,
                          )
                        )
                          return;
                        void roomAction(
                          "/api/room/clear",
                          { roomId: room.roomId },
                          `Đã dọn Room ${room.roomId}`,
                        );
                      }}
                      className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                    >
                      Dọn phòng
                    </button>
                  </div>
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {room.seats.map((seat, idx) => {
                    if (!seat) {
                      return (
                        <li
                          key={`empty-${room.roomId}-${idx}`}
                          className="rounded-lg bg-[var(--cream)]/60 px-2 py-1.5 text-[10px] text-[var(--play-muted)]"
                        >
                          Ghế {idx + 1} · trống
                        </li>
                      );
                    }
                    return (
                      <li
                        key={seat.socketId}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--play-ink)]">
                            #{seat.seat} {seat.name}
                            {seat.forceMuted ? (
                              <span className="ml-1 text-rose-600">mute</span>
                            ) : null}
                          </p>
                          <p className="truncate text-[9px] text-[var(--play-muted)]">
                            {seat.userId.slice(0, 10)}…
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            disabled={roomBusy}
                            onClick={() =>
                              void roomAction(
                                "/api/room/force-mute",
                                {
                                  targetSocketId: seat.socketId,
                                  muted: !seat.forceMuted,
                                },
                                seat.forceMuted
                                  ? `Bỏ mute ${seat.name}`
                                  : `Mute ${seat.name}`,
                              )
                            }
                            className="rounded-full bg-amber-600/90 px-2 py-0.5 text-[9px] font-bold text-white"
                          >
                            {seat.forceMuted ? "Unmute" : "Mute"}
                          </button>
                          <button
                            type="button"
                            disabled={roomBusy}
                            onClick={() =>
                              void roomAction(
                                "/api/room/kick",
                                { targetSocketId: seat.socketId },
                                `Kick ${seat.name}`,
                              )
                            }
                            className="rounded-full bg-rose-700 px-2 py-0.5 text-[9px] font-bold text-white"
                          >
                            Kick
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
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

      {tab === "chat" && main && (
        <section className="app-panel mt-4 p-3 sm:p-4">
          <p className="play-heading text-sm">Giá chat phòng Tarot</p>
          <p className="mt-1 text-[11px] text-[var(--play-muted)]">
            No = khung chat · VIP = bay marquee (cần VIP) · Saint = toàn màn +
            CD 45s. Lịch sử khung chat reset mỗi ngày (UTC).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-[var(--play-muted)]">
              No (xu / tin)
              <input
                id="mainadmin-chat-no-cost"
                type="number"
                min={1}
                max={100000}
                step={1}
                defaultValue={data.chatConfig?.noCost ?? 10}
                className="app-input mt-1 w-full !py-1.5 text-sm tabular-nums"
              />
            </label>
            <label className="text-[11px] font-semibold text-[var(--play-muted)]">
              VIP (xu / tin)
              <input
                id="mainadmin-chat-vip-cost"
                type="number"
                min={1}
                max={100000}
                step={1}
                defaultValue={data.chatConfig?.vipCost ?? 50}
                className="app-input mt-1 w-full !py-1.5 text-sm tabular-nums"
              />
            </label>
            <label className="text-[11px] font-semibold text-[var(--play-muted)]">
              Saint (xu / tin)
              <input
                id="mainadmin-chat-saint-cost"
                type="number"
                min={100}
                max={1000000}
                step={100}
                defaultValue={data.chatConfig?.saintCost ?? 10_000}
                className="app-input mt-1 w-full !py-1.5 text-sm tabular-nums"
              />
            </label>
          </div>
          <button
            type="button"
            className="app-btn-primary mt-4 !w-auto !px-4 !py-2 !text-xs"
            onClick={async () => {
              const noEl = document.getElementById(
                "mainadmin-chat-no-cost",
              ) as HTMLInputElement | null;
              const vipEl = document.getElementById(
                "mainadmin-chat-vip-cost",
              ) as HTMLInputElement | null;
              const saintEl = document.getElementById(
                "mainadmin-chat-saint-cost",
              ) as HTMLInputElement | null;
              try {
                await api("/api/mainadmin/chat-config", {
                  method: "POST",
                  body: JSON.stringify({
                    noCost: Number(noEl?.value),
                    vipCost: Number(vipEl?.value),
                    saintCost: Number(saintEl?.value),
                  }),
                });
                setMsg("Đã lưu giá chat No / VIP / Saint");
                await load();
              } catch (err) {
                setMsg(
                  err instanceof Error ? err.message : "Lỗi cấu hình chat",
                );
              }
            }}
          >
            Áp dụng
          </button>
          {data.chatConfig?.updatedBy && (
            <p className="mt-2 text-[10px] text-[var(--play-muted)]">
              Cập nhật lần cuối: {data.chatConfig.updatedBy}
              {data.chatConfig.updatedAt
                ? ` · ${new Date(data.chatConfig.updatedAt).toLocaleString("vi-VN")}`
                : ""}
            </p>
          )}
          <section className="mt-4 border-t border-[var(--wood-deep)]/12 pt-3">
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
        </section>
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
                    {(row.devices ?? []).length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-[var(--wood-deep)]/10 pt-1.5">
                        <p className="text-[10px] font-semibold text-[var(--play-muted)]">
                          Thiết bị (gần IP này):
                        </p>
                        {(row.devices ?? []).slice(0, 5).map((d) => (
                          <div
                            key={d.deviceId}
                            className="rounded-lg bg-white/60 px-2 py-1 text-[10px] text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/10"
                          >
                            <p className="font-mono font-semibold">
                              {d.shortId}
                              {d.online ? " · online" : ""}
                              {d.blocked ? " · BLOCK TB" : ""}
                              {d.meta.platform
                                ? ` · ${d.meta.platform}`
                                : ""}
                              {d.meta.screen ? ` · ${d.meta.screen}` : ""}
                            </p>
                            {d.meta.ua && (
                              <p className="mt-0.5 line-clamp-2 text-[9px] text-[var(--play-muted)]">
                                {d.meta.ua}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={ipBusy}
                                className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold text-white disabled:opacity-40"
                                onClick={() =>
                                  void runIpAction(
                                    "/api/mainadmin/devices/block",
                                    { deviceId: d.deviceId, hours: 24 },
                                    `Block TB 24h ${d.shortId}`,
                                  )
                                }
                              >
                                Block TB 24h
                              </button>
                              <button
                                type="button"
                                disabled={ipBusy || !d.blocked}
                                className="rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] font-bold text-white disabled:opacity-40"
                                onClick={() =>
                                  void runIpAction(
                                    "/api/mainadmin/devices/block",
                                    { deviceId: d.deviceId, hours: 0 },
                                    `Mở TB ${d.shortId}`,
                                  )
                                }
                              >
                                Mở TB
                              </button>
                              <button
                                type="button"
                                disabled={ipBusy}
                                className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-40"
                                onClick={() =>
                                  void runIpAction(
                                    "/api/mainadmin/devices/kick",
                                    { deviceId: d.deviceId },
                                    `Kick TB ${d.shortId}`,
                                  )
                                }
                              >
                                Kick TB
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

      {tab === "invites" && main && (
        <>
          <section className="app-panel mt-4 p-3">
            <p className="play-heading text-sm">Tạo mã thành viên</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Đúng 8 ký tự (A–Z / 0–9). Để trống mã → hệ thống random. Mỗi mã
              dùng được nhiều lần tới max. Đăng ký bắt buộc nhập mã.
            </p>
            <form onSubmit={createInvite} className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  value={inviteForm.code}
                  onChange={(e) =>
                    setInviteForm((f) => ({
                      ...f,
                      code: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 8),
                    }))
                  }
                  placeholder="Mã 8 ký tự (tuỳ chọn)"
                  maxLength={8}
                  spellCheck={false}
                  className="app-input !py-1.5 font-mono text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={randomInviteCode}
                  disabled={inviteBusy}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
                >
                  Random
                </button>
                <input
                  value={inviteForm.maxUses}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, maxUses: e.target.value }))
                  }
                  placeholder="Max lần dùng"
                  type="number"
                  min={1}
                  max={1_000_000}
                  className="app-input !w-28 !py-1.5 text-xs"
                  required
                />
              </div>
              <input
                value={inviteForm.note}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="Ghi chú (tuỳ chọn)"
                className="app-input !py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={inviteBusy || !inviteForm.maxUses.trim()}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45"
              >
                Tạo mã
              </button>
            </form>
          </section>

          <section className="app-panel mt-4 p-3">
            <p className="play-heading text-sm">Danh sách mã thành viên</p>
            <ul className="mt-3 space-y-2">
              {(data.invites ?? []).length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">
                  Chưa có mã — tạo mã trước khi mở đăng ký
                </li>
              ) : (
                (data.invites ?? []).map((inv) => {
                  const exhausted = inv.usedCount >= inv.maxUses;
                  return (
                    <li
                      key={inv.code}
                      className="rounded-lg bg-white/80 px-3 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold tracking-wide text-[var(--play-ink)]">
                            {inv.code}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                            {inv.usedCount}/{inv.maxUses} lần
                            {exhausted ? " · hết lượt" : ""}
                            {inv.note ? ` · ${inv.note}` : ""}
                            {inv.createdBy
                              ? ` · bởi ${inv.createdBy}`
                              : ""}
                            {" · "}
                            {new Date(inv.createdAt).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              inv.enabled && !exhausted
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {inv.enabled
                              ? exhausted
                                ? "Hết"
                                : "Bật"
                              : "Tắt"}
                          </span>
                          <button
                            type="button"
                            disabled={inviteBusy}
                            onClick={() =>
                              void toggleInvite(inv.code, !inv.enabled)
                            }
                            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
                          >
                            {inv.enabled ? "Tắt" : "Bật"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </>
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
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(
              [
                ["room", "Phòng Inter"],
                ["userWin", "User Win %"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setInterSubTab(id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  interSubTab === id
                    ? "bg-[var(--wood-deep)] text-white"
                    : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {interSubTab === "userWin" && (
            <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
              <div>
                <p className="play-heading text-sm">User Win % — ép thắng theo xác suất</p>
                <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                  Mode Win không còn luôn 100%. Chỉnh <strong>80–100%</strong>:
                  mỗi ván user có cược sẽ được ép thắng với xác suất đó; phần còn
                  lại theo Inter phòng. 100% = như cũ.
                </p>
              </div>
              <input
                value={winPctFilter}
                onChange={(e) => setWinPctFilter(e.target.value)}
                placeholder="Lọc username / ID…"
                className="app-input w-full !py-1.5 text-xs"
              />
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                {[...data.users]
                  .filter((u) => u.role !== "mainadmin")
                  .filter((u) => {
                    const q = winPctFilter.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      u.username.toLowerCase().includes(q) ||
                      (u.code || "").toLowerCase().includes(q) ||
                      (u.displayName || "").toLowerCase().includes(q)
                    );
                  })
                  .sort((a, b) => {
                    const aw = (a.outcomeMode ?? "normal") === "win" ? 0 : 1;
                    const bw = (b.outcomeMode ?? "normal") === "win" ? 0 : 1;
                    if (aw !== bw) return aw - bw;
                    return a.username.localeCompare(b.username, "vi");
                  })
                  .map((u) => {
                    const om = u.outcomeMode ?? "normal";
                    const pct =
                      winPctDrafts[u.id] !== undefined
                        ? winPctDrafts[u.id]!
                        : String(u.outcomeWinPct ?? 100);
                    const pctNum = Math.max(
                      80,
                      Math.min(100, Math.floor(Number(pct)) || 100),
                    );
                    return (
                      <li
                        key={u.id}
                        className={`rounded-lg px-2.5 py-2 text-xs ring-1 ${
                          om === "win"
                            ? "bg-emerald-50 ring-emerald-300/70"
                            : "bg-white/70 ring-[var(--wood-deep)]/10"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--play-ink)]">
                              {u.username}{" "}
                              <span className="text-[10px] font-normal text-[var(--play-muted)]">
                                ID {u.code || "—"} · {u.role}
                              </span>
                            </p>
                            <p className="text-[10px] text-[var(--play-muted)]">
                              {om === "win"
                                ? `Đang WIN @ ${u.outcomeWinPct ?? 100}%`
                                : om === "lose"
                                  ? "Đang LOSE"
                                  : "Normal (theo phòng)"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
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
                                onClick={() =>
                                  void setUserOutcome(
                                    u.id,
                                    mode,
                                    mode === "win" ? pctNum : undefined,
                                  )
                                }
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
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <label className="min-w-[10rem] flex-1 text-[10px] font-semibold text-[var(--play-muted)]">
                            Win % ({pctNum}%)
                            <input
                              type="range"
                              min={80}
                              max={100}
                              step={1}
                              value={pctNum}
                              onChange={(e) =>
                                setWinPctDrafts((d) => ({
                                  ...d,
                                  [u.id]: e.target.value,
                                }))
                              }
                              className="mt-1 w-full accent-emerald-600"
                            />
                          </label>
                          <input
                            type="number"
                            min={80}
                            max={100}
                            value={pct}
                            onChange={(e) =>
                              setWinPctDrafts((d) => ({
                                ...d,
                                [u.id]: e.target.value,
                              }))
                            }
                            className="app-input !w-16 !py-1 text-center text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => void setUserWinPct(u.id, pctNum)}
                            className="rounded-full bg-emerald-700 px-3 py-1.5 text-[10px] font-bold text-white"
                          >
                            Lưu % (bật Win)
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

          {interSubTab === "room" && (
        <>
          <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="play-heading text-sm">Inter — thuật toán lá thắng</p>
                <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                  ALL xoay chuỗi mode — chọn 1–9 phút/slot (&lt; 10 phút).
                  Policy đọc cầu user đăng nhập. Cool dùng 3 lá thắng gần
                  nhất.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300/60">
                Mode:{" "}
                {isInterRotating(data.inter.mode)
                  ? `${data.inter.mode === "all" ? "ALL" : data.inter.mode.toUpperCase()}→${(data.inter.effectiveMode ?? data.inter.all?.effectiveMode ?? "?").toUpperCase()}`
                  : interModeLabel(data.inter.mode)}
              </span>
            </div>

            <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-[var(--wood-deep)]/15">
              <p className="text-xs font-bold text-[var(--play-ink)]">
                Win bias + Vault→Inter
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                Bias + nghiêng Big (5–8), − nghiêng Small (1–4). Link: Kho lỗ →
                mode mất, Kho lãi → mode thắng.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  winBiasPct (−50…50)
                  <input
                    value={winBiasDraft}
                    onChange={(e) => setWinBiasDraft(e.target.value)}
                    type="number"
                    min={-50}
                    max={50}
                    className="app-input mt-0.5 !w-24 !py-1"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] font-semibold">
                  <input
                    type="checkbox"
                    checked={vaultLinkDraft.enabled}
                    onChange={(e) =>
                      setVaultLinkDraft((d) => ({
                        ...d,
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  Bật vault link
                </label>
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  Ngưỡng lỗ
                  <input
                    value={vaultLinkDraft.lossThresholdXu}
                    onChange={(e) =>
                      setVaultLinkDraft((d) => ({
                        ...d,
                        lossThresholdXu: e.target.value,
                      }))
                    }
                    className="app-input mt-0.5 !w-28 !py-1"
                  />
                </label>
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  Ngưỡng lãi
                  <input
                    value={vaultLinkDraft.profitThresholdXu}
                    onChange={(e) =>
                      setVaultLinkDraft((d) => ({
                        ...d,
                        profitThresholdXu: e.target.value,
                      }))
                    }
                    className="app-input mt-0.5 !w-28 !py-1"
                  />
                </label>
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  Khi lỗ
                  <select
                    value={vaultLinkDraft.onLossMode}
                    onChange={(e) =>
                      setVaultLinkDraft((d) => ({
                        ...d,
                        onLossMode: e.target.value,
                      }))
                    }
                    className="app-input mt-0.5 !py-1"
                  >
                    <option value="small">small</option>
                    <option value="app">app</option>
                    <option value="fed">fed</option>
                    <option value="cool">cool</option>
                  </select>
                </label>
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  Khi lãi
                  <select
                    value={vaultLinkDraft.onProfitMode}
                    onChange={(e) =>
                      setVaultLinkDraft((d) => ({
                        ...d,
                        onProfitMode: e.target.value,
                      }))
                    }
                    className="app-input mt-0.5 !py-1"
                  >
                    <option value="big">big</option>
                    <option value="user">user</option>
                    <option value="hot">hot</option>
                    <option value="auto">auto</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={interBusy}
                  onClick={() => void saveWinBiasAndVaultLink()}
                  className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                >
                  Lưu bias / link
                </button>
              </div>
            </div>

            {isInterRotating(data.inter.mode) && data.inter.all && (
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
                  {data.inter.all.slotMinutes ??
                    Math.round(data.inter.all.slotMs / 60000)}{" "}
                  phút)
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-amber-200/80">
              <label className="min-w-[8rem] flex-1 text-[11px] font-semibold text-[var(--play-ink)]">
                ALL — phút mỗi slot
                <select
                  value={allSlotMinutes}
                  onChange={(e) => setAllSlotMinutes(e.target.value)}
                  className="app-input mt-1 w-full"
                  disabled={interBusy}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} phút
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={interBusy}
                onClick={() => void applyAllSlotMinutes()}
                className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Áp dụng
              </button>
              <p className="w-full text-[10px] text-[var(--play-muted)]">
                Đang lưu: {data.inter.allSlotMinutes ?? 5} phút/slot. Đổi phút
                khi đang ALL sẽ reset lại slot hiện tại.
              </p>
            </div>

            <div className="space-y-2 rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-amber-200/80">
              <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                Chuỗi xoay ALL (2–20 bước)
              </p>
              <p className="text-[10px] text-[var(--play-muted)]">
                Thứ tự mode khi Inter = ALL. Lưu chuỗi sẽ reset slot hiện tại
                nếu đang chạy ALL.
              </p>
              <ul className="space-y-1">
                {rotationDraft.map((step, i) => (
                  <li
                    key={`${step}-${i}`}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-50/90 px-2 py-1.5 ring-1 ring-amber-200/60"
                  >
                    <span className="w-5 text-center text-[10px] font-bold tabular-nums text-amber-900">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-bold uppercase text-[var(--play-ink)]">
                      {step}
                    </span>
                    <button
                      type="button"
                      disabled={interBusy || i === 0}
                      onClick={() => moveRotationStep(i, -1)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--wood-deep)] disabled:opacity-40"
                      title="Lên"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={interBusy || i >= rotationDraft.length - 1}
                      onClick={() => moveRotationStep(i, 1)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--wood-deep)] disabled:opacity-40"
                      title="Xuống"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={interBusy || rotationDraft.length <= 2}
                      onClick={() => removeRotationStep(i)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-rose-700 disabled:opacity-40"
                      title="Xóa"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[7rem] flex-1 text-[11px] font-semibold text-[var(--play-ink)]">
                  Thêm bước
                  <select
                    value={rotationAddMode}
                    onChange={(e) =>
                      setRotationAddMode(e.target.value as RotateStep)
                    }
                    className="app-input mt-1 w-full"
                    disabled={interBusy}
                  >
                    {interRotateOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={interBusy || rotationDraft.length >= 20}
                  onClick={addRotationStep}
                  className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Thêm
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={interBusy}
                  onClick={() => void saveAllRotation()}
                  className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Lưu chuỗi
                </button>
                <button
                  type="button"
                  disabled={interBusy}
                  onClick={() => void resetAllRotationDefault()}
                  className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/25 disabled:opacity-50"
                >
                  Khôi phục mặc định
                </button>
              </div>
              <p className="text-[10px] text-[var(--play-muted)]">
                Đang lưu trên server:{" "}
                {(data.inter.allRotation ?? DEFAULT_ALL_ROTATION).join(" → ")}
              </p>
            </div>

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
              <p className="text-sm font-bold">
                ALL — xoay mode ({data.inter.allSlotMinutes ?? 5} phút/slot)
              </p>
              <p
                className={`mt-1 text-[10px] leading-snug ${
                  data.inter.mode === "all"
                    ? "text-white/80"
                    : "text-[var(--play-muted)]"
                }`}
              >
                {(data.inter.allRotation ?? DEFAULT_ALL_ROTATION).join(" → ")}
              </p>
            </button>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                Bộ mode 1–4 — xoay chuỗi cố định (cùng phút/slot như ALL)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {interModePacks.map((pack) => {
                  const active = data.inter!.mode === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      disabled={interBusy}
                      onClick={() => setInterMode(pack.id)}
                      className={`rounded-xl px-3 py-3 text-left transition ring-1 ${
                        active
                          ? "bg-indigo-700 text-white ring-indigo-800 shadow-sm"
                          : "bg-white/90 text-[var(--play-ink)] ring-indigo-200/60 hover:bg-indigo-50"
                      } ${interBusy ? "opacity-60" : ""}`}
                    >
                      <p className="text-sm font-bold">{pack.label}</p>
                      <p
                        className={`mt-1 text-[10px] leading-snug ${
                          active ? "text-white/80" : "text-[var(--play-muted)]"
                        }`}
                      >
                        {pack.rotation.length
                          ? pack.rotation.join(" → ")
                          : "—"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--play-ink)]">
                20 thuật toán — chọn một mode cố định
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {interRotateOptions.map((m) => {
                  const active = data.inter!.mode === m.id;
                  const stakeHint =
                    m.id === "app" ||
                    m.id === "softapp" ||
                    m.id === "user" ||
                    m.id === "fed" ||
                    m.id === "softfed" ||
                    m.id === "hedge" ||
                    m.id === "contrarian" ||
                    m.id === "momentum" ||
                    m.id === "sparse" ||
                    m.id === "dense";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={interBusy}
                      onClick={() => setInterMode(m.id)}
                      className={`rounded-xl px-3 py-2.5 text-left transition ring-1 ${
                        active
                          ? stakeHint
                            ? "bg-rose-600 text-white ring-rose-700 shadow-sm"
                            : "bg-[var(--wood-deep)] text-white ring-[var(--wood-deep)] shadow-sm"
                          : "bg-white/90 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
                      } ${interBusy ? "opacity-60" : ""}`}
                    >
                      <p className="text-xs font-bold uppercase">{m.id}</p>
                      <p
                        className={`mt-0.5 text-[10px] leading-snug ${
                          active ? "text-white/80" : "text-[var(--play-muted)]"
                        }`}
                      >
                        {m.label.replace(/^[^:]+:\s*/, "")}
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
              {data.inter.labels[data.inter.mode] ??
                interModeLabel(data.inter.mode)}
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
              data.inter.mode === "softapp" ||
              data.inter.mode === "user" ||
              data.inter.mode === "fed" ||
              data.inter.mode === "softfed" ||
              data.inter.mode === "hedge" ||
              data.inter.mode === "contrarian" ||
              data.inter.mode === "momentum" ||
              data.inter.mode === "sparse" ||
              data.inter.mode === "dense" ||
              data.inter.effectiveMode === "app" ||
              data.inter.effectiveMode === "softapp" ||
              data.inter.effectiveMode === "user" ||
              data.inter.effectiveMode === "fed" ||
              data.inter.effectiveMode === "softfed" ||
              data.inter.effectiveMode === "hedge" ||
              data.inter.effectiveMode === "contrarian" ||
              data.inter.effectiveMode === "momentum" ||
              data.inter.effectiveMode === "sparse" ||
              data.inter.effectiveMode === "dense") && (
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
              {(data.botPanel?.logs ?? [])
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
              {(data.botPanel?.logs ?? []).filter(
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
        </>
      )}

      {tab === "vault" && main && activeVault && (
        <>
          <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {[
              [
                managedGame === "arcana" ? "Kho Arcana hiện tại" : "Kho Tarot hiện tại",
                formatXu(activeVault.balance),
                true,
              ],
              ["Tổng cược vào", formatXu(activeVault.totalStakeIn), false],
              ["Tổng trả thưởng", formatXu(activeVault.totalPayoutOut), false],
              ["Đã bơm (mint)", formatXu(activeVault.totalMinted), false],
              ["Đã rút (burn)", formatXu(activeVault.totalBurned), false],
              ["Net nhà cái", formatXu(activeVault.netHouse), false],
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

          <section className="app-panel mt-3 p-3">
            <p className="play-heading text-sm">Phân loại ledger (gần đây)</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Net từ chơi:{" "}
              <span className="font-bold tabular-nums">
                {formatXu(
                  activeVault.netFromPlay ??
                    activeVault.totalStakeIn - activeVault.totalPayoutOut,
                )}
              </span>
              {" · "}
              chat/fee/cược ghi rõ loại.
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.entries(activeVault.breakdown ?? {}).map(
                ([type, row]) => (
                  <li
                    key={type}
                    className="rounded-lg bg-white/70 px-2 py-1.5 text-[10px] ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <span className="font-semibold">
                      {LEDGER_LABEL[type] ?? type}
                    </span>
                    <span className="mt-0.5 block tabular-nums text-[var(--play-muted)]">
                      {row.count} GD · {formatXu(row.sum)}
                    </span>
                  </li>
                ),
              )}
              {Object.keys(activeVault.breakdown ?? {}).length === 0 && (
                <li className="text-[11px] text-[var(--play-muted)]">
                  Chưa có breakdown
                </li>
              )}
            </ul>
          </section>

          <section className="app-panel mt-4 space-y-3 p-3">
            <p className="play-heading text-sm">
              Can thiệp {managedGame === "arcana" ? "Kho Arcana" : "Kho Tarot"}
            </p>
            <p className="text-[11px] text-[var(--play-muted)]">
              {managedGame === "arcana"
                ? "Chỉ cược/trả bánh xe ghi kho này. Coupon/cấp xu user dùng Kho Tarot."
                : "Cược bàn Tarot + coupon/cấp/thu xu. Không lẫn Kho Arcana."}
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

          {managedGame === "tarot" && (
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
          )}

          <section className="app-panel mt-4 p-3">
            <p className="play-heading mb-2 text-sm">Sổ kho (gần đây)</p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {activeVault.ledger.length === 0 ? (
                <li className="text-xs text-[var(--play-muted)]">Chưa có giao dịch</li>
              ) : (
                activeVault.ledger.map((row) => (
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

      {tab === "arcana" && main && data.arcanaConfig && (
        <>
          <section className="app-panel mt-4 space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="play-heading text-sm">Bàn Bánh xe Arcana</p>
                <p className="text-[11px] text-[var(--play-muted)]">
                  Hệ số / weight riêng — không dùng Inter Tarot
                </p>
              </div>
              <button
                type="button"
                disabled={arcanaBusy}
                onClick={() => void toggleArcanaEnabled()}
                className={`rounded-full px-3 py-1.5 text-xs font-bold text-white ${
                  data.arcanaConfig.enabled
                    ? "bg-[var(--jade-deep)]"
                    : "bg-rose-700"
                }`}
              >
                {data.arcanaConfig.enabled ? "Đang mở" : "Đang khóa"}
              </button>
            </div>
            {data.arcanaStats && (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
                  <p className="text-[var(--play-muted)]">Spins</p>
                  <p className="font-play font-bold">
                    {data.arcanaStats.spinCount}
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
                  <p className="text-[var(--play-muted)]">Win rate</p>
                  <p className="font-play font-bold">
                    {data.arcanaStats.winRate}%
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
                  <p className="text-[var(--play-muted)]">Edge</p>
                  <p className="font-play font-bold">
                    {formatXu(data.arcanaStats.houseEdgeXu)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
                  <p className="text-[var(--play-muted)]">Kho Arcana</p>
                  <p className="font-play font-bold">
                    {formatXu(data.arcanaStats.vaultBalance)}
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="app-panel mt-3 space-y-2 p-3">
            <p className="play-heading text-sm">Cân bằng RTP (v5)</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Thưởng khi trúng = cược × hệ số × payoutScale ÷ số ô chọn; có thể
              +% chuỗi vận khi thắng liên tiếp. RTP % = kỳ vọng hoàn trả / cược.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-[var(--play-muted)]">
                payoutScale
                <input
                  id="arcana-payout-scale"
                  type="number"
                  min={0.01}
                  max={2}
                  step={0.01}
                  defaultValue={data.arcanaConfig.payoutScale ?? 0.3}
                  className="app-input mt-1 w-28"
                />
              </label>
              <button
                type="button"
                disabled={arcanaBusy}
                onClick={() => void saveArcanaPayoutScale()}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
              >
                Lưu scale
              </button>
            </div>
            <div className="mt-3 rounded-lg bg-white/60 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
              <p className="text-xs font-bold text-[var(--play-ink)]">
                Max cược Tu Tiên — Tarot & Arcana (role tutien · 9 bậc)
              </p>
              <p className="mt-1 text-[10px] text-[var(--play-muted)]">
                Áp dụng trần / lá Tarot và chip Arcana. Mức công khai vẫn ≤1M.
                Cược &gt;1M khi có <strong>role tutien</strong> (mặc định Luyện
                Khí) hoặc đã gán <strong>cảnh giới</strong>.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CULTIVATION_RANKS.map((rank: CultivationRank) => {
                  const def =
                    data.arcanaConfig?.tutienMaxByRank?.[rank] ??
                    ({
                      luyen_khi: 2_000_000,
                      truc_co: 3_000_000,
                      kim_dan: 5_000_000,
                      nguyen_anh: 8_000_000,
                      hoa_than: 12_000_000,
                      luyen_hu: 20_000_000,
                      hop_the: 30_000_000,
                      dai_thua: 40_000_000,
                      do_kiep: 50_000_000,
                    } as Record<CultivationRank, number>)[rank];
                  return (
                    <label
                      key={rank}
                      className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--play-muted)]"
                    >
                      <span className="min-w-0 truncate">
                        {CULTIVATION_LABELS[rank]}
                      </span>
                      <input
                        id={`arcana-tutien-max-${rank}`}
                        type="number"
                        min={1_000_000}
                        max={100_000_000}
                        step={100_000}
                        defaultValue={def}
                        key={`${rank}-${def}`}
                        className="app-input w-28 text-right tabular-nums"
                      />
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={arcanaBusy}
                onClick={() => void saveArcanaTutienMax()}
                className="mt-2 rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
              >
                Lưu max Tu Tiên
              </button>
            </div>
            <div className="mt-3 rounded-lg bg-white/60 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
              <p className="text-xs font-bold text-[var(--play-ink)]">
                Chuỗi vận — thưởng thêm khi thắng
              </p>
              <p className="mt-1 text-[10px] text-[var(--play-muted)]">
                Chuỗi thắng trước lượt quay ≥ ngưỡng → thắng lượt đó +% trên
                thưởng gốc. Chuỗi thua chỉ hiển thị.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                <input
                  id="arcana-streak-enabled"
                  type="checkbox"
                  defaultChecked={data.arcanaConfig.streakBonusEnabled !== false}
                  className="h-4 w-4 accent-[var(--jade-deep)]"
                />
                Bật thưởng chuỗi vận
              </label>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  Ngưỡng
                  <input
                    id="arcana-streak-min"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={data.arcanaConfig.streakBonusMinStreak ?? 3}
                    className="app-input mt-0.5 w-20"
                  />
                </label>
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  +% / bước
                  <input
                    id="arcana-streak-step"
                    type="number"
                    min={0}
                    max={50}
                    defaultValue={
                      data.arcanaConfig.streakBonusPercentPerStep ?? 5
                    }
                    className="app-input mt-0.5 w-20"
                  />
                </label>
                <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                  Trần %
                  <input
                    id="arcana-streak-cap"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={data.arcanaConfig.streakBonusCapPercent ?? 15}
                    className="app-input mt-0.5 w-20"
                  />
                </label>
                <button
                  type="button"
                  disabled={arcanaBusy}
                  onClick={() => void saveArcanaStreakBonus()}
                  className="rounded-lg bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-[var(--gold-soft)]"
                >
                  Lưu chuỗi vận
                </button>
              </div>
            </div>
            {data.arcanaRtpPreview && data.arcanaRtpPreview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="mt-2 w-full min-w-[20rem] text-left text-[10px]">
                  <thead>
                    <tr className="text-[var(--play-muted)]">
                      <th className="py-1 pr-2">Số ô</th>
                      <th className="py-1 pr-2">P thắng %</th>
                      <th className="py-1 pr-2">RTP tối ưu %</th>
                      <th className="py-1">RTP id 1..k %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.arcanaRtpPreview.map((row) => {
                      const warn =
                        row.rtpOptimal > 105 || row.rtpOptimal < 85;
                      return (
                        <tr
                          key={row.pickCount}
                          className={
                            warn
                              ? "font-bold text-rose-700"
                              : "text-[var(--play-ink)]"
                          }
                        >
                          <td className="py-0.5 pr-2">{row.pickCount}</td>
                          <td className="py-0.5 pr-2 tabular-nums">
                            {row.winProbability}
                          </td>
                          <td className="py-0.5 pr-2 tabular-nums">
                            {row.rtpOptimal}
                          </td>
                          <td className="py-0.5 tabular-nums">
                            {row.rtpSequential}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-1 text-[10px] text-[var(--play-muted)]">
                  Đỏ: RTP tối ưu &lt;85% hoặc &gt;105%. Chỉnh payoutScale hoặc
                  weight/ratio.
                </p>
              </div>
            )}
          </section>
          <section className="app-panel mt-3 space-y-2 p-3">
            <p className="play-heading text-sm">Hệ số & weight 8 lá</p>
            <ul className="space-y-2">
              {data.arcanaConfig.slots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                >
                  <img
                    src={slot.image}
                    alt=""
                    className="h-10 w-7 rounded object-cover object-top"
                    onError={(e) => onArcanaImgError(e, slot.id)}
                  />
                  <span className="min-w-[6rem] font-semibold">
                    {slot.nameVi}
                  </span>
                  <label className="flex items-center gap-1">
                    1:
                    <input
                      type="number"
                      min={1}
                      className="app-input w-16 py-1"
                      defaultValue={slot.ratio}
                      id={`arcana-ratio-${slot.id}`}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    w
                    <input
                      type="number"
                      min={0}
                      className="app-input w-16 py-1"
                      defaultValue={slot.weight}
                      id={`arcana-weight-${slot.id}`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={arcanaBusy}
                    className="rounded-full bg-[var(--wood-deep)] px-2.5 py-1 text-[10px] font-bold text-white"
                    onClick={() => {
                      const ratio = Number(
                        (
                          document.getElementById(
                            `arcana-ratio-${slot.id}`,
                          ) as HTMLInputElement | null
                        )?.value,
                      );
                      const weight = Number(
                        (
                          document.getElementById(
                            `arcana-weight-${slot.id}`,
                          ) as HTMLInputElement | null
                        )?.value,
                      );
                      void saveArcanaSlot({ ...slot, ratio, weight });
                    }}
                  >
                    Lưu
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="app-panel mt-3 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="play-heading text-sm">Log quay gần đây</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  value={arcanaSpinFilter}
                  onChange={(e) => setArcanaSpinFilter(e.target.value)}
                  placeholder="Lọc user / ID…"
                  className="app-input !max-w-[9rem] !py-1 text-[11px]"
                />
                <button
                  type="button"
                  className="text-[11px] font-bold text-[var(--wood-deep)] underline"
                  onClick={() => void loadArcanaSpins()}
                >
                  Tải
                </button>
              </div>
            </div>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto text-[11px]">
              {arcanaSpins.length === 0 ? (
                <li className="text-[var(--play-muted)]">
                  Bấm “Tải lại” để xem log
                </li>
              ) : (
                arcanaSpins.map((sp) => (
                  <li
                    key={sp.id}
                    className="rounded-lg bg-white/70 px-2 py-1.5 ring-1 ring-[var(--wood-deep)]/10"
                  >
                    <span className="font-semibold">{sp.username}</span>
                    {" · "}
                    {formatXu(sp.stake)} · picks [
                    {(sp.pickIds?.length ? sp.pickIds : [sp.pickId]).join(", ")}
                    ] → #{sp.winId}
                    {" · "}
                    <span
                      className={
                        sp.won ? "text-[var(--jade-deep)]" : "text-rose-600"
                      }
                    >
                      {sp.won ? "win" : "lose"} {formatXu(sp.profit)}
                    </span>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {new Date(sp.at).toLocaleString("vi-VN")} · seed {sp.seed}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link to={playPath(me)} className="app-btn-primary flex-1 text-center">
          Vào bàn Tarot
        </Link>
        <Link
          to={arcanaPath(me)}
          className="flex-1 rounded-xl bg-[var(--wood-deep)] px-4 py-3 text-center text-sm font-bold text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/40"
        >
          Vào Bánh xe Arcana
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
                    Cược gần (Tarot)
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

                <div>
                  <p className="mb-1 text-xs font-bold text-[var(--play-ink)]">
                    Lịch sử Bánh xe Arcana
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {(hisData.recentArcanaSpins?.length ?? 0) === 0 && (
                      <li className="text-[var(--play-muted)]">
                        Chưa có lượt quay Arcana
                      </li>
                    )}
                    {(hisData.recentArcanaSpins ?? []).map((sp) => (
                      <li
                        key={sp.id}
                        className="rounded bg-white/70 px-2 py-1 ring-1 ring-[var(--wood-deep)]/10"
                      >
                        {formatXu(sp.stake)} · picks [
                        {(sp.pickIds?.length ? sp.pickIds : [sp.pickId]).join(
                          ", ",
                        )}
                        ] → #{sp.winId} ·{" "}
                        <span
                          className={
                            sp.won
                              ? "text-[var(--jade-deep)]"
                              : "text-rose-600"
                          }
                        >
                          {sp.won ? "win" : "lose"} {formatXu(sp.profit)}
                        </span>
                        <span className="block text-[10px] text-[var(--play-muted)]">
                          {new Date(sp.at).toLocaleString("vi-VN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {pwReset && isStaff(me) && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw-reset-title"
          onClick={() => {
            if (!pwResetBusy) closePwReset();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--play-cream,#f7f1e6)] p-4 shadow-xl ring-1 ring-[var(--wood-deep)]/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p id="pw-reset-title" className="play-heading text-sm">
                  Đặt mật khẩu user
                </p>
                <p className="text-[10px] text-[var(--play-muted)]">
                  User sẽ bị đăng xuất · bắt đổi MK khi login lại
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
                disabled={pwResetBusy}
                onClick={closePwReset}
              >
                Đóng
              </button>
            </div>

            <div className="mb-3 rounded-lg bg-white/80 px-2.5 py-2 text-[11px] ring-1 ring-[var(--wood-deep)]/10">
              <p className="font-semibold text-[var(--play-ink)]">
                {pwReset.username}{" "}
                <span className="text-[var(--wood-deep)]">{pwReset.role}</span>
              </p>
              <p className="mt-0.5 text-[var(--play-muted)]">
                <span className="identity-chip identity-chip--code !text-[9px] font-mono">
                  ID {pwReset.code || "—"}
                </span>
              </p>
            </div>

            {pwResetResult ? (
              <div className="space-y-3 text-[11px]">
                <div className="rounded-lg bg-[var(--wood-deep)]/10 px-3 py-2.5 ring-1 ring-[var(--gold)]/30">
                  <p className="text-[10px] font-semibold uppercase text-[var(--play-muted)]">
                    Mật khẩu mới (gửi cho user)
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-bold text-[var(--play-ink)]">
                    {pwResetResult.tempPassword}
                  </p>
                  {pwResetResult.recoveryCode && (
                    <p className="mt-2 text-[var(--play-muted)]">
                      Mã khôi phục mới:{" "}
                      <span className="font-mono font-bold text-[var(--play-ink)]">
                        {pwResetResult.recoveryCode}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="app-btn-primary w-full"
                  onClick={closePwReset}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={submitPwReset} className="space-y-3">
                <label className="block text-xs font-semibold text-[var(--play-muted)]">
                  Mật khẩu mới
                  <input
                    type="text"
                    value={pwResetValue}
                    onChange={(e) => setPwResetValue(e.target.value)}
                    autoComplete="new-password"
                    className="app-input mt-1 font-mono"
                    placeholder="Để trống = MK tạm ngẫu nhiên"
                    minLength={pwResetValue.trim() ? 6 : undefined}
                    disabled={pwResetBusy}
                  />
                </label>
                <p className="text-[10px] text-[var(--play-muted)]">
                  Tối thiểu 6 ký tự nếu tự nhập. Để trống hệ thống tạo dạng{" "}
                  <span className="font-mono">Tmp…</span>.
                </p>
                <button
                  type="submit"
                  disabled={pwResetBusy}
                  className="app-btn-primary w-full"
                >
                  {pwResetBusy ? "Đang lưu…" : "Lưu mật khẩu"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
