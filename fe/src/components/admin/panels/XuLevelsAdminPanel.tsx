import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../../../auth";

type XuGameId =
  | "ludo"
  | "uno"
  | "oanQuan"
  | "olympus"
  | "arcana"
  | "tarot";

type Snap = {
  ok: true;
  presets: number[];
  quickAdds: number[];
  byGame: Partial<Record<XuGameId, number[]>>;
  gameIds?: XuGameId[];
  gameLabels?: Record<XuGameId, string>;
  updatedAt: number;
  updatedBy?: string;
};

const FALLBACK_LABELS: Record<XuGameId, string> = {
  ludo: "Cờ cá ngựa",
  uno: "HueRush",
  oanQuan: "Ô ăn quan",
  olympus: "BoltPeak",
  arcana: "Bánh xe Arcana",
  tarot: "Tarot (quick-add)",
};

const GAME_ORDER: XuGameId[] = [
  "ludo",
  "uno",
  "oanQuan",
  "olympus",
  "arcana",
  "tarot",
];

function listToText(list: number[] | undefined): string {
  return (list || []).join(", ");
}

function parseList(text: string, allowZero: boolean): number[] {
  return [
    ...new Set(
      text
        .split(/[,;\s]+/)
        .map((x) => Math.floor(Number(x.trim())))
        .filter((n) => Number.isFinite(n) && (allowZero ? n >= 0 : n > 0)),
    ),
  ].sort((a, b) => a - b);
}

export function XuLevelsAdminPanel({ onMsg }: { onMsg: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [presetsText, setPresetsText] = useState("0, 500, 1000, 5000");
  const [quickAddsText, setQuickAddsText] = useState(
    "10, 100, 1000, 10000, 100000, 1000000",
  );
  const [byGameText, setByGameText] = useState<Record<XuGameId, string>>({
    ludo: "",
    uno: "",
    oanQuan: "",
    olympus: "",
    arcana: "",
    tarot: "",
  });
  const [labels, setLabels] = useState(FALLBACK_LABELS);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [updatedBy, setUpdatedBy] = useState("");

  const applySnap = useCallback((s: Snap) => {
    setPresetsText(listToText(s.presets));
    setQuickAddsText(listToText(s.quickAdds));
    const next: Record<XuGameId, string> = {
      ludo: listToText(s.byGame?.ludo),
      uno: listToText(s.byGame?.uno),
      oanQuan: listToText(s.byGame?.oanQuan),
      olympus: listToText(s.byGame?.olympus),
      arcana: listToText(s.byGame?.arcana),
      tarot: listToText(s.byGame?.tarot ?? s.quickAdds),
    };
    setByGameText(next);
    if (s.gameLabels) setLabels({ ...FALLBACK_LABELS, ...s.gameLabels });
    setUpdatedAt(s.updatedAt || 0);
    setUpdatedBy(s.updatedBy || "");
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<Snap>("/api/mainadmin/xu-levels");
      applySnap(r);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải mức xu");
    } finally {
      setBusy(false);
    }
  }, [applySnap, onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const presets = parseList(presetsText, true);
      if (!presets.length) throw new Error("Cần ít nhất 1 mức presets");
      const quickAdds = parseList(quickAddsText, false);
      if (!quickAdds.length) throw new Error("Cần ít nhất 1 quick-add Tarot");
      const byGame: Partial<Record<XuGameId, number[]>> = {};
      for (const id of GAME_ORDER) {
        const allowZero = id === "ludo" || id === "uno" || id === "oanQuan";
        const list = parseList(byGameText[id] || "", allowZero);
        if (!list.length) throw new Error(`Mức ${labels[id]} trống`);
        byGame[id] = list;
      }
      const r = await api<Snap>("/api/mainadmin/xu-levels", {
        method: "POST",
        body: JSON.stringify({ presets, quickAdds, byGame }),
      });
      applySnap(r);
      onMsg("Đã lưu mức xu — áp cho tất cả game");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi lưu");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset toàn bộ mức xu về mặc định?")) return;
    setBusy(true);
    try {
      const r = await api<Snap>("/api/mainadmin/xu-levels", {
        method: "POST",
        body: JSON.stringify({ reset: true }),
      });
      applySnap(r);
      onMsg("Đã reset mức xu");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi reset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel mt-4 space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Mức xu · tất cả game</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Mainadmin chỉnh ladder xu từng game. Room (Cờ cá ngựa/HueRush/Ô ăn quan) cho
            phép 0 = free. Tarot = nút quick-add (vẫn đặt tự do trong min–max).
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Tải lại
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reset()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Reset
          </button>
        </div>
      </div>

      <form className="space-y-4" onSubmit={(e) => void save(e)}>
        <label className="block text-[11px] font-semibold">
          Presets mặc định (room)
          <input
            className="app-input mt-1 w-full !py-2 font-mono !text-[11px]"
            disabled={busy}
            value={presetsText}
            onChange={(ev) => setPresetsText(ev.target.value)}
            placeholder="0, 500, 1000, 5000"
          />
        </label>

        <label className="block text-[11px] font-semibold">
          Tarot quick-add
          <input
            className="app-input mt-1 w-full !py-2 font-mono !text-[11px]"
            disabled={busy}
            value={quickAddsText}
            onChange={(ev) => setQuickAddsText(ev.target.value)}
            placeholder="10, 100, 1000…"
          />
        </label>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
            Theo từng game
          </p>
          {GAME_ORDER.map((id) => (
            <label key={id} className="block text-[11px] font-semibold">
              {labels[id] || id}
              <input
                className="app-input mt-1 w-full !py-2 font-mono !text-[11px]"
                disabled={busy}
                value={byGameText[id]}
                onChange={(ev) =>
                  setByGameText((p) => ({ ...p, [id]: ev.target.value }))
                }
                placeholder="vd: 0, 500, 1000…"
              />
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-45"
        >
          {busy ? "…" : "Lưu mức xu"}
        </button>
      </form>

      {updatedAt > 0 ? (
        <p className="text-[10px] text-[var(--play-muted)]">
          Cập nhật {new Date(updatedAt).toLocaleString("vi-VN")}
          {updatedBy ? ` · ${updatedBy}` : ""}
        </p>
      ) : null}
    </section>
  );
}
