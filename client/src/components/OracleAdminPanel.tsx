import { useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import {
  ORACLE_SUIT_LABEL,
  ORACLE_SUIT_PRESETS,
  ORACLE_TRADITION_LABEL,
  ORACLE_TRADITION_PRESETS,
  type OracleCard,
  type OracleDeckId,
  type OracleDeckMeta,
  type OracleTradition,
} from "../oracle";
import { ImageUploadPopup } from "./ImageUploadPopup";

type Catalog = {
  decks: OracleDeckMeta[];
  cards: OracleCard[];
  counts?: {
    tarot: number;
    zodiac: number;
    enabled: number;
    draft?: number;
    total?: number;
    byDeck?: Record<string, number>;
  };
  updatedAt?: number;
};

const emptyDraft = (deckId: OracleDeckId): OracleCard => ({
  key: "",
  deckId,
  name: "",
  nameVi: "",
  number: 0,
  suit: deckId === "zodiac" ? "zodiac" : "major",
  upright: "",
  reversed: "",
  keywords: [],
  image: "/assets/oracle/tarot/fool.svg",
  enabled: true,
  sort: 0,
  tags: [],
  notes: "",
  citations: "",
  draft: false,
});

const emptyDeck = (): OracleDeckMeta => ({
  id: "",
  nameVi: "",
  blurb: "",
  enabled: true,
  sort: 100,
  tradition: "custom",
  research: true,
});

export function OracleAdminPanel({
  main,
  canEdit = false,
  onMsg,
  compact = false,
}: {
  main: boolean;
  /** P+M / oracle_manage — sửa deck + lá (reset seed vẫn chỉ mainadmin) */
  canEdit?: boolean;
  onMsg: (s: string) => void;
  compact?: boolean;
}) {
  const edit = canEdit || main;
  const [data, setData] = useState<Catalog | null>(null);
  const [deckFilter, setDeckFilter] = useState<OracleDeckId | "all">("tarot");
  const [traditionFilter, setTraditionFilter] = useState<
    OracleTradition | "all"
  >("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<OracleCard>(() => emptyDraft("tarot"));
  const [deckDraft, setDeckDraft] = useState<OracleDeckMeta>(() => emptyDeck());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [batchTags, setBatchTags] = useState("");
  const [cloneToId, setCloneToId] = useState("");

  const load = async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle");
      setData({
        decks: r.decks ?? [],
        cards: r.cards ?? [],
        counts: r.counts,
        updatedAt: r.updatedAt,
      });
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải bộ Bói bài");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const knownSuits = useMemo(() => {
    const set = new Set<string>([...ORACLE_SUIT_PRESETS]);
    for (const c of data?.cards ?? []) {
      if (c.suit) set.add(c.suit);
    }
    return [...set];
  }, [data?.cards]);

  const rows = (data?.cards ?? []).filter((c) => {
    if (deckFilter !== "all" && c.deckId !== deckFilter) return false;
    if (traditionFilter !== "all") {
      const deck = data?.decks.find((d) => d.id === c.deckId);
      if ((deck?.tradition ?? "custom") !== traditionFilter) return false;
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${c.key} ${c.name} ${c.nameVi} ${c.suit ?? ""} ${(c.tags ?? []).join(" ")} ${c.notes ?? ""}`
      .toLowerCase()
      .includes(needle);
  });

  const saveDeck = async () => {
    if (!edit) {
      onMsg("Không đủ quyền sửa bộ bài");
      return;
    }
    if (!deckDraft.id.trim() || !deckDraft.nameVi.trim()) {
      onMsg("Cần id bộ (slug) + tên VI");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle/deck", {
        method: "POST",
        body: JSON.stringify({
          deck: {
            ...deckDraft,
            id: deckDraft.id.trim().toLowerCase(),
          },
        }),
      });
      setData({
        decks: r.decks ?? [],
        cards: r.cards ?? [],
        counts: r.counts,
        updatedAt: r.updatedAt,
      });
      onMsg(`Đã lưu bộ «${deckDraft.nameVi}»`);
      setDeckFilter(deckDraft.id.trim().toLowerCase());
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu bộ");
    } finally {
      setBusy(false);
    }
  };

  const saveCard = async () => {
    if (!edit) {
      onMsg("Không đủ quyền sửa lá");
      return;
    }
    if (!draft.key.trim() || !draft.nameVi.trim()) {
      onMsg("Cần key + tên tiếng Việt");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle/card", {
        method: "POST",
        body: JSON.stringify({
          card: {
            ...draft,
            key: draft.key.trim().toLowerCase(),
            keywords: Array.isArray(draft.keywords)
              ? draft.keywords
              : String(draft.keywords ?? "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
          },
        }),
      });
      setData({
        decks: r.decks ?? [],
        cards: r.cards ?? [],
        counts: r.counts,
        updatedAt: r.updatedAt,
      });
      onMsg(`Đã lưu lá «${draft.nameVi}»`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu lá");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: OracleCard) => {
    if (!edit) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>(
        "/api/admin/oracle/card/toggle",
        {
          method: "POST",
          body: JSON.stringify({
            key: c.key,
            deckId: c.deckId,
            enabled: !c.enabled,
          }),
        },
      );
      setData({
        decks: r.decks ?? [],
        cards: r.cards ?? [],
        counts: r.counts,
        updatedAt: r.updatedAt,
      });
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi bật/tắt");
    } finally {
      setBusy(false);
    }
  };

  const resetSeed = async () => {
    if (!main) return;
    if (
      !confirm(
        "Khôi phục full seed RW + Marseille + Thoth (78×3) + Zodiac 12? Mọi chỉnh sửa tay sẽ mất.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ ok: true; count: number } & Catalog>(
        "/api/admin/oracle/reset-seed",
        { method: "POST", body: "{}" },
      );
      setData({
        decks: r.decks ?? [],
        cards: r.cards ?? [],
        counts: r.counts,
        updatedAt: r.updatedAt,
      });
      onMsg(`Đã seed lại ${r.count} lá`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi reset seed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={`app-panel space-y-3 p-3 sm:p-4 ${compact ? "mt-0" : "mt-4"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Bói bài / Lab — bộ & nghiên cứu</p>
          <p className="text-[11px] text-[var(--play-muted)]">
            RW · Marseille · Thoth · custom. Tags / notes / draft cho Lab.
            {data?.counts
              ? ` · ${data.counts.total ?? 0} lá · ${data.counts.enabled} bật${
                  data.counts.draft != null ? ` · ${data.counts.draft} draft` : ""
                }`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Làm mới
          </button>
          {main ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void resetSeed()}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-rose-900 ring-1 ring-rose-300/50 disabled:opacity-45"
            >
              Reset seed full
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setDeckFilter("all")}
          className={`rounded-full px-3 py-1 text-[10px] font-bold ${
            deckFilter === "all"
              ? "bg-[var(--wood-deep)] text-[var(--cream)]"
              : "bg-white ring-1 ring-[var(--wood-deep)]/12"
          }`}
        >
          Tất cả
        </button>
        {(data?.decks ?? []).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => {
              setDeckFilter(d.id);
              setDeckDraft({ ...d });
            }}
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              deckFilter === d.id
                ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                : "bg-white ring-1 ring-[var(--wood-deep)]/12"
            }`}
          >
            {d.nameVi}
            {data?.counts?.byDeck?.[d.id] != null
              ? ` (${data.counts.byDeck[d.id]})`
              : ""}
            {!d.enabled ? " ·OFF" : ""}
          </button>
        ))}
        <input
          className="app-input !px-2 !py-1 min-w-[10rem] flex-1 text-[11px]"
          placeholder="Lọc key / tên / suit / tag / notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="app-input !w-auto !px-2 !py-1 text-[10px]"
          value={traditionFilter}
          onChange={(e) =>
            setTraditionFilter(e.target.value as OracleTradition | "all")
          }
        >
          <option value="all">Mọi tradition</option>
          {ORACLE_TRADITION_PRESETS.map((t) => (
            <option key={t} value={t}>
              {ORACLE_TRADITION_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {edit ? (
        <>
          <div className="grid gap-2 rounded-xl bg-amber-50/80 p-2.5 ring-1 ring-amber-200/60 sm:grid-cols-2">
            <p className="play-heading col-span-full text-xs">
              Bộ bài (thêm / cập nhật)
            </p>
            <p className="col-span-full text-[10px] text-[var(--play-muted)]">
              Id slug mới (vd. <code>lenormand</code>, <code>oracle_extra</code>)
              → bộ riêng trên bàn Bói. Không đụng paytable Tarot 8 lá cược.
            </p>
            <label className="text-[10px] text-[var(--play-muted)]">
              Id (slug)
              <input
                className="app-input mt-0.5 w-full !py-1 font-mono text-[11px]"
                value={deckDraft.id}
                disabled={busy}
                placeholder="tarot | zodiac | my_deck"
                onChange={(e) =>
                  setDeckDraft((d) => ({ ...d, id: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Tên VI
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={deckDraft.nameVi}
                disabled={busy}
                onChange={(e) =>
                  setDeckDraft((d) => ({ ...d, nameVi: e.target.value }))
                }
              />
            </label>
            <label className="col-span-full text-[10px] text-[var(--play-muted)]">
              Mô tả
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={deckDraft.blurb}
                disabled={busy}
                onChange={(e) =>
                  setDeckDraft((d) => ({ ...d, blurb: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Tradition
              <select
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={deckDraft.tradition ?? "custom"}
                disabled={busy}
                onChange={(e) =>
                  setDeckDraft((d) => ({
                    ...d,
                    tradition: e.target.value as OracleTradition,
                  }))
                }
              >
                {ORACLE_TRADITION_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {ORACLE_TRADITION_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Sort
              <input
                type="number"
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={deckDraft.sort}
                disabled={busy}
                onChange={(e) =>
                  setDeckDraft((d) => ({
                    ...d,
                    sort: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={deckDraft.enabled}
                disabled={busy}
                onChange={(e) =>
                  setDeckDraft((d) => ({ ...d, enabled: e.target.checked }))
                }
              />
              Hiện trên bàn Bói
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={!!deckDraft.research}
                disabled={busy}
                onChange={(e) =>
                  setDeckDraft((d) => ({ ...d, research: e.target.checked }))
                }
              />
              Lab nghiên cứu
            </label>
            <div className="col-span-full flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDeck()}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
              >
                Lưu bộ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeckDraft(emptyDeck())}
                className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
              >
                Bộ trống (thêm mới)
              </button>
              <input
                className="app-input !w-36 !py-1 font-mono text-[10px]"
                placeholder="clone → deck id"
                value={cloneToId}
                disabled={busy}
                onChange={(e) => setCloneToId(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !cloneToId.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      const r = await api<{ ok: true; added: number } & Catalog>(
                        "/api/admin/oracle/clone-deck",
                        {
                          method: "POST",
                          body: JSON.stringify({
                            fromId:
                              deckFilter !== "all" ? deckFilter : "tarot",
                            toId: cloneToId.trim().toLowerCase(),
                          }),
                        },
                      );
                      setData({
                        decks: r.decks ?? [],
                        cards: r.cards ?? [],
                        counts: r.counts,
                        updatedAt: r.updatedAt,
                      });
                      onMsg(`Đã clone +${r.added} lá → ${cloneToId}`);
                    } catch (e) {
                      onMsg(e instanceof Error ? e.message : "Lỗi clone");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                className="rounded-full bg-amber-900/90 px-3 py-1.5 text-[10px] font-bold text-amber-50 disabled:opacity-45"
              >
                Clone 78 keys
              </button>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10 sm:grid-cols-2">
            <p className="play-heading col-span-full text-xs">
              Lá bài (sửa / bổ sung)
            </p>
            <label className="text-[10px] text-[var(--play-muted)]">
              Key
              <input
                className="app-input mt-0.5 w-full !py-1 font-mono text-[11px]"
                value={draft.key}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, key: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Bộ
              <select
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={draft.deckId}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    deckId: e.target.value,
                  }))
                }
              >
                {(data?.decks ?? [{ id: "tarot", nameVi: "Tarot" }]).map(
                  (d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameVi} ({d.id})
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Loại / suit
              <input
                list="oracle-suit-list"
                className="app-input mt-0.5 w-full !py-1 font-mono text-[11px]"
                value={draft.suit ?? ""}
                disabled={busy}
                placeholder="major | wands | custom_suit"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    suit: e.target.value.trim() || undefined,
                  }))
                }
              />
              <datalist id="oracle-suit-list">
                {knownSuits.map((s) => (
                  <option key={s} value={s}>
                    {ORACLE_SUIT_LABEL[s] ?? s}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Số / sort
              <div className="mt-0.5 flex gap-1">
                <input
                  type="number"
                  className="app-input w-1/2 !py-1 text-[11px]"
                  value={draft.number}
                  disabled={busy}
                  title="number"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      number: Number(e.target.value) || 0,
                    }))
                  }
                />
                <input
                  type="number"
                  className="app-input w-1/2 !py-1 text-[11px]"
                  value={draft.sort}
                  disabled={busy}
                  title="sort"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      sort: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Tên EN
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={draft.name}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Tên VI
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={draft.nameVi}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, nameVi: e.target.value }))
                }
              />
            </label>
            <label className="col-span-full text-[10px] text-[var(--play-muted)]">
              Nghĩa xuôi
              <textarea
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                rows={2}
                value={draft.upright}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, upright: e.target.value }))
                }
              />
            </label>
            <label className="col-span-full text-[10px] text-[var(--play-muted)]">
              Nghĩa ngược
              <textarea
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                rows={2}
                value={draft.reversed}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, reversed: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Ảnh URL / emoji
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={draft.image}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, image: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Keywords (phẩy)
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={
                  Array.isArray(draft.keywords)
                    ? draft.keywords.join(", ")
                    : String(draft.keywords ?? "")
                }
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    keywords: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
            <label className="text-[10px] text-[var(--play-muted)]">
              Tags nghiên cứu (phẩy)
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={(draft.tags ?? []).join(", ")}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    tags: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={!!draft.draft}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, draft: e.target.checked }))
                }
              />
              Draft (ẩn draw public)
            </label>
            <label className="col-span-full text-[10px] text-[var(--play-muted)]">
              Notes Lab
              <textarea
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                rows={2}
                value={draft.notes ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </label>
            <label className="col-span-full text-[10px] text-[var(--play-muted)]">
              Citations / nguồn
              <input
                className="app-input mt-0.5 w-full !py-1 text-[11px]"
                value={draft.citations ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, citations: e.target.value }))
                }
              />
            </label>
            <div className="col-span-full flex flex-wrap items-end gap-1.5">
              <label className="min-w-[12rem] flex-1 text-[10px] text-[var(--play-muted)]">
                Batch tag bộ đang lọc
                <input
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={batchTags}
                  disabled={busy}
                  placeholder="qabalah, alchemy…"
                  onChange={(e) => setBatchTags(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || !batchTags.trim() || deckFilter === "all"}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      const r = await api<
                        { ok: true; updated: number } & Catalog
                      >("/api/admin/oracle/batch-tag", {
                        method: "POST",
                        body: JSON.stringify({
                          tags: batchTags,
                          deckId: deckFilter,
                          mode: "add",
                        }),
                      });
                      setData({
                        decks: r.decks ?? [],
                        cards: r.cards ?? [],
                        counts: r.counts,
                        updatedAt: r.updatedAt,
                      });
                      onMsg(`Đã gắn tag · ${r.updated} lá`);
                    } catch (e) {
                      onMsg(e instanceof Error ? e.message : "Lỗi batch tag");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
              >
                Gắn tag bộ
              </button>
            </div>
            <div className="col-span-full flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveCard()}
                className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
              >
                Lưu lá
              </button>
              <button
                type="button"
                disabled={busy || !draft.key.trim()}
                onClick={() => setUploadOpen(true)}
                className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
              >
                Upload ảnh lá
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setDraft(
                    emptyDraft(
                      deckFilter === "all" ? "tarot" : deckFilter,
                    ),
                  )
                }
                className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
              >
                Form trống
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "application/json,.json";
                  input.onchange = () => {
                    const f = input.files?.[0];
                    if (!f) return;
                    void f.text().then(async (text) => {
                      try {
                        const parsed = JSON.parse(text) as unknown;
                        const cards = Array.isArray(parsed)
                          ? parsed
                          : (parsed as { cards?: unknown }).cards;
                        setBusy(true);
                        const r = await api<{
                          ok: true;
                          upserted: number;
                          failed: number;
                        }>("/api/admin/oracle/batch", {
                          method: "POST",
                          body: JSON.stringify({ cards }),
                        });
                        onMsg(`Batch: +${r.upserted} · lỗi ${r.failed}`);
                        await load();
                      } catch (e) {
                        onMsg(
                          e instanceof Error ? e.message : "Batch import lỗi",
                        );
                      } finally {
                        setBusy(false);
                      }
                    });
                  };
                  input.click();
                }}
                className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
              >
                Import JSON batch
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-[var(--play-muted)]">
          Xem catalog · cần role P+M / mainadmin để sửa bộ & lá.
        </p>
      )}

      <ul className="max-h-96 space-y-1.5 overflow-y-auto">
        {rows.map((c) => (
          <li
            key={`${c.deckId}:${c.key}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => {
                setDraft({ ...c });
                setDeckFilter(c.deckId);
              }}
              title="Đưa vào form sửa"
            >
              <span className="flex h-10 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--cream)] ring-1 ring-[var(--wood-deep)]/10">
                {c.image?.startsWith("/") || c.image?.startsWith("http") ? (
                  <img
                    src={c.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm">{c.image || "🃏"}</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="font-bold text-[var(--play-ink)]">
                  {c.nameVi}
                </span>
                <span className="ml-1 text-[var(--play-muted)]">
                  · {c.name}
                </span>
                <p className="font-mono text-[9px] text-[var(--play-muted)]">
                  {c.deckId}/{c.key}
                  {c.suit ? ` · ${ORACLE_SUIT_LABEL[c.suit] ?? c.suit}` : ""}
                  {!c.enabled ? " · OFF" : ""}
                </p>
              </span>
            </button>
            {edit ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggle(c)}
                className="rounded-full bg-white px-2 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
              >
                {c.enabled ? "Tắt" : "Bật"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <ImageUploadPopup
        open={uploadOpen}
        kind="oracle"
        itemKey={draft.key || "card"}
        onClose={() => setUploadOpen(false)}
        onUploaded={(url) => {
          setDraft((d) => ({ ...d, image: url }));
          setUploadOpen(false);
          onMsg("Đã gắn URL ảnh — nhớ bấm Lưu lá");
        }}
      />
    </section>
  );
}
