/** Nén ảnh catalog (quà / nhẫn) trước khi POST data-URL — tránh vượt JSON body limit. */

const MAX_SIDE = 720;
const TARGET_BYTES = 700_000;
const ABS_MAX_BYTES = 800_000;

function approxDecodedBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1).replace(/\s/g, "");
  return Math.floor((b64.length * 3) / 4);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Chỉ chọn file ảnh (JPG / PNG / WebP)"));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error("Ảnh gốc tối đa 12MB"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không mở được ảnh"));
    };
    img.src = url;
  });
}

function drawScaled(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không xử lý được ảnh");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function tryExport(
  canvas: HTMLCanvasElement,
  mime: "image/webp" | "image/jpeg" | "image/png",
  quality?: number,
): string | null {
  try {
    const out =
      quality != null
        ? canvas.toDataURL(mime, quality)
        : canvas.toDataURL(mime);
    if (!out.startsWith(`data:${mime}`)) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * Resize + nén → data-URL ≤ ~800KB (khớp server catalogUpload).
 * Ưu tiên WebP (giữ alpha), rồi JPEG, cuối cùng PNG nhỏ.
 */
export async function fileToCatalogDataUrl(
  file: File,
): Promise<{ dataUrl: string; bytes: number }> {
  const img = await loadImage(file);
  let side = MAX_SIDE;
  let best: { dataUrl: string; bytes: number } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = drawScaled(img, side);
    const candidates: string[] = [];

    for (const q of [0.86, 0.78, 0.7, 0.62]) {
      const webp = tryExport(canvas, "image/webp", q);
      if (webp) candidates.push(webp);
      const jpeg = tryExport(canvas, "image/jpeg", q);
      if (jpeg) candidates.push(jpeg);
    }
    const png = tryExport(canvas, "image/png");
    if (png) candidates.push(png);

    for (const dataUrl of candidates) {
      const bytes = approxDecodedBytes(dataUrl);
      if (!best || bytes < best.bytes) best = { dataUrl, bytes };
      if (bytes <= TARGET_BYTES) {
        return { dataUrl, bytes };
      }
    }
    side = Math.max(240, Math.floor(side * 0.75));
  }

  if (best && best.bytes <= ABS_MAX_BYTES) return best;
  throw new Error(
    "Ảnh vẫn quá lớn sau khi nén — hãy chọn ảnh đơn giản hơn hoặc độ phân giải thấp hơn",
  );
}

export function formatCatalogBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
