import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/** Khách chơi nhanh — tối đa 20 phút / mã guest rồi reset xu. */
export const GUEST_PLAY_LIMIT_MS = 20 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "guest-play.json");
const TMP = join(DATA_DIR, "guest-play.json.tmp");

const GUEST_CODE_RE = /^G[A-Z0-9]{7}$/;

interface GuestPlayRow {
  startedAt: number;
}

interface GuestPlayFile {
  version: 1;
  guests: Record<string, GuestPlayRow>;
}

class GuestPlayStore {
  private guests = new Map<string, GuestPlayRow>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) return;
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as GuestPlayFile;
      if (parsed?.version !== 1 || !parsed.guests) return;
      for (const [code, row] of Object.entries(parsed.guests)) {
        if (!row || typeof row.startedAt !== "number") continue;
        if (!GUEST_CODE_RE.test(code)) continue;
        this.guests.set(code.toUpperCase(), { startedAt: row.startedAt });
      }
    } catch (err) {
      console.warn("[guest-play] load failed:", err);
    }
  }

  private save() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const guests: Record<string, GuestPlayRow> = {};
    for (const [k, v] of this.guests) guests[k] = v;
    writeFileSync(
      TMP,
      JSON.stringify({ version: 1, guests } satisfies GuestPlayFile, null, 2),
      "utf8",
    );
    renameSync(TMP, PATH);
  }

  private norm(raw: string): string | null {
    const code = raw.trim().toUpperCase();
    return GUEST_CODE_RE.test(code) ? code : null;
  }

  getRemainingMs(rawCode: string): number {
    const code = this.norm(rawCode);
    if (!code) return GUEST_PLAY_LIMIT_MS;
    const row = this.guests.get(code);
    if (!row) return GUEST_PLAY_LIMIT_MS;
    return Math.max(0, GUEST_PLAY_LIMIT_MS - (Date.now() - row.startedAt));
  }

  /** Gọi khi guest join — hết hạn thì reset mốc và báo expired. */
  onGuestJoin(rawCode: string): {
    expired: boolean;
    remainingMs: number;
  } {
    const code = this.norm(rawCode);
    if (!code) {
      return { expired: false, remainingMs: GUEST_PLAY_LIMIT_MS };
    }
    const now = Date.now();
    let row = this.guests.get(code);
    if (!row) {
      row = { startedAt: now };
      this.guests.set(code, row);
      this.save();
      return { expired: false, remainingMs: GUEST_PLAY_LIMIT_MS };
    }
    const elapsed = now - row.startedAt;
    if (elapsed >= GUEST_PLAY_LIMIT_MS) {
      row = { startedAt: now };
      this.guests.set(code, row);
      this.save();
      return { expired: true, remainingMs: GUEST_PLAY_LIMIT_MS };
    }
    return {
      expired: false,
      remainingMs: GUEST_PLAY_LIMIT_MS - elapsed,
    };
  }

  /** Hết giờ giữa ván — reset mốc, trả true nếu vừa hết hạn. */
  forceExpireIfNeeded(rawCode: string): boolean {
    const code = this.norm(rawCode);
    if (!code) return false;
    if (this.getRemainingMs(code) > 0) return false;
    this.guests.set(code, { startedAt: Date.now() });
    this.save();
    return true;
  }
}

export const guestPlayStore = new GuestPlayStore();
