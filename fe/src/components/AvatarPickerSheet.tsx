import { useRef } from "react";
import { AVATARS, isCustomAvatar, normalizeAvatar } from "../avatars";
import { BottomSheet } from "./BottomSheet";

interface AvatarPickerSheetProps {
  open: boolean;
  current: string | null | undefined;
  busy?: boolean;
  onClose: () => void;
  onPick: (avatar: string) => void;
  /** Chọn ảnh từ máy */
  onUploadFile?: (file: File) => void | Promise<void>;
}

export function AvatarPickerSheet({
  open,
  current,
  busy = false,
  onClose,
  onPick,
  onUploadFile,
}: AvatarPickerSheetProps) {
  const selected = normalizeAvatar(current);
  const fileRef = useRef<HTMLInputElement>(null);
  const custom = isCustomAvatar(current) ? normalizeAvatar(current) : null;

  return (
    <BottomSheet
      open={open}
      title="Đổi avatar"
      onClose={onClose}
      heightClass="h-auto max-h-[70vh]"
    >
      <p className="mb-3 text-[11px] text-white/50">
        Chọn mẫu có sẵn hoặc tải ảnh từ máy
      </p>

      {onUploadFile && (
        <div className="mb-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onUploadFile(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ring-1 ${
              busy
                ? "opacity-60 bg-white/5 text-white/50 ring-white/10"
                : "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-[var(--gold)]/40 active:scale-[0.99]"
            }`}
          >
            {custom ? (
              <img
                src={custom}
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/30"
              />
            ) : null}
            {busy ? "Đang tải…" : "Chọn ảnh từ máy"}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-white/35">
            JPG / PNG / WebP · cắt vuông tự động
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 pb-4 sm:grid-cols-5">
        {custom && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onPick(custom)}
            className="rounded-2xl bg-[var(--gold)]/20 p-1.5 ring-2 ring-[var(--gold)]"
            title="Avatar từ máy"
          >
            <img
              src={custom}
              alt=""
              className="mx-auto h-14 w-14 rounded-full object-cover"
            />
          </button>
        )}
        {AVATARS.map((src) => {
          const active = src === selected;
          return (
            <button
              key={src}
              type="button"
              disabled={busy || active}
              onClick={() => onPick(src)}
              className={`rounded-2xl p-1.5 transition ${
                active
                  ? "bg-[var(--gold)]/20 ring-2 ring-[var(--gold)]"
                  : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
              } ${busy ? "opacity-60" : ""}`}
              title="Chọn avatar"
            >
              <img
                src={src}
                alt=""
                className="mx-auto h-14 w-14 rounded-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
