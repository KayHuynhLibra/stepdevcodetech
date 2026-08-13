import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const INVITE_CODE_LEN = 8;
/** Alphabet tránh 0/O/1/I để dễ đọc khi admin chia sẻ. */
const SAFE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface InviteCode {
  code: string;
  maxUses: number;
  usedCount: number;
  enabled: boolean;
  note?: string;
  createdAt: number;
  createdBy: string;
}

interface InvitesFile {
  version: 1 | 2;
  /** Khi true: đăng ký bắt buộc mã thành viên. false = mở đăng ký tự do. */
  requireInvite?: boolean;
  invites: InviteCode[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "invites.json");
const TMP = join(DATA_DIR, "invites.json.tmp");

export function normalizeInviteCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidInviteCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

function makeRandomCode(): string {
  const bytes = randomBytes(INVITE_CODE_LEN);
  let out = "";
  for (let i = 0; i < INVITE_CODE_LEN; i++) {
    out += SAFE_ALPHABET[bytes[i]! % SAFE_ALPHABET.length];
  }
  return out;
}

export class InviteStore {
  private invites: InviteCode[] = [];
  /** Mặc định bật — an toàn hơn mở đăng ký công khai. */
  private requireInvite = true;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!existsSync(PATH)) {
        this.save();
        console.log("[invite] Created empty invites.json");
        return;
      }
      const parsed = JSON.parse(readFileSync(PATH, "utf8")) as InvitesFile;
      if (!parsed || !Array.isArray(parsed.invites)) return;
      this.requireInvite = parsed.requireInvite !== false;
      this.invites = parsed.invites
        .filter(
          (x) =>
            x &&
            typeof x.code === "string" &&
            typeof x.maxUses === "number" &&
            typeof x.usedCount === "number",
        )
        .map((x) => ({
          code: normalizeInviteCode(x.code),
          maxUses: Math.max(1, Math.floor(x.maxUses)),
          usedCount: Math.max(0, Math.floor(x.usedCount)),
          enabled: x.enabled !== false,
          note: typeof x.note === "string" ? x.note.slice(0, 80) : undefined,
          createdAt: Number(x.createdAt) || Date.now(),
          createdBy: String(x.createdBy ?? ""),
        }));
      console.log(
        `[invite] Loaded ${this.invites.length} codes · requireInvite=${this.requireInvite}`,
      );
    } catch (err) {
      console.warn("[invite] Failed to load invites.json:", err);
    }
  }

  private save() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const payload: InvitesFile = {
        version: 2,
        requireInvite: this.requireInvite,
        invites: this.invites,
      };
      writeFileSync(TMP, JSON.stringify(payload, null, 2), "utf8");
      renameSync(TMP, PATH);
    } catch (err) {
      console.warn("[invite] Failed to save invites.json:", err);
    }
  }

  private find(code: string): InviteCode | undefined {
    const key = normalizeInviteCode(code);
    return this.invites.find((c) => c.code === key);
  }

  isInviteRequired(): boolean {
    return this.requireInvite;
  }

  setRequireInvite(enabled: boolean): { ok: true; requireInvite: boolean } {
    this.requireInvite = !!enabled;
    this.save();
    return { ok: true, requireInvite: this.requireInvite };
  }

  list(): InviteCode[] {
    return this.invites
      .map((c) => ({ ...c }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getPublicConfig(): { requireInvite: boolean } {
    return { requireInvite: this.requireInvite };
  }

  /** Kiểm tra mã còn dùng được — không tăng usedCount. */
  preview(
    raw: string,
  ): { ok: true; code: string } | { ok: false; reason: string } {
    const code = normalizeInviteCode(raw);
    if (!code) return { ok: false, reason: "Nhập mã thành viên" };
    if (!isValidInviteCodeFormat(code)) {
      return { ok: false, reason: "Mã thành viên phải đúng 8 ký tự (A–Z, 0–9)" };
    }
    const invite = this.find(code);
    if (!invite || !invite.enabled) {
      return { ok: false, reason: "Mã thành viên không hợp lệ hoặc đã tắt" };
    }
    if (invite.usedCount >= invite.maxUses) {
      return { ok: false, reason: "Mã thành viên đã hết lượt" };
    }
    return { ok: true, code: invite.code };
  }

  /** Tăng usedCount sau khi đăng ký thành công. */
  consume(
    raw: string,
  ): { ok: true; invite: InviteCode } | { ok: false; reason: string } {
    const preview = this.preview(raw);
    if (!preview.ok) return preview;
    const invite = this.find(preview.code);
    if (!invite) return { ok: false, reason: "Mã thành viên không hợp lệ" };
    if (invite.usedCount >= invite.maxUses) {
      return { ok: false, reason: "Mã thành viên đã hết lượt" };
    }
    invite.usedCount += 1;
    this.save();
    return { ok: true, invite: { ...invite } };
  }

  create(input: {
    code?: string;
    maxUses: number;
    note?: string;
    createdBy: string;
  }): { ok: true; invite: InviteCode } | { ok: false; reason: string } {
    const maxUses = Math.floor(Number(input.maxUses));
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 1_000_000) {
      return { ok: false, reason: "Số lần dùng tối đa: 1 – 1.000.000" };
    }

    let code = normalizeInviteCode(String(input.code ?? ""));
    if (code) {
      if (!isValidInviteCodeFormat(code)) {
        return {
          ok: false,
          reason: "Mã phải đúng 8 ký tự (chữ cái / số)",
        };
      }
      if (this.find(code)) {
        return { ok: false, reason: "Mã đã tồn tại" };
      }
    } else {
      for (let i = 0; i < 40; i++) {
        const candidate = makeRandomCode();
        if (!this.find(candidate)) {
          code = candidate;
          break;
        }
      }
      if (!code) return { ok: false, reason: "Không tạo được mã ngẫu nhiên" };
    }

    const note = String(input.note ?? "")
      .trim()
      .slice(0, 80);
    const invite: InviteCode = {
      code,
      maxUses,
      usedCount: 0,
      enabled: true,
      ...(note ? { note } : {}),
      createdAt: Date.now(),
      createdBy: String(input.createdBy ?? "").slice(0, 40),
    };
    this.invites.unshift(invite);
    this.save();
    return { ok: true, invite: { ...invite } };
  }

  setEnabled(
    code: string,
    enabled: boolean,
  ): { ok: true; invite: InviteCode } | { ok: false; reason: string } {
    const invite = this.find(code);
    if (!invite) return { ok: false, reason: "Không tìm thấy mã" };
    invite.enabled = !!enabled;
    this.save();
    return { ok: true, invite: { ...invite } };
  }
}

export const inviteStore = new InviteStore();
