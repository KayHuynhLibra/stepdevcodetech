import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GUEST_CODE_RE = /^G[A-Z0-9]{7}$/;
/** Idle ≥ 6h → IP có thể gắn guestCode mới */
export const GUEST_IP_RECLAIM_MS = 6 * 60 * 60 * 1000;
const BIND_CAP = 2000;
const SEEN_CAP = 40;

export function isGuestCode(v: unknown): v is string {
  return typeof v === "string" && GUEST_CODE_RE.test(v.trim().toUpperCase());
}

export function normalizeGuestCode(v: string): string {
  return v.trim().toUpperCase();
}

export interface SeenUser {
  userId: string;
  username: string;
  firstAt: number;
  lastAt: number;
  joins: number;
}

export interface SeenGuest {
  code: string;
  firstAt: number;
  lastAt: number;
  joins: number;
}

interface GuestBind {
  /** Empty string = chỉ còn block / history, chưa gắn guest hiện tại */
  code: string;
  lastSeen: number;
  blockedUntil?: number;
  lastUserId?: string;
  lastUsername?: string;
  seenUsers?: SeenUser[];
  seenGuests?: SeenGuest[];
  joinCount?: number;
}

interface GuestIpsFile {
  version: 1;
  binds: Record<string, GuestBind>;
}

export interface LiveSession {
  ip: string;
  socketId: string;
  kind: "guest" | "user";
  guestCode?: string;
  userId?: string;
  username?: string;
  name?: string;
  connectedAt: number;
}

export interface IpAdminRow {
  ip: string;
  kind: "guest" | "user" | "mixed" | "blocked" | "idle";
  guestCode?: string;
  online: boolean;
  socketIds: string[];
  lastSeen: number;
  blockedUntil: number;
  blocked: boolean;
  sessions: {
    kind: "guest" | "user";
    name?: string;
    guestCode?: string;
    userId?: string;
    username?: string;
  }[];
  userIds: string[];
  joinCount: number;
  seenUsers: SeenUser[];
  seenGuests: SeenGuest[];
  clusterFlag: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "guest-ips.json");
const TMP = join(DATA_DIR, "guest-ips.json.tmp");

function ensureArrays(b: GuestBind) {
  if (!Array.isArray(b.seenUsers)) b.seenUsers = [];
  if (!Array.isArray(b.seenGuests)) b.seenGuests = [];
  if (typeof b.joinCount !== "number") b.joinCount = 0;
}

function bumpSeenUser(b: GuestBind, userId: string, username: string) {
  ensureArrays(b);
  const now = Date.now();
  const list = b.seenUsers!;
  const hit = list.find((x) => x.userId === userId);
  if (hit) {
    hit.username = username || hit.username;
    hit.lastAt = now;
    hit.joins += 1;
  } else {
    list.unshift({
      userId,
      username: username || userId,
      firstAt: now,
      lastAt: now,
      joins: 1,
    });
    if (list.length > SEEN_CAP) list.length = SEEN_CAP;
  }
}

function bumpSeenGuest(b: GuestBind, code: string) {
  ensureArrays(b);
  const now = Date.now();
  const list = b.seenGuests!;
  const hit = list.find((x) => x.code === code);
  if (hit) {
    hit.lastAt = now;
    hit.joins += 1;
  } else {
    list.unshift({ code, firstAt: now, lastAt: now, joins: 1 });
    if (list.length > SEEN_CAP) list.length = SEEN_CAP;
  }
}

export class GuestIpStore {
  private binds = new Map<string, GuestBind>();
  private bySocket = new Map<string, LiveSession>();
  private socketsByIp = new Map<string, Set<string>>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as GuestIpsFile;
      if (parsed?.version !== 1 || !parsed.binds) return;
      for (const [ip, b] of Object.entries(parsed.binds)) {
        if (!b || typeof b !== "object") continue;
        const code =
          typeof b.code === "string" && isGuestCode(b.code)
            ? normalizeGuestCode(b.code)
            : "";
        const row: GuestBind = {
          code,
          lastSeen: Number(b.lastSeen) || 0,
          blockedUntil: b.blockedUntil,
          lastUserId: b.lastUserId,
          lastUsername: b.lastUsername,
          seenUsers: Array.isArray(b.seenUsers) ? b.seenUsers : [],
          seenGuests: Array.isArray(b.seenGuests) ? b.seenGuests : [],
          joinCount: Number(b.joinCount) || 0,
        };
        this.binds.set(ip, row);
      }
      console.log(`[guest-ip] Loaded ${this.binds.size} IP binds`);
    } catch (err) {
      console.warn("[guest-ip] Failed to load:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const binds: Record<string, GuestBind> = {};
      for (const [ip, b] of this.binds) {
        ensureArrays(b);
        const row: GuestBind = {
          code: b.code,
          lastSeen: b.lastSeen,
          seenUsers: b.seenUsers,
          seenGuests: b.seenGuests,
          joinCount: b.joinCount ?? 0,
        };
        if (b.blockedUntil && b.blockedUntil > Date.now()) {
          row.blockedUntil = b.blockedUntil;
        }
        if (b.lastUserId) row.lastUserId = b.lastUserId;
        if (b.lastUsername) row.lastUsername = b.lastUsername;
        binds[ip] = row;
      }
      writeFileSync(
        TMP,
        JSON.stringify({ version: 1, binds } satisfies GuestIpsFile, null, 2),
        "utf8",
      );
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[guest-ip] Failed to save:", err);
    }
  }

  private pruneBinds() {
    if (this.binds.size <= BIND_CAP) return;
    const rows = [...this.binds.entries()].sort(
      (a, b) => a[1].lastSeen - b[1].lastSeen,
    );
    while (this.binds.size > BIND_CAP && rows.length) {
      const oldest = rows.shift();
      if (!oldest) break;
      const [ip, b] = oldest;
      if ((b.blockedUntil ?? 0) > Date.now()) continue;
      this.binds.delete(ip);
    }
  }

  private getOrCreateBind(ip: string): GuestBind {
    let b = this.binds.get(ip);
    if (!b) {
      b = {
        code: "",
        lastSeen: Date.now(),
        seenUsers: [],
        seenGuests: [],
        joinCount: 0,
      };
      this.binds.set(ip, b);
      this.pruneBinds();
    }
    ensureArrays(b);
    return b;
  }

  isBlocked(ip: string): boolean {
    const b = this.binds.get(ip);
    return !!b && (b.blockedUntil ?? 0) > Date.now();
  }

  claimGuest(
    ip: string,
    guestCodeRaw: string,
    socketId: string,
  ):
    | { ok: true; code: string; socketIdsToKick: string[] }
    | { ok: false; reason: string } {
    if (!isGuestCode(guestCodeRaw)) {
      return { ok: false, reason: "Thiếu mã khách hợp lệ" };
    }
    const code = normalizeGuestCode(guestCodeRaw);
    const now = Date.now();

    if (this.isBlocked(ip)) {
      return { ok: false, reason: "IP tạm bị chặn — thử lại sau hoặc đăng ký" };
    }

    const bind = this.getOrCreateBind(ip);
    const onlineGuests = [...(this.socketsByIp.get(ip) ?? [])].filter((sid) => {
      const s = this.bySocket.get(sid);
      return s?.kind === "guest" && sid !== socketId;
    });
    const hasCode = isGuestCode(bind.code);
    const active =
      onlineGuests.length > 0 ||
      (hasCode && now - bind.lastSeen < GUEST_IP_RECLAIM_MS);

    if (hasCode && bind.code !== code && active) {
      return {
        ok: false,
        reason:
          "IP này đã dùng phiên khách khác — dùng lại trình duyệt cũ hoặc đăng ký tài khoản",
      };
    }
    bind.code = code;
    bind.lastSeen = now;
    bumpSeenGuest(bind, code);
    bind.joinCount = (bind.joinCount ?? 0) + 1;
    this.save();

    const socketIdsToKick = [...(this.socketsByIp.get(ip) ?? [])].filter(
      (sid) => {
        if (sid === socketId) return false;
        return this.bySocket.get(sid)?.kind === "guest";
      },
    );

    return { ok: true, code, socketIdsToKick };
  }

  touchLive(
    session: Omit<LiveSession, "connectedAt"> & { connectedAt?: number },
  ) {
    const prev = this.bySocket.get(session.socketId);
    const isNewSocket = !prev;
    if (prev) this.detachSocket(session.socketId, false);

    const live: LiveSession = {
      ...session,
      connectedAt: session.connectedAt ?? Date.now(),
    };
    this.bySocket.set(live.socketId, live);
    let set = this.socketsByIp.get(live.ip);
    if (!set) {
      set = new Set();
      this.socketsByIp.set(live.ip, set);
    }
    set.add(live.socketId);

    const bind = this.getOrCreateBind(live.ip);
    bind.lastSeen = Date.now();
    if (live.kind === "guest" && live.guestCode) {
      bind.code = live.guestCode;
      // claimGuest already bumped; only bump again if re-touch without claim
      if (!isNewSocket || !isGuestCode(live.guestCode)) {
        /* noop */
      }
    }
    if (live.kind === "user" && live.userId) {
      bind.lastUserId = live.userId;
      bind.lastUsername = live.username;
      if (isNewSocket) {
        bumpSeenUser(bind, live.userId, live.username || live.userId);
        bind.joinCount = (bind.joinCount ?? 0) + 1;
      }
    }
    this.binds.set(live.ip, bind);
    this.save();
  }

  onDisconnect(socketId: string) {
    this.detachSocket(socketId, true);
  }

  private detachSocket(socketId: string, persistLastSeen: boolean) {
    const live = this.bySocket.get(socketId);
    if (!live) return;
    this.bySocket.delete(socketId);
    const set = this.socketsByIp.get(live.ip);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) this.socketsByIp.delete(live.ip);
    }
    if (persistLastSeen) {
      const bind = this.binds.get(live.ip);
      if (bind) {
        bind.lastSeen = Date.now();
        this.save();
      }
    }
  }

  getSocketIdsForIp(ip: string): string[] {
    return [...(this.socketsByIp.get(ip) ?? [])];
  }

  clearGuestBind(ip: string): { ok: true } | { ok: false; reason: string } {
    const clean = String(ip ?? "").trim();
    const b = this.binds.get(clean);
    if (!b || !isGuestCode(b.code)) {
      return { ok: false, reason: "IP chưa có bind guest" };
    }
    const blockedUntil = b.blockedUntil;
    ensureArrays(b);
    this.binds.set(clean, {
      code: "",
      lastSeen: 0,
      lastUserId: b.lastUserId,
      lastUsername: b.lastUsername,
      seenUsers: b.seenUsers,
      seenGuests: b.seenGuests,
      joinCount: b.joinCount,
      ...(blockedUntil && blockedUntil > Date.now() ? { blockedUntil } : {}),
    });
    this.save();
    return { ok: true };
  }

  setBlock(
    ip: string,
    hours: number,
  ): { ok: true; blockedUntil: number } | { ok: false; reason: string } {
    const clean = String(ip ?? "").trim();
    if (!clean || clean === "unknown") {
      return { ok: false, reason: "IP không hợp lệ" };
    }
    const h = Number(hours);
    if (!Number.isFinite(h) || h < 0) {
      return { ok: false, reason: "hours không hợp lệ" };
    }
    const existing = this.getOrCreateBind(clean);
    if (h === 0) {
      delete existing.blockedUntil;
      if (
        !existing.code &&
        !existing.lastUserId &&
        !(existing.seenUsers?.length) &&
        !(existing.seenGuests?.length)
      ) {
        this.binds.delete(clean);
      }
      this.save();
      return { ok: true, blockedUntil: 0 };
    }
    const blockedUntil = Date.now() + Math.floor(h * 3600_000);
    existing.blockedUntil = blockedUntil;
    this.save();
    return { ok: true, blockedUntil };
  }

  listForAdmin(): IpAdminRow[] {
    const now = Date.now();
    const ips = new Set<string>([
      ...this.binds.keys(),
      ...this.socketsByIp.keys(),
    ]);
    const rows: IpAdminRow[] = [];
    for (const ip of ips) {
      const bind = this.binds.get(ip);
      if (bind) ensureArrays(bind);
      const sockets = [...(this.socketsByIp.get(ip) ?? [])];
      const lives = sockets
        .map((sid) => this.bySocket.get(sid))
        .filter(Boolean) as LiveSession[];
      const guests = lives.filter((l) => l.kind === "guest");
      const users = lives.filter((l) => l.kind === "user");
      const blockedUntil = bind?.blockedUntil ?? 0;
      const blocked = blockedUntil > now;

      let kind: IpAdminRow["kind"] = "idle";
      if (guests.length && users.length) kind = "mixed";
      else if (guests.length) kind = "guest";
      else if (users.length) kind = "user";
      else if (blocked) kind = "blocked";
      else if (bind?.code && isGuestCode(bind.code)) kind = "idle";

      const userIds = new Set<string>();
      for (const u of users) {
        if (u.userId) userIds.add(u.userId);
      }
      if (bind?.lastUserId) userIds.add(bind.lastUserId);
      for (const s of bind?.seenUsers ?? []) userIds.add(s.userId);

      const seenUsers = [...(bind?.seenUsers ?? [])];
      const seenGuests = [...(bind?.seenGuests ?? [])];
      const guestActive =
        guests.length > 0 || !!(bind?.code && isGuestCode(bind.code));
      const clusterFlag =
        seenUsers.length + (guestActive || seenGuests.length > 0 ? 1 : 0) >= 2 ||
        seenUsers.length >= 2;

      rows.push({
        ip,
        kind,
        guestCode:
          guests[0]?.guestCode ||
          (bind?.code && isGuestCode(bind.code) ? bind.code : undefined),
        online: lives.length > 0,
        socketIds: sockets,
        lastSeen: Math.max(
          bind?.lastSeen ?? 0,
          ...lives.map((l) => l.connectedAt),
          0,
        ),
        blockedUntil,
        blocked,
        sessions: lives.map((l) => ({
          kind: l.kind,
          name: l.name,
          guestCode: l.guestCode,
          userId: l.userId,
          username: l.username,
        })),
        userIds: [...userIds],
        joinCount: bind?.joinCount ?? 0,
        seenUsers,
        seenGuests,
        clusterFlag,
      });
    }
    rows.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return b.lastSeen - a.lastSeen;
    });
    return rows;
  }
}

export const guestIpStore = new GuestIpStore();
