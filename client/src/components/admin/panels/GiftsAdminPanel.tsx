import { useCallback, useEffect, useState } from "react";
import { api } from "../../../auth";
import { formatXu } from "../../../cards";
import { ITEM_XU_MAX } from "../../../rings";
import {
  GIFT_CATEGORIES,
  type GiftCategory,
  type GiftFlyStyle,
  type GiftFlyTier,
  type GiftItem,
} from "../../../gifts";
import { ImageUploadPopup } from "../../ImageUploadPopup";

const emptyDraft = () => ({
  key: "",
  nameVi: "",
  emoji: "🎁",
  image: "",
  price: "100",
  category: "warm" as GiftCategory,
  blurb: "",
  enabled: true,
});

export function GiftsAdminPanel({ onMsg }: { onMsg: (s: string) => void }) {
  const [rows, setRows] = useState<GiftItem[]>([]);
  const [flyTiers, setFlyTiers] = useState<GiftFlyTier[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<"catalog" | "fly">("catalog");
  const [uploadKey, setUploadKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        gifts: GiftItem[];
        flyTiers: GiftFlyTier[];
      }>("/api/sgift/config");
      setRows(r.gifts ?? []);
      setFlyTiers(r.flyTiers ?? []);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải catalog quà");
    } finally {
      setBusy(false);
    }
  }, [onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveGift = async () => {
    const key = draft.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!key) {
      onMsg("Key quà không hợp lệ");
      return;
    }
    const price = Math.floor(Number(draft.price));
    if (!Number.isFinite(price) || price < 10 || price > ITEM_XU_MAX) {
      onMsg(`Giá phải 10–${ITEM_XU_MAX.toLocaleString("vi-VN")}`);
      return;
    }
    setBusy(true);
    try {
      await api("/api/sgift/gifts", {
        method: "POST",
        body: JSON.stringify({
          key,
          nameVi: draft.nameVi.trim() || key,
          emoji: draft.emoji.trim() || "🎁",
          image: draft.image.trim() || undefined,
          price,
          category: draft.category,
          blurb: draft.blurb.trim() || undefined,
          enabled: draft.enabled,
        }),
      });
      onMsg(`Đã lưu quà «${key}»`);
      setDraft(emptyDraft());
      await load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu quà");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: string, enabled: boolean) => {
    setBusy(true);
    try {
      await api("/api/sgift/gifts/toggle", {
        method: "POST",
        body: JSON.stringify({ key, enabled }),
      });
      onMsg(enabled ? `Đã bật ${key}` : `Đã tắt ${key}`);
      await load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi toggle");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key: string) => {
    if (!window.confirm(`Xóa quà «${key}» khỏi catalog?`)) return;
    setBusy(true);
    try {
      await api("/api/sgift/gifts/remove", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      onMsg(`Đã xóa ${key}`);
      await load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi xóa");
    } finally {
      setBusy(false);
    }
  };

  const saveFly = async () => {
    setBusy(true);
    try {
      await api("/api/sgift/fly-tiers", {
        method: "POST",
        body: JSON.stringify({ flyTiers }),
      });
      onMsg("Đã lưu fly tiers");
      await load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu fly");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 space-y-3">
      <div className="app-panel space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="play-heading text-sm">Quà · Catalog & Fly</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Quản lí / update quà tặng — giá social xu · ảnh catalog · fly
              effect. Mainadmin + SGift.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
          >
            Tải lại
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["catalog", "Catalog"],
              ["fly", "Fly tiers"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                sub === id
                  ? "bg-[var(--wood-deep)] text-white"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/15"
              }`}
              onClick={() => setSub(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sub === "catalog" ? (
        <div className="app-panel space-y-3 p-3 sm:p-4">
          <p className="text-[11px] text-[var(--play-muted)]">
            Giá clamp 10–{ITEM_XU_MAX.toLocaleString("vi-VN")} xu. Category: warm
            / prestige / legend / fun.
          </p>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {rows.map((g) => (
              <li
                key={g.key}
                className="rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold text-[var(--play-ink)]">
                      {g.image ? (
                        <img
                          src={g.image}
                          alt=""
                          className="h-6 w-6 object-contain"
                        />
                      ) : (
                        <span>{g.emoji}</span>
                      )}{" "}
                      {g.nameVi}{" "}
                      <span className="font-mono text-[10px] text-[var(--play-muted)]">
                        {g.key}
                      </span>
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {g.category} · {formatXu(g.price)} xu
                      {g.enabled ? "" : " · tắt"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setDraft({
                          key: g.key,
                          nameVi: g.nameVi,
                          emoji: g.emoji,
                          image: g.image ?? "",
                          price: String(g.price),
                          category: g.category,
                          blurb: g.blurb ?? "",
                          enabled: g.enabled,
                        })
                      }
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggle(g.key, !g.enabled)}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                    >
                      {g.enabled ? "Tắt" : "Bật"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(g.key)}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-red-800 ring-1 ring-red-300/60"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--wood-deep)]/10 pt-3">
            <p className="mb-2 text-[11px] font-bold">Thêm / cập nhật</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                Key
                <input
                  value={draft.key}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, key: e.target.value }))
                  }
                  className="app-input mt-0.5 w-full font-mono"
                />
              </label>
              <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                Tên
                <input
                  value={draft.nameVi}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, nameVi: e.target.value }))
                  }
                  className="app-input mt-0.5 w-full"
                />
              </label>
              <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                Emoji / ảnh
                <div className="mt-0.5 flex gap-1">
                  <input
                    value={draft.emoji}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, emoji: e.target.value }))
                    }
                    className="app-input w-full"
                    placeholder="🎁"
                  />
                  <button
                    type="button"
                    disabled={busy || !draft.key.trim()}
                    onClick={() =>
                      setUploadKey(draft.key.trim().toLowerCase())
                    }
                    className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
                  >
                    Tải ảnh
                  </button>
                </div>
                {draft.image ? (
                  <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--play-muted)]">
                    <img
                      src={draft.image}
                      alt=""
                      className="h-6 w-6 object-contain"
                    />
                    <span className="truncate font-mono">{draft.image}</span>
                  </span>
                ) : null}
              </label>
              <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                Giá
                <input
                  type="number"
                  min={10}
                  max={ITEM_XU_MAX}
                  value={draft.price}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, price: e.target.value }))
                  }
                  className="app-input mt-0.5 w-full"
                />
              </label>
              <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                Category
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      category: e.target.value as GiftCategory,
                    }))
                  }
                  className="app-input mt-0.5 w-full"
                >
                  {GIFT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-[10px] font-semibold text-[var(--play-muted)]">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, enabled: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[var(--jade-deep)]"
                />
                Enabled
              </label>
            </div>
            <label className="mt-2 block text-[10px] font-semibold text-[var(--play-muted)]">
              Blurb
              <input
                value={draft.blurb}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, blurb: e.target.value }))
                }
                className="app-input mt-0.5 w-full"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveGift()}
              className="mt-3 rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-50"
            >
              Lưu / thêm quà
            </button>
          </div>
        </div>
      ) : (
        <div className="app-panel space-y-3 p-3 sm:p-4">
          <p className="text-[11px] text-[var(--play-muted)]">
            Ngưỡng xu → toast / marquee / fly / fullscreen.
          </p>
          <ul className="space-y-2">
            {flyTiers.map((t, idx) => (
              <li
                key={`${t.id}-${idx}`}
                className="rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                    Id
                    <input
                      value={t.id}
                      onChange={(e) =>
                        setFlyTiers((rows) =>
                          rows.map((row, i) =>
                            i === idx ? { ...row, id: e.target.value } : row,
                          ),
                        )
                      }
                      className="app-input mt-0.5 !w-24 font-mono"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                    Label
                    <input
                      value={t.label}
                      onChange={(e) =>
                        setFlyTiers((rows) =>
                          rows.map((row, i) =>
                            i === idx ? { ...row, label: e.target.value } : row,
                          ),
                        )
                      }
                      className="app-input mt-0.5 !w-28"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                    minAmount
                    <input
                      type="number"
                      value={t.minAmount}
                      onChange={(e) =>
                        setFlyTiers((rows) =>
                          rows.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  minAmount: Math.floor(Number(e.target.value)),
                                }
                              : row,
                          ),
                        )
                      }
                      className="app-input mt-0.5 !w-28"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                    durationMs
                    <input
                      type="number"
                      value={t.durationMs}
                      onChange={(e) =>
                        setFlyTiers((rows) =>
                          rows.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  durationMs: Math.floor(
                                    Number(e.target.value),
                                  ),
                                }
                              : row,
                          ),
                        )
                      }
                      className="app-input mt-0.5 !w-24"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                    Style
                    <select
                      value={t.style}
                      onChange={(e) =>
                        setFlyTiers((rows) =>
                          rows.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  style: e.target.value as GiftFlyStyle,
                                }
                              : row,
                          ),
                        )
                      }
                      className="app-input mt-0.5 !w-28"
                    >
                      {(
                        [
                          "toast",
                          "marquee",
                          "fly",
                          "fullscreen",
                        ] as GiftFlyStyle[]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 pb-1 text-[10px] font-semibold">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) =>
                        setFlyTiers((rows) =>
                          rows.map((row, i) =>
                            i === idx
                              ? { ...row, enabled: e.target.checked }
                              : row,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-[var(--jade-deep)]"
                    />
                    On
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveFly()}
            className="rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-50"
          >
            Lưu fly tiers
          </button>
        </div>
      )}

      <ImageUploadPopup
        open={!!uploadKey}
        kind="gift"
        itemKey={uploadKey || "gift"}
        onClose={() => setUploadKey(null)}
        onUploaded={(url) => {
          setDraft((d) => ({ ...d, image: url }));
          setUploadKey(null);
          onMsg("Đã gắn ảnh quà — nhớ bấm Lưu");
        }}
      />
    </section>
  );
}
