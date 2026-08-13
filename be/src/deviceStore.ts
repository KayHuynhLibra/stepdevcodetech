import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const DEVICE_ID_RE = /^[a-f0-9]{16,64}$/i;
const CAP = 3000;
const SEEN_CAP = 30;

export interface DeviceMeta {
  platform?: string;
  screen?: string;
  timezone?: string;
  language?: string;
  /** User-Agent rút gọn (không lưu full để tránh phình file) */
  ua?: string;
}

export interface DeviceSeenUser {
  userId: string;
  username: string;
  lastAt: number;
  joins: number;
}

export interface DeviceSeenGuest {
  code: string;
  lastAt: number;
  joins: number;
}

interface DeviceRecord {
  deviceId: string;
  firstAt: number;
  lastAt: number;
  lastIp: string;
  meta: DeviceMeta;
  blockedUntil?: number;
  blockNote?: string;
  joinCount: number;
  seenUsers: DeviceSeenUser[];
  seenGuests: DeviceSeenGuest[];
  ips: string[];
}

interface DevicesFile {
  version: 1;
  devices: Record<string, DeviceRecord>;
}

export interface DeviceAdminRow {
  deviceId: string;
  shortId: string;
  firstAt: number;
  lastAt: number;
  lastIp: string;
  meta: DeviceMeta;
  blocked: boolean;
  blockedUntil: number;
  blockNote?: string;
  joinCount: number;
  online: boolean;
  seenUsers: DeviceSeenUser[];
  seenGuests: DeviceSeenGuest[];
  ips: string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "devices.json");
const TMP = join(DATA_DIR, "devices.json.tmp");

export function normalizeDeviceId(raw: unknown): string | null {
  const id = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!DEVICE_ID_RE.test(id)) return null;
  return id;
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function trimUa(ua: unknown): string | undefined {
  const s = String(ua ?? "").trim();
  if (!s) return undefined;
  return s.slice(0, 120);
}

export function sanitizeDeviceMeta(raw: unknown): DeviceMeta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    platform: String(o.platform ?? "").slice(0, 64) || undefined,
    screen: String(o.screen ?? "").slice(0, 32) || undefined,
    timezone: String(o.timezone ?? "").slice(0, 64) || undefined,
    language: String(o.language ?? "").slice(0, 16) || undefined,
    ua: trimUa(o.ua),
  };
}

class DeviceStore {
  private devices = new Map<string, DeviceRecord>();
  private liveBySocket = new Map<string, string>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as DevicesFile;
      if (parsed?.version !== 1 || !parsed.devices) return;
      for (const [id, row] of Object.entries(parsed.devices)) {
        if (!row || typeof row.deviceId !== "string") continue;
        const norm = normalizeDeviceId(row.deviceId);
        if (!norm) continue;
        this.devices.set(norm, {
          deviceId: norm,
          firstAt: Number(row.firstAt) || Date.now(),
          lastAt: Number(row.lastAt) || Date.now(),
          lastIp: String(row.lastIp ?? ""),
          meta: sanitizeDeviceMeta(row.meta),
          blockedUntil: row.blockedUntil,
          blockNote: row.blockNote,
          joinCount: Math.max(0, Math.floor(Number(row.joinCount) || 0)),
          seenUsers: Array.isArray(row.seenUsers) ? row.seenUsers : [],
          seenGuests: Array.isArray(row.seenGuests) ? row.seenGuests : [],
          ips: Array.isArray(row.ips) ? row.ips.slice(0, 12) : [],
        });
      }
      console.log(`[device] Loaded ${this.devices.size} device records`);
    } catch (err) {
      console.warn("[device] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const devices: Record<string, DeviceRecord> = {};
    for (const [k, v] of this.devices) devices[k] = v;
    writeFileSync(
      TMP,
      JSON.stringify({ version: 1, devices } satisfies DevicesFile, null, 2),
      "utf8",
    );
    renameSync(TMP, PATH);
  }

  private trimDevices() {
    if (this.devices.size <= CAP) return;
    const sorted = [...this.devices.values()].sort((a, b) => a.lastAt - b.lastAt);
    const drop = sorted.length - CAP;
    for (let i = 0; i < drop; i++) {
      this.devices.delete(sorted[i]!.deviceId);
    }
  }

  isBlocked(deviceId: string): boolean {
    const row = this.devices.get(deviceId);
    return !!row && (row.blockedUntil ?? 0) > Date.now();
  }

  blockReason(deviceId: string): string | undefined {
    const row = this.devices.get(deviceId);
    if (!row || !this.isBlocked(deviceId)) return undefined;
    return row.blockNote || "Thiết bị bị tạm khóa";
  }

  recordTouch(input: {
    deviceId: string;
    ip: string;
    meta?: DeviceMeta;
    socketId?: string;
    userId?: string;
    username?: string;
    guestCode?: string;
  }) {
    const id = input.deviceId;
    const now = Date.now();
    let row = this.devices.get(id);
    if (!row) {
      row = {
        deviceId: id,
        firstAt: now,
        lastAt: now,
        lastIp: input.ip,
        meta: sanitizeDeviceMeta(input.meta),
        joinCount: 0,
        seenUsers: [],
        seenGuests: [],
        ips: [],
      };
      this.devices.set(id, row);
    }
    row.lastAt = now;
    row.lastIp = input.ip;
    row.joinCount += 1;
    if (input.meta) {
      row.meta = { ...row.meta, ...sanitizeDeviceMeta(input.meta) };
    }
    if (input.ip && !row.ips.includes(input.ip)) {
      row.ips.unshift(input.ip);
      if (row.ips.length > 12) row.ips.length = 12;
    }
    if (input.userId) {
      const list = row.seenUsers;
      const hit = list.find((x) => x.userId === input.userId);
      if (hit) {
        hit.username = input.username || hit.username;
        hit.lastAt = now;
        hit.joins += 1;
      } else {
        list.unshift({
          userId: input.userId,
          username: input.username || input.userId,
          lastAt: now,
          joins: 1,
        });
        if (list.length > SEEN_CAP) list.length = SEEN_CAP;
      }
    }
    if (input.guestCode) {
      const code = input.guestCode.trim().toUpperCase();
      const list = row.seenGuests;
      const hit = list.find((x) => x.code === code);
      if (hit) {
        hit.lastAt = now;
        hit.joins += 1;
      } else {
        list.unshift({ code, lastAt: now, joins: 1 });
        if (list.length > SEEN_CAP) list.length = SEEN_CAP;
      }
    }
    if (input.socketId) {
      this.liveBySocket.set(input.socketId, id);
    }
    this.trimDevices();
    this.save();
  }

  onDisconnect(socketId: string) {
    this.liveBySocket.delete(socketId);
  }

  getSocketIdsForDevice(deviceId: string): string[] {
    const out: string[] = [];
    for (const [sid, id] of this.liveBySocket) {
      if (id === deviceId) out.push(sid);
    }
    return out;
  }

  getByIp(ip: string): DeviceAdminRow[] {
    const now = Date.now();
    const out: DeviceAdminRow[] = [];
    for (const row of this.devices.values()) {
      if (!row.ips.includes(ip) && row.lastIp !== ip) continue;
      const online = this.getSocketIdsForDevice(row.deviceId).length > 0;
      const blockedUntil = row.blockedUntil ?? 0;
      out.push({
        deviceId: row.deviceId,
        shortId: shortId(row.deviceId),
        firstAt: row.firstAt,
        lastAt: row.lastAt,
        lastIp: row.lastIp,
        meta: row.meta,
        blocked: blockedUntil > now,
        blockedUntil,
        blockNote: row.blockNote,
        joinCount: row.joinCount,
        online,
        seenUsers: row.seenUsers.slice(0, 8),
        seenGuests: row.seenGuests.slice(0, 8),
        ips: row.ips,
      });
    }
    out.sort((a, b) => b.lastAt - a.lastAt);
    return out.slice(0, 20);
  }

  listForAdmin(limit = 200): DeviceAdminRow[] {
    const now = Date.now();
    const rows = [...this.devices.values()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .slice(0, Math.min(500, Math.max(1, limit)));
    return rows.map((row) => {
      const blockedUntil = row.blockedUntil ?? 0;
      return {
        deviceId: row.deviceId,
        shortId: shortId(row.deviceId),
        firstAt: row.firstAt,
        lastAt: row.lastAt,
        lastIp: row.lastIp,
        meta: row.meta,
        blocked: blockedUntil > now,
        blockedUntil,
        blockNote: row.blockNote,
        joinCount: row.joinCount,
        online: this.getSocketIdsForDevice(row.deviceId).length > 0,
        seenUsers: row.seenUsers.slice(0, 8),
        seenGuests: row.seenGuests.slice(0, 8),
        ips: row.ips,
      };
    });
  }

  setBlock(
    deviceId: string,
    hours: number,
    note?: string,
  ): { ok: true; blockedUntil: number } | { ok: false; reason: string } {
    const id = normalizeDeviceId(deviceId);
    if (!id) return { ok: false, reason: "deviceId không hợp lệ" };
    let row = this.devices.get(id);
    if (!row) {
      row = {
        deviceId: id,
        firstAt: Date.now(),
        lastAt: Date.now(),
        lastIp: "",
        meta: {},
        joinCount: 0,
        seenUsers: [],
        seenGuests: [],
        ips: [],
      };
      this.devices.set(id, row);
    }
    if (hours <= 0) {
      delete row.blockedUntil;
      delete row.blockNote;
      this.save();
      return { ok: true, blockedUntil: 0 };
    }
    const h = Math.min(24 * 365, Math.max(0.25, hours));
    row.blockedUntil = Date.now() + Math.floor(h * 3600_000);
    if (note?.trim()) row.blockNote = note.trim().slice(0, 200);
    this.save();
    return { ok: true, blockedUntil: row.blockedUntil };
  }
}

export const deviceStore = new DeviceStore();
