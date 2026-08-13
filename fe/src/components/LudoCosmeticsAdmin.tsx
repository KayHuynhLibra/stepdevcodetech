import { useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import {
  invalidateLudoCosmeticsCache,
  LUDO_COSMETICS_DEFAULTS,
  type LudoCosmetics,
  type LudoPawnColor,
} from "../hooks/useLudoCosmetics";
import {
  LUDO_BOARD_MODELS,
  LUDO_PALETTE_LIST,
  LUDO_PAWN_MODELS,
  isLudoPaletteId,
  isLudoViewMode,
  paletteColors,
  type LudoPaletteId,
  type LudoViewMode,
} from "../platform/ludo/cosmeticsCatalog";
import {
  LUDO_THEME_BOARD_ART,
  type LudoThemeId,
} from "../platform/ludo/themes";
import { ImageUploadPopup } from "./ImageUploadPopup";

type Draft = LudoCosmetics;

const PAWN_SLOTS: { id: LudoPawnColor; label: string }[] = [
  { id: "red", label: "Đỏ" },
  { id: "green", label: "Xanh lá" },
  { id: "yellow", label: "Vàng" },
  { id: "blue", label: "Xanh dương" },
];

const THEME_BOARD_SLOTS: { id: LudoThemeId; label: string }[] = [
  { id: "classic", label: "Cổ điển" },
  { id: "soccer", label: "Sân bóng" },
  { id: "arena", label: "Đấu trường" },
  { id: "garden", label: "Vườn" },
  { id: "neon", label: "Neon" },
  { id: "frost", label: "Băng giá" },
];

export function LudoCosmeticsAdmin({
  canEdit,
  onMsg,
}: {
  canEdit: boolean;
  onMsg: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    ...LUDO_COSMETICS_DEFAULTS,
    pawnUrls: {},
    playerColors: {},
  });
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{
    field: "board" | "pawn" | "dice" | "themeBoard";
    pawnColor?: LudoPawnColor;
    themeId?: LudoThemeId;
  } | null>(null);

  const previewColors = useMemo(() => {
    const base = paletteColors(draft.paletteId);
    return {
      red: draft.playerColors.red || base.red,
      green: draft.playerColors.green || base.green,
      yellow: draft.playerColors.yellow || base.yellow,
      blue: draft.playerColors.blue || base.blue,
    };
  }, [draft.paletteId, draft.playerColors]);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        games: Partial<Record<"ludo", Partial<LudoCosmetics>>>;
      }>("/api/admin/pm/presets");
      const g = r.games?.ludo ?? {};
      setDraft({
        boardUrl: (g.boardUrl || "").trim(),
        pawnUrls: { ...(g.pawnUrls ?? {}) },
        diceUrl: (g.diceUrl || "").trim(),
        reduceFx: !!g.reduceFx,
        paletteId: isLudoPaletteId(g.paletteId) ? g.paletteId : "classic",
        playerColors: { ...(g.playerColors ?? {}) },
        pawnModelId: (g.pawnModelId || "procedural").trim() || "procedural",
        pawnModelUrl: (g.pawnModelUrl || "").trim(),
        boardModelId: (g.boardModelId || "procedural").trim() || "procedural",
        boardModelUrl: (g.boardModelUrl || "").trim(),
        viewMode: isLudoViewMode(g.viewMode) ? g.viewMode : "orbit",
        themeBoards: { ...(g.themeBoards ?? {}) },
      });
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải Cosmetics Ludo");
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
      await api("/api/admin/pm/presets", {
        method: "POST",
        body: JSON.stringify({
          gameId: "ludo",
          preset: {
            boardUrl: draft.boardUrl,
            pawnUrls: draft.pawnUrls,
            diceUrl: draft.diceUrl,
            reduceFx: draft.reduceFx,
            paletteId: draft.paletteId,
            playerColors:
              draft.paletteId === "custom"
                ? draft.playerColors
                : { red: "", green: "", yellow: "", blue: "" },
            pawnModelId: draft.pawnModelId,
            pawnModelUrl: draft.pawnModelUrl,
            boardModelId: draft.boardModelId,
            boardModelUrl: draft.boardModelUrl,
            viewMode: draft.viewMode,
            themeBoards: draft.themeBoards,
          },
        }),
      });
      invalidateLudoCosmeticsCache();
      onMsg("Đã lưu Cosmetics Ludo");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu Cosmetics Ludo");
    } finally {
      setBusy(false);
    }
  };

  const setPalette = (id: LudoPaletteId) => {
    setDraft((d) => ({
      ...d,
      paletteId: id,
      playerColors:
        id === "custom"
          ? { ...paletteColors("classic"), ...d.playerColors }
          : {},
    }));
  };

  return (
    <section className="app-panel space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Cosmetics · Ludo</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Palette · model bàn/quân (.glb) · camera 3D · ảnh (chỉ Main Admin /
            P+M)
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
          Palette màu ghế
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LUDO_PALETTE_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => setPalette(p.id)}
              className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-45 ${
                draft.paletteId === p.id
                  ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/12"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAWN_SLOTS.map(({ id, label }) => (
            <label
              key={id}
              className="flex items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] ring-1 ring-[var(--wood-deep)]/10"
            >
              <span
                className="h-4 w-4 rounded-full ring-1 ring-black/10"
                style={{ background: previewColors[id] }}
              />
              <span className="font-bold">{label}</span>
              {draft.paletteId === "custom" ? (
                <input
                  type="color"
                  disabled={!canEdit || busy}
                  value={previewColors[id]}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      playerColors: {
                        ...d.playerColors,
                        [id]: e.target.value,
                      },
                    }))
                  }
                  className="h-6 w-8 cursor-pointer border-0 bg-transparent"
                />
              ) : null}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
          <p className="text-[11px] font-bold">Model quân (.glb)</p>
          <select
            disabled={!canEdit || busy}
            className="app-input mt-1.5 w-full !py-1.5 !text-[11px]"
            value={draft.pawnModelId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, pawnModelId: e.target.value }))
            }
          >
            {LUDO_PAWN_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            className="app-input mt-1.5 w-full !py-1 font-mono !text-[10px]"
            disabled={!canEdit || busy}
            value={draft.pawnModelUrl}
            onChange={(e) =>
              setDraft((d) => ({ ...d, pawnModelUrl: e.target.value }))
            }
            placeholder="URL .glb override (tuỳ chọn)"
          />
        </div>
        <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
          <p className="text-[11px] font-bold">Model bàn (.glb)</p>
          <select
            disabled={!canEdit || busy}
            className="app-input mt-1.5 w-full !py-1.5 !text-[11px]"
            value={draft.boardModelId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, boardModelId: e.target.value }))
            }
          >
            {LUDO_BOARD_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            className="app-input mt-1.5 w-full !py-1 font-mono !text-[10px]"
            disabled={!canEdit || busy}
            value={draft.boardModelUrl}
            onChange={(e) =>
              setDraft((d) => ({ ...d, boardModelUrl: e.target.value }))
            }
            placeholder="URL .glb override (tuỳ chọn)"
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
          Camera 3D mặc định
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              { id: "orbit" as LudoViewMode, label: "Xoay tự do (orbit)" },
              { id: "screen" as LudoViewMode, label: "Hướng màn hình" },
              { id: "cinema" as LudoViewMode, label: "Góc đẹp 3/4 (cinema)" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => setDraft((d) => ({ ...d, viewMode: m.id }))}
              className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-45 ${
                draft.viewMode === m.id
                  ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/12"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--cream)]">
          {draft.boardUrl ? (
            <img
              src={draft.boardUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[9px] text-[var(--play-muted)]">
              bàn
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Ảnh bàn (texture)</p>
          <input
            className="app-input mt-1 w-full !py-1 font-mono !text-[10px]"
            disabled={!canEdit || busy}
            value={draft.boardUrl}
            onChange={(e) =>
              setDraft((d) => ({ ...d, boardUrl: e.target.value }))
            }
            placeholder="/uploads/… hoặc URL"
          />
        </div>
        <button
          type="button"
          disabled={!canEdit || busy}
          onClick={() => setUpload({ field: "board" })}
          className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
        >
          Upload
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAWN_SLOTS.map(({ id, label }) => {
          const url = draft.pawnUrls[id];
          return (
            <div
              key={id}
              className="rounded-xl bg-white/70 px-2 py-2 text-center text-[10px] ring-1 ring-[var(--wood-deep)]/10"
            >
              <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--cream)]">
                {url ? (
                  <img
                    src={url}
                    alt={label}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span
                    className="h-6 w-6 rounded-full"
                    style={{ background: previewColors[id] }}
                  />
                )}
              </div>
              <p className="font-bold">{label}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                <button
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={() => setUpload({ field: "pawn", pawnColor: id })}
                  className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
                >
                  Upload
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy || !url}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      pawnUrls: { ...d.pawnUrls, [id]: "" },
                    }))
                  }
                  className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-40"
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--cream)]">
          {draft.diceUrl ? (
            <img
              src={draft.diceUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[9px] text-[var(--play-muted)]">
              🎲
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Mặt xúc xắc</p>
          <input
            className="app-input mt-1 w-full !py-1 font-mono !text-[10px]"
            disabled={!canEdit || busy}
            value={draft.diceUrl}
            onChange={(e) =>
              setDraft((d) => ({ ...d, diceUrl: e.target.value }))
            }
            placeholder="tuỳ chọn"
          />
        </div>
        <button
          type="button"
          disabled={!canEdit || busy}
          onClick={() => setUpload({ field: "dice" })}
          className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
        >
          Upload
        </button>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
          Ảnh bàn theo theme (garden / neon / frost…)
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
          Trống = dùng pack mặc định{" "}
          <code className="text-[9px]">/assets/ludo/&lt;theme&gt;/board.png</code>
        </p>
        <div className="mt-2 space-y-2">
          {THEME_BOARD_SLOTS.map(({ id, label }) => {
            const url = (draft.themeBoards?.[id]?.boardUrl || "").trim();
            const fallback = LUDO_THEME_BOARD_ART[id] || "";
            const preview = url || fallback;
            return (
              <div
                key={id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--cream)]">
                  {preview ? (
                    <img
                      src={preview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[9px] text-[var(--play-muted)]">
                      {id}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {label}{" "}
                    <span className="font-mono text-[9px] opacity-60">{id}</span>
                  </p>
                  <input
                    className="app-input mt-1 w-full !py-1 font-mono !text-[10px]"
                    disabled={!canEdit || busy}
                    value={url}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        themeBoards: {
                          ...d.themeBoards,
                          [id]: {
                            ...(d.themeBoards?.[id] ?? {}),
                            boardUrl: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder={fallback || "/uploads/…"}
                  />
                </div>
                <button
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={() => setUpload({ field: "themeBoard", themeId: id })}
                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
                >
                  Upload
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy || !url}
                  onClick={() =>
                    setDraft((d) => {
                      const next = { ...d.themeBoards };
                      const cur = { ...(next[id] ?? {}) };
                      delete cur.boardUrl;
                      if (!cur.boardModelUrl) delete next[id];
                      else next[id] = cur;
                      return { ...d, themeBoards: next };
                    })
                  }
                  className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-40"
                >
                  Xóa
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[11px] font-semibold">
        <input
          type="checkbox"
          disabled={!canEdit || busy}
          checked={draft.reduceFx}
          onChange={(e) =>
            setDraft((d) => ({ ...d, reduceFx: e.target.checked }))
          }
        />
        Giảm FX (tắt hop animation)
      </label>

      <ImageUploadPopup
        open={!!upload}
        kind="lobby"
        itemKey={
          upload?.field === "pawn"
            ? `ludo-pawn-${upload.pawnColor}`
            : upload?.field === "dice"
              ? "ludo-dice"
              : upload?.field === "themeBoard"
                ? `ludo-theme-${upload.themeId}`
                : "ludo-board"
        }
        onClose={() => setUpload(null)}
        onUploaded={(url) => {
          if (!upload) return;
          if (upload.field === "board") {
            setDraft((d) => ({ ...d, boardUrl: url }));
          } else if (upload.field === "dice") {
            setDraft((d) => ({ ...d, diceUrl: url }));
          } else if (upload.field === "themeBoard" && upload.themeId) {
            const tid = upload.themeId;
            setDraft((d) => ({
              ...d,
              themeBoards: {
                ...d.themeBoards,
                [tid]: {
                  ...(d.themeBoards?.[tid] ?? {}),
                  boardUrl: url,
                },
              },
            }));
          } else if (upload.pawnColor) {
            setDraft((d) => ({
              ...d,
              pawnUrls: { ...d.pawnUrls, [upload.pawnColor!]: url },
            }));
          }
          setUpload(null);
          onMsg("Đã upload — nhớ Lưu Cosmetics");
        }}
      />
    </section>
  );
}
