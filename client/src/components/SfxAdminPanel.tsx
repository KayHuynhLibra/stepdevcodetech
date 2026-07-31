import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "../auth";
import {
  BOI_SFX_SLOT_META,
  BOI_SFX_SLOTS,
  OLYMPUS_SFX_SLOT_META,
  OLYMPUS_SFX_SLOTS,
  SFX_STYLES,
  TAROT_SFX_SLOT_META,
  TAROT_SFX_SLOTS,
  type SfxStyleId,
} from "../sfxCatalog";
import { invalidateSfxRuntimeCache } from "../hooks/useSfx";
import { invalidatePlayMediaPresetsCache } from "../hooks/useApplyPlayMediaPresets";

type GameId = "tarot" | "olympus" | "arcana" | "boi";

type GameSfx = {
  styles?: Partial<Record<string, SfxStyleId>>;
  paths?: Partial<Record<string, string>>;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 1_200_000) {
      reject(new Error("File âm tối đa ~1.2MB"));
      return;
    }
    const ok = /^(audio\/(mpeg|mp3|wav|wave|x-wav|ogg|webm|mp4|aac|x-m4a))$/i.test(
      file.type,
    );
    if (!ok && !/\.(mp3|wav|ogg|webm|m4a)$/i.test(file.name)) {
      reject(new Error("Chỉ MP3 / WAV / OGG / WebM / M4A"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
}

function SlotRows({
  gameId,
  slots,
  meta,
  sfx,
  busy,
  canEdit,
  onStyle,
  onUpload,
  onClearPath,
  onPreview,
}: {
  gameId: GameId;
  slots: readonly string[];
  meta: Record<string, { label: string; hint: string }>;
  sfx: GameSfx;
  busy: boolean;
  canEdit: boolean;
  onStyle: (slot: string, style: SfxStyleId) => void;
  onUpload: (slot: string, file: File) => void;
  onClearPath: (slot: string) => void;
  onPreview: (slot: string) => void;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <ul className="mt-2 space-y-2">
      {slots.map((slot) => {
        const m = meta[slot] ?? { label: slot, hint: "" };
        const style = sfx.styles?.[slot] ?? "classic";
        const path = sfx.paths?.[slot];
        return (
          <li
            key={`${gameId}-${slot}`}
            className="rounded-xl bg-white/75 px-2.5 py-2 ring-1 ring-[var(--wood-deep)]/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-bold">{m.label}</p>
                <p className="text-[10px] text-[var(--play-muted)]">{m.hint}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPreview(slot)}
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
              >
                Nghe
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SFX_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={!canEdit || busy || !!path}
                  title={s.hint}
                  onClick={() => onStyle(slot, s.id)}
                  className={`rounded-full px-2 py-1 text-[10px] font-bold disabled:opacity-45 ${
                    !path && style === s.id
                      ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                      : "bg-white ring-1 ring-[var(--wood-deep)]/12"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <input
                ref={(el) => {
                  fileRefs.current[slot] = el;
                }}
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(slot, f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => fileRefs.current[slot]?.click()}
                className="rounded-full bg-amber-900/90 px-2.5 py-1 text-[10px] font-bold text-amber-50 disabled:opacity-45"
              >
                Upload âm
              </button>
              {path ? (
                <>
                  <span className="max-w-[10rem] truncate font-mono text-[9px] text-[var(--play-muted)]">
                    {path}
                  </span>
                  <button
                    type="button"
                    disabled={!canEdit || busy}
                    onClick={() => onClearPath(slot)}
                    className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-rose-800 ring-1 ring-rose-300/50 disabled:opacity-45"
                  >
                    Bỏ file
                  </button>
                </>
              ) : (
                <span className="text-[9px] text-[var(--play-muted)]">
                  Không file → dùng 4 kiểu synth
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SfxAdminPanel({
  canEdit,
  onMsg,
  presets,
  setPresets,
  busy,
  setBusy,
}: {
  canEdit: boolean;
  onMsg: (s: string) => void;
  presets: Partial<
    Record<GameId, { sfx?: GameSfx & Record<string, unknown> }>
  >;
  setPresets: Dispatch<
    SetStateAction<
      Partial<Record<GameId, { sfx?: GameSfx & Record<string, unknown> }>>
    >
  >;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<GameId>("tarot");

  const patchSfx = async (gameId: GameId, sfxPatch: GameSfx) => {
    if (!canEdit) {
      onMsg("Không đủ quyền P+M");
      return;
    }
    setBusy(true);
    try {
      const cur = presets[gameId]?.sfx ?? {};
      const nextSfx = {
        ...cur,
        ...sfxPatch,
        styles: { ...(cur.styles ?? {}), ...(sfxPatch.styles ?? {}) },
        paths: { ...(cur.paths ?? {}), ...(sfxPatch.paths ?? {}) },
      };
      if (sfxPatch.paths) {
        for (const [k, v] of Object.entries(sfxPatch.paths)) {
          if (v === "") delete (nextSfx.paths as Record<string, string>)[k];
        }
      }
      const r = await api<{
        ok: true;
        games: Partial<Record<GameId, { sfx?: GameSfx }>>;
      }>("/api/admin/pm/presets", {
        method: "POST",
        body: JSON.stringify({
          gameId,
          preset: { sfx: nextSfx },
        }),
      });
      setPresets((prev) => ({
        ...prev,
        ...r.games,
      }));
      invalidateSfxRuntimeCache();
      invalidatePlayMediaPresetsCache();
      onMsg(`Đã lưu SFX ${gameId}`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu SFX");
    } finally {
      setBusy(false);
    }
  };

  const onStyle = (slot: string, style: SfxStyleId) => {
    void patchSfx(tab, { styles: { [slot]: style } });
  };

  const onUpload = async (slot: string, file: File) => {
    if (!canEdit) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await api<{
        ok: true;
        url: string;
        games: Partial<Record<GameId, { sfx?: GameSfx }>>;
      }>("/api/admin/sfx-upload", {
        method: "POST",
        body: JSON.stringify({ gameId: tab, slot, dataUrl }),
      });
      setPresets((prev) => ({ ...prev, ...r.games }));
      invalidateSfxRuntimeCache();
      invalidatePlayMediaPresetsCache();
      onMsg(`Đã upload âm ${tab}/${slot}`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi upload âm");
    } finally {
      setBusy(false);
    }
  };

  const onClearPath = (slot: string) => {
    void patchSfx(tab, { paths: { [slot]: "" } });
  };

  const onPreview = (slot: string) => {
    const path = presets[tab]?.sfx?.paths?.[slot];
    if (path) {
      const a = new Audio(path);
      a.volume = 0.7;
      void a.play().catch(() => onMsg("Không phát được file"));
      return;
    }
    // Quick synth ping via AudioContext for preview without full hook
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = 660;
      g.gain.value = 0.08;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      window.setTimeout(() => void ctx.close(), 300);
      onMsg(`Preview synth · ${slot} (${presets[tab]?.sfx?.styles?.[slot] ?? "classic"})`);
    } catch {
      onMsg("Không preview được");
    }
  };

  const sfx = (presets[tab]?.sfx ?? {}) as GameSfx;

  return (
    <section className="app-panel space-y-3 p-3">
      <div>
        <p className="play-heading text-sm">SFX · Tuỳ chọn âm thanh</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Mỗi phần 4 kiểu (Cổ điển / Êm / Sắc / Sáng) hoặc upload file riêng.
          Ưu tiên bàn Tarot 8 lá.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["tarot", "Tarot 8 lá"],
            ["olympus", "Olympus"],
            ["boi", "Bói bài"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
              tab === id
                ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                : "bg-white ring-1 ring-[var(--wood-deep)]/12"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tarot" ? (
        <SlotRows
          gameId="tarot"
          slots={TAROT_SFX_SLOTS}
          meta={TAROT_SFX_SLOT_META}
          sfx={sfx}
          busy={busy}
          canEdit={canEdit}
          onStyle={onStyle}
          onUpload={(s, f) => void onUpload(s, f)}
          onClearPath={onClearPath}
          onPreview={onPreview}
        />
      ) : null}
      {tab === "olympus" ? (
        <SlotRows
          gameId="olympus"
          slots={OLYMPUS_SFX_SLOTS}
          meta={OLYMPUS_SFX_SLOT_META}
          sfx={sfx}
          busy={busy}
          canEdit={canEdit}
          onStyle={onStyle}
          onUpload={(s, f) => void onUpload(s, f)}
          onClearPath={onClearPath}
          onPreview={onPreview}
        />
      ) : null}
      {tab === "boi" ? (
        <SlotRows
          gameId="boi"
          slots={BOI_SFX_SLOTS}
          meta={BOI_SFX_SLOT_META}
          sfx={sfx}
          busy={busy}
          canEdit={canEdit}
          onStyle={onStyle}
          onUpload={(s, f) => void onUpload(s, f)}
          onClearPath={onClearPath}
          onPreview={onPreview}
        />
      ) : null}
    </section>
  );
}
