import { useEffect, useState } from "react";
import { api } from "../auth";
import {
  fileToCatalogDataUrl,
  formatCatalogBytes,
} from "../catalogImage";

export type CatalogUploadKind =
  | "gift"
  | "ring"
  | "oracle"
  | "lobby"
  | "olympus";

interface ImageUploadPopupProps {
  open: boolean;
  kind: CatalogUploadKind;
  itemKey: string;
  onClose: () => void;
  onUploaded: (url: string) => void;
}

export function ImageUploadPopup({
  open,
  kind,
  itemKey,
  onClose,
  onUploaded,
}: ImageUploadPopupProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setDataUrl(null);
      setBytes(null);
      setFileName(null);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const keyOk = itemKey.trim().length >= 2;
  const kindLabel =
    kind === "gift"
      ? "quà"
      : kind === "oracle"
        ? "bói bài"
        : kind === "lobby"
          ? "lobby"
          : kind === "olympus"
            ? "olympus"
            : "nhẫn";

  const onPick = async (file: File | null) => {
    setError(null);
    setPreview(null);
    setDataUrl(null);
    setBytes(null);
    setFileName(null);
    if (!file) return;
    setBusy(true);
    try {
      const { dataUrl: next, bytes: n } = await fileToCatalogDataUrl(file);
      setDataUrl(next);
      setPreview(next);
      setBytes(n);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được ảnh");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!dataUrl || !keyOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: true; url: string }>(
        "/api/admin/catalog-upload",
        {
          method: "POST",
          body: JSON.stringify({
            kind,
            key: itemKey.trim().toLowerCase(),
            dataUrl,
          }),
        },
      );
      onUploaded(r.url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:px-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Tải ảnh ${kindLabel}`}
      onClick={onClose}
    >
      <div
        className="app-panel w-full max-w-md space-y-3 rounded-t-2xl p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="play-heading text-sm">Tải ảnh {kindLabel}</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Key:{" "}
              <span className="font-mono font-semibold text-[var(--play-ink)]">
                {itemKey.trim() || "—"}
              </span>
              {" · "}tự nén WebP/JPEG ≤ ~700KB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Đóng
          </button>
        </div>

        {!keyOk && (
          <p className="rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-400/35">
            Nhập key vật phẩm (≥ 2 ký tự) trước khi tải ảnh.
          </p>
        )}

        <label className="block text-[10px] font-semibold text-[var(--play-muted)]">
          Chọn ảnh (máy / web / điện thoại)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            disabled={busy || !keyOk}
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
            className="app-input mt-0.5 w-full !py-1.5 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--wood-deep)] file:px-2.5 file:py-1 file:text-[10px] file:font-bold file:text-[var(--cream)]"
          />
        </label>
        <label className="block text-[10px] font-semibold text-[var(--play-muted)] sm:hidden">
          Chụp từ camera điện thoại
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy || !keyOk}
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
            className="app-input mt-0.5 w-full !py-1.5 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--wood-deep)] file:px-2.5 file:py-1 file:text-[10px] file:font-bold file:text-[var(--cream)]"
          />
        </label>

        {fileName && bytes != null && (
          <p className="text-[10px] text-[var(--play-muted)]">
            {fileName} → đã nén ~{formatCatalogBytes(bytes)}
          </p>
        )}

        {preview && (
          <div className="flex justify-center rounded-lg bg-white/70 p-3 ring-1 ring-[var(--wood-deep)]/10">
            <img
              src={preview}
              alt="Xem trước"
              className="max-h-40 max-w-full object-contain"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-400/35">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !dataUrl || !keyOk}
            onClick={() => void confirm()}
            className="rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-45"
          >
            {busy ? "Đang xử lý…" : "Xác nhận upload"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
