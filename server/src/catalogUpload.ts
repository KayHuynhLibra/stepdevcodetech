import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export type CatalogKind = "gift" | "ring" | "oracle";

const MAX_UPLOAD_BYTES = 800_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Root: server/data/uploads — avatars + catalog sống cạnh nhau. */
export const UPLOADS_ROOT = join(__dirname, "..", "data", "uploads");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeKey(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return key.length >= 2 ? key : null;
}

/**
 * Lưu data-URL ảnh catalog → `/uploads/catalog/{kind}/{key}.{ext}?v=...`
 */
export function saveCatalogImage(
  kind: CatalogKind,
  itemKey: string,
  dataUrl: string,
): { ok: true; url: string } | { ok: false; reason: string } {
  if (kind !== "gift" && kind !== "ring" && kind !== "oracle") {
    return { ok: false, reason: "Loại catalog không hợp lệ" };
  }
  const key = safeKey(itemKey);
  if (!key) return { ok: false, reason: "Key vật phẩm không hợp lệ" };

  const m =
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
      dataUrl.trim(),
    );
  if (!m) {
    return { ok: false, reason: "Ảnh phải là JPG, PNG hoặc WebP" };
  }

  const mime = m[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  const ext = MIME_EXT[mime];
  if (!ext) return { ok: false, reason: "Định dạng ảnh không hỗ trợ" };

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2]!.replace(/\s/g, ""), "base64");
  } catch {
    return { ok: false, reason: "Không đọc được ảnh" };
  }
  if (buf.length < 32) return { ok: false, reason: "Ảnh quá nhỏ" };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Ảnh tối đa ~800KB (hãy chọn ảnh nhỏ hơn)" };
  }

  const dir = join(UPLOADS_ROOT, "catalog", kind);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${key}.${ext}`;
  writeFileSync(join(dir, filename), buf);

  const url = `/uploads/catalog/${kind}/${filename}?v=${Date.now()}`;
  return { ok: true, url };
}
