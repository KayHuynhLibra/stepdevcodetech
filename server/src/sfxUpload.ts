/**
 * Upload SFX audio (mp3 / wav / ogg / webm / m4a) → /uploads/sfx/{game}/{slot}.{ext}
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { UPLOADS_ROOT } from "./catalogUpload.js";

const MAX_UPLOAD_BYTES = 1_200_000;

const MIME_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "m4a",
  "audio/x-m4a": "m4a",
};

const GAMES = new Set(["tarot", "olympus", "arcana", "boi", "ludo"]);

function safeSlot(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return key.length >= 2 ? key : null;
}

export function saveSfxAudio(
  gameId: string,
  slot: string,
  dataUrl: string,
): { ok: true; url: string } | { ok: false; reason: string } {
  const game = String(gameId ?? "")
    .trim()
    .toLowerCase();
  if (!GAMES.has(game)) {
    return {
      ok: false,
      reason: "gameId phải là tarot|olympus|arcana|boi|ludo",
    };
  }
  const key = safeSlot(slot);
  if (!key) return { ok: false, reason: "Slot SFX không hợp lệ" };

  const m =
    /^data:(audio\/(?:mpeg|mp3|wav|wave|x-wav|ogg|webm|mp4|aac|x-m4a));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
      dataUrl.trim(),
    );
  if (!m) {
    return {
      ok: false,
      reason: "File phải là MP3, WAV, OGG, WebM hoặc M4A",
    };
  }

  const mime = m[1]!.toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return { ok: false, reason: "Định dạng âm không hỗ trợ" };

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2]!.replace(/\s+/g, ""), "base64");
  } catch {
    return { ok: false, reason: "Không đọc được file âm" };
  }
  if (buf.length < 64) return { ok: false, reason: "File âm quá nhỏ" };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Âm tối đa ~1.2MB" };
  }

  const dir = join(UPLOADS_ROOT, "sfx", game);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${key}.${ext}`;
  writeFileSync(join(dir, filename), buf);
  return { ok: true, url: `/uploads/sfx/${game}/${filename}?v=${Date.now()}` };
}
