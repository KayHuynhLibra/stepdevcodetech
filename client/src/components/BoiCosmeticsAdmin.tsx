import { useEffect, useState } from "react";
import { api } from "../auth";
import {
  BOI_COSMETICS_DEFAULTS,
  COSMIC_BACK,
  invalidateBoiCosmeticsCache,
  type BoiBgFx,
  type BoiCardBackMode,
  type BoiCosmetics,
  type BoiFlipFx,
} from "../hooks/useBoiCosmetics";
import { ImageUploadPopup } from "./ImageUploadPopup";

type Draft = BoiCosmetics;

const BACK_MODES: { id: BoiCardBackMode; label: string; hint: string }[] = [
  { id: "css", label: "CSS mặc định", hint: "Gradient + sigil" },
  { id: "image", label: "Ảnh úp", hint: "Full ảnh mặt úp" },
  { id: "ornate", label: "Ornate", hint: "Ảnh + khung vàng" },
];

const BG_FX: { id: BoiBgFx; label: string }[] = [
  { id: "off", label: "Tắt" },
  { id: "stars", label: "Stars" },
  { id: "mist", label: "Mist" },
  { id: "cosmic", label: "Cosmic" },
  { id: "pulse", label: "Pulse" },
];

const FLIP_FX: { id: BoiFlipFx; label: string }[] = [
  { id: "olympus", label: "Olympus" },
  { id: "cosmic", label: "Cosmic" },
  { id: "alchemy", label: "Alchemy" },
  { id: "off", label: "Tắt" },
];

export function BoiCosmeticsAdmin({
  canEdit,
  onMsg,
}: {
  canEdit: boolean;
  onMsg: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>({ ...BOI_COSMETICS_DEFAULTS });
  const [busy, setBusy] = useState(false);
  const [uploadField, setUploadField] = useState<"cardBack" | "bg" | null>(
    null,
  );

  const load = async () => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        cosmetics: {
          heroUrl?: string;
          cardBackMode?: BoiCardBackMode;
          cardBackUrl?: string;
          bgUrl?: string;
          bgFx?: BoiBgFx;
          flipFx?: BoiFlipFx;
          reduceFx?: boolean;
        };
      }>("/api/admin/boi/cosmetics");
      const g = r.cosmetics ?? {};
      setDraft({
        cardBackMode:
          g.cardBackMode === "image" || g.cardBackMode === "ornate"
            ? g.cardBackMode
            : "css",
        cardBackUrl: (g.cardBackUrl || "").trim(),
        bgUrl: (g.bgUrl || g.heroUrl || "").trim(),
        bgFx:
          g.bgFx === "off" ||
          g.bgFx === "mist" ||
          g.bgFx === "cosmic" ||
          g.bgFx === "pulse"
            ? g.bgFx
            : "stars",
        flipFx:
          g.flipFx === "off" ||
          g.flipFx === "cosmic" ||
          g.flipFx === "alchemy"
            ? g.flipFx
            : "olympus",
        reduceFx: !!g.reduceFx,
      });
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải Cosmetics Bói");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!canEdit) {
      onMsg("Không đủ quyền sửa Cosmetics");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/boi/cosmetics", {
        method: "POST",
        body: JSON.stringify({
          preset: {
            cardBackMode: draft.cardBackMode,
            cardBackUrl: draft.cardBackUrl,
            bgUrl: draft.bgUrl,
            bgFx: draft.bgFx,
            flipFx: draft.flipFx,
            reduceFx: draft.reduceFx,
            ...(draft.bgUrl ? { heroUrl: draft.bgUrl } : {}),
          },
        }),
      });
      invalidateBoiCosmeticsCache();
      onMsg("Đã lưu Cosmetics Bói bài");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu Cosmetics");
    } finally {
      setBusy(false);
    }
  };

  const previewBack =
    draft.cardBackMode === "css"
      ? null
      : draft.cardBackUrl || COSMIC_BACK;

  return (
    <section className="app-panel space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Cosmetics · Bói bài</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Úp bài · hình nền hub/ritual · hiệu ứng (áp dụng tab Bói bài)
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Tải lại
          </button>
          {canEdit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
            >
              Lưu Cosmetics
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
          Chế độ úp bài
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {BACK_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!canEdit || busy}
              title={m.hint}
              onClick={() =>
                setDraft((d) => ({ ...d, cardBackMode: m.id }))
              }
              className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-45 ${
                draft.cardBackMode === m.id
                  ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/12"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
          <p className="text-[11px] font-bold">Mặt úp (card back)</p>
          <div className="mt-2 flex items-start gap-2">
            <div
              className="h-24 w-[4.3rem] shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--wood-deep)]/15"
              style={
                previewBack
                  ? undefined
                  : {
                      background:
                        "linear-gradient(155deg, #6b4424 0%, #2c160c 55%, #4a2c18 100%)",
                    }
              }
            >
              {previewBack ? (
                <img
                  src={previewBack}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full place-items-center text-lg text-amber-200">
                  ✦
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                className="app-input w-full !py-1 font-mono !text-[10px]"
                disabled={!canEdit || busy || draft.cardBackMode === "css"}
                value={draft.cardBackUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, cardBackUrl: e.target.value }))
                }
                placeholder={COSMIC_BACK}
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={!canEdit || busy || draft.cardBackMode === "css"}
                  onClick={() => setUploadField("cardBack")}
                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
                >
                  Upload
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy || draft.cardBackMode === "css"}
                  onClick={() =>
                    setDraft((d) => ({ ...d, cardBackUrl: COSMIC_BACK }))
                  }
                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
                >
                  Cosmic preset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
          <p className="text-[11px] font-bold">Hình nền (hub + ritual)</p>
          <div className="mt-2 flex items-start gap-2">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--cream)] ring-1 ring-[var(--wood-deep)]/15">
              {draft.bgUrl ? (
                <img
                  src={draft.bgUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full place-items-center text-[9px] text-[var(--play-muted)]">
                  mặc định
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                className="app-input w-full !py-1 font-mono !text-[10px]"
                disabled={!canEdit || busy}
                value={draft.bgUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, bgUrl: e.target.value }))
                }
                placeholder="/uploads/… hoặc /assets/…"
              />
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => setUploadField("bg")}
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
              >
                Upload nền
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
          Hiệu ứng nền
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {BG_FX.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => setDraft((d) => ({ ...d, bgFx: m.id }))}
              className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-45 ${
                draft.bgFx === m.id
                  ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/12"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
          Flip VFX khi lật
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FLIP_FX.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => setDraft((d) => ({ ...d, flipFx: m.id }))}
              className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-45 ${
                draft.flipFx === m.id
                  ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/12"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[11px] font-bold">
        <input
          type="checkbox"
          disabled={!canEdit || busy}
          checked={draft.reduceFx}
          onChange={(e) =>
            setDraft((d) => ({ ...d, reduceFx: e.target.checked }))
          }
        />
        Giảm FX (tôn trọng reduce motion / máy yếu)
      </label>

      <ImageUploadPopup
        open={!!uploadField}
        kind="oracle"
        itemKey={uploadField === "bg" ? "boi-bg" : "boi-cardback"}
        onClose={() => setUploadField(null)}
        onUploaded={(url) => {
          if (uploadField === "bg") {
            setDraft((d) => ({ ...d, bgUrl: url }));
          } else if (uploadField === "cardBack") {
            setDraft((d) => ({
              ...d,
              cardBackUrl: url,
              cardBackMode:
                d.cardBackMode === "css" ? "image" : d.cardBackMode,
            }));
          }
          setUploadField(null);
          onMsg("Đã gắn URL — nhớ Lưu Cosmetics");
        }}
      />
    </section>
  );
}
