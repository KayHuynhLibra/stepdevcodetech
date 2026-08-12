import { useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import {
  ORACLE_SUIT_LABEL,
  ORACLE_SUIT_PRESETS,
  ORACLE_TRADITION_LABEL,
  ORACLE_TRADITION_PRESETS,
  type OracleCard,
  type OracleCardDomains,
  type OracleDeckId,
  type OracleDeckMeta,
  type OracleLibraryDoc,
  type OracleSpread,
  type OracleTimingHint,
  type OracleTradition,
} from "../oracle";
import { theoryForAudience } from "../oracleTheory";
import { ImageUploadPopup } from "./ImageUploadPopup";

type Catalog = {
  decks: OracleDeckMeta[];
  cards: OracleCard[];
  spreads?: OracleSpread[];
  timingRules?: OracleTimingHint[];
  library?: OracleLibraryDoc[];
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

type PanelTab = "cards" | "spreads" | "timing" | "library" | "lab";

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: "cards", label: "Lá & bộ" },
  { id: "spreads", label: "Spreads" },
  { id: "timing", label: "Timing" },
  { id: "library", label: "Library" },
  { id: "lab", label: "Lab" },
];

const CARD_DOMAIN_LABEL: Record<keyof OracleCardDomains, string> = {
  love: "Tình cảm",
  work: "Công việc",
  money: "Tiền bạc",
  health: "Sức khỏe",
};

const splitLooseList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

const normalizeSpreadPositions = (
  cardCount: number,
  positions: string[],
): string[] => {
  const count = Math.max(1, Number(cardCount) || 1);
  const next = positions.map((x) => x.trim()).filter(Boolean);
  while (next.length < count) next.push(`Vị trí ${next.length + 1}`);
  return next.slice(0, count);
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
  image: "/assets/oracle/tarot/fool.jpg",
  enabled: true,
  sort: 0,
  tags: [],
  notes: "",
  citations: "",
  draft: false,
  level: "public",
  sourceDoc: "",
  domains: {},
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

const emptySpread = (): OracleSpread => ({
  id: "",
  nameVi: "",
  blurb: "",
  cardCount: 3,
  positions: ["Quá khứ", "Hiện tại", "Tương lai"],
  enabled: true,
  sort: 100,
  tags: [],
  source: "",
  draft: false,
});

const emptyTimingRule = (): OracleTimingHint => ({
  id: "",
  labelVi: "",
  suit: "",
  number: undefined,
  key: "",
  hint: "",
  sort: 100,
});

const emptyLibraryDoc = (): OracleLibraryDoc => ({
  id: "",
  title: "",
  pages: undefined,
  ingestedAt: Date.now(),
  version: "v1",
  notes: "",
});

export function OracleAdminPanel({
  main,
  canEdit = false,
  onMsg,
  compact = false,
  defaultTab = "cards",
  focusMode = "full",
}: {
  main: boolean;
  /** oracle_manage / cards / library — sửa theo cap (reset seed vẫn chỉ mainadmin) */
  canEdit?: boolean;
  onMsg: (s: string) => void;
  compact?: boolean;
  defaultTab?: PanelTab;
  /**
   * full = mọi tab CMS
   * cards = Lá + Library (tarot78)
   * library = Library + Lab (book78)
   */
  focusMode?: "full" | "cards" | "library";
}) {
  const edit = canEdit || main;
  const [data, setData] = useState<Catalog | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>(defaultTab);
  const [deckFilter, setDeckFilter] = useState<OracleDeckId | "all">("tarot");
  const [traditionFilter, setTraditionFilter] = useState<
    OracleTradition | "all"
  >("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<OracleCard>(() => emptyDraft("tarot"));
  const [deckDraft, setDeckDraft] = useState<OracleDeckMeta>(() => emptyDeck());
  const [spreadDraft, setSpreadDraft] = useState<OracleSpread>(() =>
    emptySpread(),
  );
  const [timingDraft, setTimingDraft] = useState<OracleTimingHint[]>([]);
  const [libraryDraft, setLibraryDraft] = useState<OracleLibraryDoc>(() =>
    emptyLibraryDoc(),
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [batchTags, setBatchTags] = useState("");
  const [cloneToId, setCloneToId] = useState("");

  const applyCatalog = (r: Partial<Catalog>) => {
    const next: Catalog = {
      decks: r.decks ?? data?.decks ?? [],
      cards: r.cards ?? data?.cards ?? [],
      spreads: r.spreads ?? data?.spreads ?? [],
      timingRules: r.timingRules ?? data?.timingRules ?? [],
      library: r.library ?? data?.library ?? [],
      counts: r.counts ?? data?.counts,
      updatedAt: r.updatedAt ?? data?.updatedAt,
    };
    setData(next);
    setTimingDraft(next.timingRules ?? []);
    setDeckFilter((cur) =>
      cur === "all" || next.decks.some((deck) => deck.id === cur)
        ? cur
        : (next.decks[0]?.id ?? "all"),
    );
    setDraft((cur) =>
      next.decks.some((deck) => deck.id === cur.deckId)
        ? cur
        : emptyDraft(next.decks[0]?.id ?? "tarot"),
    );
  };

  const load = async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle");
      applyCatalog(r);
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
    return `${c.key} ${c.name} ${c.nameVi} ${c.suit ?? ""} ${(c.tags ?? []).join(" ")} ${c.notes ?? ""} ${c.sourceDoc ?? ""} ${Object.values(c.domains ?? {}).join(" ")}`
      .toLowerCase()
      .includes(needle);
  });

  const labSections = useMemo(() => theoryForAudience("staff"), []);

  const researchSummary = useMemo(() => {
    const cards = data?.cards ?? [];
    const deep = cards.filter((c) => c.level === "deep").length;
    const withNotes = cards.filter((c) => Boolean(c.notes?.trim())).length;
    const withDomains = cards.filter((c) =>
      Object.values(c.domains ?? {}).some((value) => Boolean(value?.trim())),
    ).length;
    const highlighted = cards.filter(
      (c) =>
        Boolean(c.notes?.trim()) ||
        Object.values(c.domains ?? {}).some((value) => Boolean(value?.trim())),
    );
    return { deep, withNotes, withDomains, highlighted };
  }, [data?.cards]);

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
      applyCatalog(r);
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
    const domains = Object.fromEntries(
      Object.entries(draft.domains ?? {})
        .map(([key, value]) => [key, String(value ?? "").trim()])
        .filter(([, value]) => Boolean(value)),
    ) as OracleCardDomains;
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
            level: draft.level ?? "public",
            sourceDoc: draft.sourceDoc?.trim() ?? "",
            domains,
          },
        }),
      });
      applyCatalog(r);
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
      applyCatalog(r);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi bật/tắt");
    } finally {
      setBusy(false);
    }
  };

  const saveSpread = async () => {
    if (!edit) {
      onMsg("Không đủ quyền sửa spread");
      return;
    }
    if (!spreadDraft.id.trim() || !spreadDraft.nameVi.trim()) {
      onMsg("Cần id + tên VI cho spread");
      return;
    }
    const cardCount = Math.max(1, Number(spreadDraft.cardCount) || 1);
    const spread: OracleSpread = {
      ...spreadDraft,
      id: spreadDraft.id.trim(),
      nameVi: spreadDraft.nameVi.trim(),
      blurb: spreadDraft.blurb.trim(),
      cardCount,
      positions: normalizeSpreadPositions(cardCount, spreadDraft.positions ?? []),
      tags: (spreadDraft.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      source: spreadDraft.source?.trim() || undefined,
      draft: !!spreadDraft.draft,
    };
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle/spread", {
        method: "POST",
        body: JSON.stringify({ spread }),
      });
      applyCatalog(r);
      setSpreadDraft(spread);
      onMsg(`Đã lưu spread «${spread.nameVi}»`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu spread");
    } finally {
      setBusy(false);
    }
  };

  const toggleSpread = async (spread: OracleSpread) => {
    if (!edit) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>(
        "/api/admin/oracle/spread/toggle",
        {
          method: "POST",
          body: JSON.stringify({
            id: spread.id,
            enabled: !spread.enabled,
          }),
        },
      );
      applyCatalog(r);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi bật/tắt spread");
    } finally {
      setBusy(false);
    }
  };

  const saveTiming = async () => {
    if (!edit) {
      onMsg("Không đủ quyền sửa timing");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle/timing", {
        method: "POST",
        body: JSON.stringify({
          rules: timingDraft.map((rule) => ({
            ...rule,
            id: rule.id.trim(),
            labelVi: rule.labelVi.trim(),
            suit: rule.suit?.trim() || undefined,
            number:
              rule.number == null || Number.isNaN(Number(rule.number))
                ? undefined
                : Number(rule.number),
            key: rule.key?.trim() || undefined,
            hint: rule.hint.trim(),
            sort: Number(rule.sort) || 0,
          })),
        }),
      });
      applyCatalog(r);
      onMsg(`Đã lưu ${timingDraft.length} rule timing`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu timing");
    } finally {
      setBusy(false);
    }
  };

  const saveLibraryDoc = async () => {
    if (!edit) {
      onMsg("Không đủ quyền sửa thư viện");
      return;
    }
    if (!libraryDraft.id.trim() || !libraryDraft.title.trim()) {
      onMsg("Cần id + tiêu đề tài liệu");
      return;
    }
    setBusy(true);
    try {
      const doc: OracleLibraryDoc = {
        ...libraryDraft,
        id: libraryDraft.id.trim(),
        title: libraryDraft.title.trim(),
        version: libraryDraft.version.trim() || "v1",
        ingestedAt: libraryDraft.ingestedAt || Date.now(),
        pages:
          libraryDraft.pages == null || libraryDraft.pages <= 0
            ? undefined
            : Number(libraryDraft.pages),
        notes: libraryDraft.notes?.trim() || undefined,
      };
      const r = await api<{ ok: true } & Catalog>("/api/admin/oracle/library", {
        method: "POST",
        body: JSON.stringify({ doc }),
      });
      applyCatalog(r);
      setLibraryDraft(doc);
      onMsg(`Đã lưu tài liệu «${doc.title}»`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu thư viện");
    } finally {
      setBusy(false);
    }
  };

  const resetSeed = async () => {
    if (!main) return;
    if (
      !confirm(
        "Khôi phục full seed RW + Marseille + Thoth (78×3) + Zodiac 12 + Lenormand 36 + Trà? Mọi chỉnh sửa tay sẽ mất.",
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
      applyCatalog(r);
      onMsg(`Đã seed lại ${r.count} lá`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi reset seed");
    } finally {
      setBusy(false);
    }
  };

  const visibleTabs =
    focusMode === "library"
      ? PANEL_TABS.filter((t) => t.id === "library" || t.id === "lab")
      : focusMode === "cards"
        ? PANEL_TABS.filter((t) => t.id === "cards" || t.id === "library")
        : PANEL_TABS;

  const focusTitle =
    focusMode === "library"
      ? "Bói bài — thư viện tài liệu"
      : focusMode === "cards"
        ? "Bói bài — CMS 78 lá"
        : "Bói bài / Lab — bộ & nghiên cứu";
  const focusLead =
    focusMode === "library"
      ? "Library ingest + Lab theory (book78 · mainadmin)."
      : focusMode === "cards"
        ? "Cards/Decks + Library metadata (tarot78 · mainadmin)."
        : "RW · Marseille · Thoth · custom. Tags / notes / draft cho Lab.";

  return (
    <section
      className={`app-panel space-y-3 p-3 sm:p-4 ${compact ? "mt-0" : "mt-4"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">{focusTitle}</p>
          <p className="text-[11px] text-[var(--play-muted)]">
            {focusLead}
            {data?.counts
              ? ` · ${data.counts.total ?? 0} lá · ${data.counts.enabled} bật${
                  data.counts.draft != null ? ` · ${data.counts.draft} draft` : ""
                }`
              : ""}
            {(focusMode === "library" || focusMode === "cards") &&
            (data?.library?.length ?? 0) > 0
              ? ` · ${data!.library!.length} tài liệu`
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

      <div className="flex flex-wrap items-center gap-1.5">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPanelTab(tab.id)}
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              panelTab === tab.id
                ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                : "bg-white ring-1 ring-[var(--wood-deep)]/12"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {data?.updatedAt ? (
          <span className="ml-auto text-[10px] text-[var(--play-muted)]">
            Sync {new Date(data.updatedAt).toLocaleString("vi-VN")}
          </span>
        ) : null}
      </div>

      {panelTab === "cards" ? (
        <>
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
              className="app-input min-w-[10rem] flex-1 !px-2 !py-1 text-[11px]"
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
                  Id slug mới (vd. <code>lenormand</code>,{" "}
                  <code>oracle_extra</code>) → bộ riêng trên bàn Bói. Không
                  đụng paytable Tarot 8 lá cược.
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
                      setDeckDraft((d) => ({
                        ...d,
                        research: e.target.checked,
                      }))
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
                          const r = await api<
                            { ok: true; added: number } & Catalog
                          >("/api/admin/oracle/clone-deck", {
                            method: "POST",
                            body: JSON.stringify({
                              fromId: deckFilter !== "all" ? deckFilter : "tarot",
                              toId: cloneToId.trim().toLowerCase(),
                            }),
                          });
                          applyCatalog(r);
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
                <label className="text-[10px] text-[var(--play-muted)]">
                  Level
                  <select
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={draft.level ?? "public"}
                    disabled={busy}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        level: e.target.value as OracleCard["level"],
                      }))
                    }
                  >
                    <option value="public">public</option>
                    <option value="deep">deep</option>
                  </select>
                </label>
                <label className="text-[10px] text-[var(--play-muted)]">
                  Source doc
                  <input
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={draft.sourceDoc ?? ""}
                    disabled={busy}
                    placeholder="Tarot 78 lá · trang / chương"
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, sourceDoc: e.target.value }))
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
                <div className="col-span-full grid gap-2 sm:grid-cols-2">
                  <p className="play-heading col-span-full text-[10px]">
                    Deep domains
                  </p>
                  {(Object.keys(CARD_DOMAIN_LABEL) as Array<
                    keyof OracleCardDomains
                  >).map((domainKey) => (
                    <label
                      key={domainKey}
                      className="text-[10px] text-[var(--play-muted)]"
                    >
                      {CARD_DOMAIN_LABEL[domainKey]}
                      <textarea
                        className="app-input mt-0.5 w-full !py-1 text-[11px]"
                        rows={2}
                        value={draft.domains?.[domainKey] ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            domains: {
                              ...(d.domains ?? {}),
                              [domainKey]: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
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
                          applyCatalog(r);
                          onMsg(`Đã gắn tag · ${r.updated} lá`);
                        } catch (e) {
                          onMsg(
                            e instanceof Error ? e.message : "Lỗi batch tag",
                          );
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
                        emptyDraft(deckFilter === "all" ? "tarot" : deckFilter),
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
                              e instanceof Error
                                ? e.message
                                : "Batch import lỗi",
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
                    setDraft({
                      ...c,
                      level: c.level ?? "public",
                      sourceDoc: c.sourceDoc ?? "",
                      domains: { ...(c.domains ?? {}) },
                    });
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
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {c.level === "deep" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900 ring-1 ring-amber-300/60">
                          deep
                        </span>
                      ) : null}
                      {c.sourceDoc ? (
                        <span className="max-w-[16rem] truncate rounded-full bg-white px-2 py-0.5 text-[9px] text-[var(--play-muted)] ring-1 ring-[var(--wood-deep)]/10">
                          {c.sourceDoc}
                        </span>
                      ) : null}
                    </div>
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
        </>
      ) : null}

      {panelTab === "spreads" ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="play-heading text-xs">Spread catalog</p>
              {edit ? (
                <button
                  type="button"
                  onClick={() => setSpreadDraft(emptySpread())}
                  className="rounded-full bg-white px-3 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                >
                  Form trống
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-[var(--play-muted)]">
              Quản lý kiểu trải, vị trí lá và nguồn nghiên cứu cho nghi thức
              Bói bài.
            </p>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {(data?.spreads ?? []).map((spread) => (
                <li
                  key={spread.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50/70 px-2 py-1.5 text-[11px] ring-1 ring-amber-200/50"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setSpreadDraft({
                        ...spread,
                        positions: normalizeSpreadPositions(
                          spread.cardCount,
                          spread.positions ?? [],
                        ),
                        tags: [...(spread.tags ?? [])],
                      })
                    }
                  >
                    <p className="font-bold text-[var(--play-ink)]">
                      {spread.nameVi}
                      <span className="ml-1 text-[10px] text-[var(--play-muted)]">
                        ({spread.cardCount} lá)
                      </span>
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {spread.id}
                      {!spread.enabled ? " · OFF" : ""}
                      {spread.draft ? " · draft" : ""}
                      {spread.tags?.length ? ` · ${spread.tags.join(", ")}` : ""}
                    </p>
                  </button>
                  {edit ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleSpread(spread)}
                      className="rounded-full bg-white px-2 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
                    >
                      {spread.enabled ? "Tắt" : "Bật"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {edit ? (
            <div className="grid gap-2 rounded-xl bg-amber-50/80 p-2.5 ring-1 ring-amber-200/60 sm:grid-cols-2">
              <p className="play-heading col-span-full text-xs">
                Spread upsert
              </p>
              <label className="text-[10px] text-[var(--play-muted)]">
                Id
                <input
                  className="app-input mt-0.5 w-full !py-1 font-mono text-[11px]"
                  value={spreadDraft.id}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({ ...cur, id: e.target.value }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Tên VI
                <input
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={spreadDraft.nameVi}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      nameVi: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="col-span-full text-[10px] text-[var(--play-muted)]">
                Blurb
                <textarea
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  rows={2}
                  value={spreadDraft.blurb}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      blurb: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Card count
                <input
                  type="number"
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={spreadDraft.cardCount}
                  disabled={busy}
                  onChange={(e) => {
                    const count = Math.max(1, Number(e.target.value) || 1);
                    setSpreadDraft((cur) => ({
                      ...cur,
                      cardCount: count,
                      positions: normalizeSpreadPositions(
                        count,
                        cur.positions ?? [],
                      ),
                    }));
                  }}
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Sort
                <input
                  type="number"
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={spreadDraft.sort}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      sort: Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label className="col-span-full text-[10px] text-[var(--play-muted)]">
                Positions (mỗi dòng hoặc dấu phẩy)
                <textarea
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  rows={4}
                  value={(spreadDraft.positions ?? []).join("\n")}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      positions: splitLooseList(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Tags (phẩy)
                <input
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={(spreadDraft.tags ?? []).join(", ")}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      tags: splitLooseList(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Source
                <input
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={spreadDraft.source ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      source: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold">
                <input
                  type="checkbox"
                  checked={spreadDraft.enabled}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      enabled: e.target.checked,
                    }))
                  }
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold">
                <input
                  type="checkbox"
                  checked={!!spreadDraft.draft}
                  disabled={busy}
                  onChange={(e) =>
                    setSpreadDraft((cur) => ({
                      ...cur,
                      draft: e.target.checked,
                    }))
                  }
                />
                Draft
              </label>
              <div className="col-span-full flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveSpread()}
                  className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
                >
                  Lưu spread
                </button>
                <span className="text-[10px] text-[var(--play-muted)]">
                  Nếu card count đổi, vị trí sẽ tự pad/truncate theo số lá.
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--play-muted)]">
              Cần quyền sửa để cập nhật spread CMS.
            </p>
          )}
        </div>
      ) : null}

      {panelTab === "timing" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {edit ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setTimingDraft((cur) => [...cur, emptyTimingRule()])
                  }
                  className="rounded-full bg-white px-3 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                >
                  Thêm rule
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveTiming()}
                  className="rounded-full bg-[var(--wood-deep)] px-3 py-1 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
                >
                  Lưu toàn bộ
                </button>
              </>
            ) : null}
            <span className="text-[10px] text-[var(--play-muted)]">
              Timing rules cho suit / number / key và gợi ý giải trí.
            </span>
          </div>

          <div className="space-y-1.5">
            {timingDraft.map((rule, index) => (
              <div
                key={`${rule.id || "new"}-${index}`}
                className="grid gap-2 rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10 sm:grid-cols-2"
              >
                <label className="text-[10px] text-[var(--play-muted)]">
                  Id
                  <input
                    className="app-input mt-0.5 w-full !py-1 font-mono text-[11px]"
                    value={rule.id}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, id: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-[10px] text-[var(--play-muted)]">
                  Label VI
                  <input
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={rule.labelVi}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, labelVi: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-[10px] text-[var(--play-muted)]">
                  Suit
                  <input
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={rule.suit ?? ""}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, suit: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-[10px] text-[var(--play-muted)]">
                  Number
                  <input
                    type="number"
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={rule.number ?? ""}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                number:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-[10px] text-[var(--play-muted)]">
                  Key
                  <input
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={rule.key ?? ""}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, key: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-[10px] text-[var(--play-muted)]">
                  Sort
                  <input
                    type="number"
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    value={rule.sort}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, sort: Number(e.target.value) || 0 }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="col-span-full text-[10px] text-[var(--play-muted)]">
                  Hint
                  <textarea
                    className="app-input mt-0.5 w-full !py-1 text-[11px]"
                    rows={2}
                    value={rule.hint}
                    disabled={busy || !edit}
                    onChange={(e) =>
                      setTimingDraft((cur) =>
                        cur.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, hint: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                {edit ? (
                  <div className="col-span-full flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setTimingDraft((cur) =>
                          cur.filter((_, rowIndex) => rowIndex !== index),
                        )
                      }
                      className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-rose-900 ring-1 ring-rose-300/50 disabled:opacity-45"
                    >
                      Xóa rule
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!timingDraft.length ? (
              <p className="text-[11px] text-[var(--play-muted)]">
                Chưa có timing rule nào trong catalog.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {panelTab === "library" ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
            <p className="play-heading text-xs">Library ingest metadata</p>
            <p className="mt-1 text-[10px] text-[var(--play-muted)]">
              Không host PDF công khai — chỉ metadata ingest.
            </p>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {(data?.library ?? []).map((doc) => (
                <li
                  key={doc.id}
                  className="rounded-lg bg-amber-50/70 px-2 py-1.5 text-[11px] ring-1 ring-amber-200/50"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setLibraryDraft({ ...doc })}
                  >
                    <p className="font-bold text-[var(--play-ink)]">
                      {doc.title}
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {doc.id}
                      {doc.pages ? ` · ${doc.pages} trang` : ""}
                      {doc.version ? ` · ${doc.version}` : ""}
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      Ingest: {new Date(doc.ingestedAt).toLocaleString("vi-VN")}
                    </p>
                    {doc.notes ? (
                      <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                        {doc.notes}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {edit ? (
            <div className="grid gap-2 rounded-xl bg-amber-50/80 p-2.5 ring-1 ring-amber-200/60 sm:grid-cols-2">
              <p className="play-heading col-span-full text-xs">
                Library doc upsert
              </p>
              <label className="text-[10px] text-[var(--play-muted)]">
                Id
                <input
                  className="app-input mt-0.5 w-full !py-1 font-mono text-[11px]"
                  value={libraryDraft.id}
                  disabled={busy}
                  onChange={(e) =>
                    setLibraryDraft((cur) => ({ ...cur, id: e.target.value }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Version
                <input
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={libraryDraft.version}
                  disabled={busy}
                  onChange={(e) =>
                    setLibraryDraft((cur) => ({
                      ...cur,
                      version: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="col-span-full text-[10px] text-[var(--play-muted)]">
                Tiêu đề
                <input
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={libraryDraft.title}
                  disabled={busy}
                  onChange={(e) =>
                    setLibraryDraft((cur) => ({
                      ...cur,
                      title: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                Số trang
                <input
                  type="number"
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={libraryDraft.pages ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setLibraryDraft((cur) => ({
                      ...cur,
                      pages:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-[10px] text-[var(--play-muted)]">
                IngestedAt
                <input
                  type="number"
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  value={libraryDraft.ingestedAt}
                  disabled={busy}
                  onChange={(e) =>
                    setLibraryDraft((cur) => ({
                      ...cur,
                      ingestedAt: Number(e.target.value) || Date.now(),
                    }))
                  }
                />
              </label>
              <label className="col-span-full text-[10px] text-[var(--play-muted)]">
                Notes
                <textarea
                  className="app-input mt-0.5 w-full !py-1 text-[11px]"
                  rows={3}
                  value={libraryDraft.notes ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setLibraryDraft((cur) => ({
                      ...cur,
                      notes: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="col-span-full flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveLibraryDoc()}
                  className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
                >
                  Lưu tài liệu
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setLibraryDraft(emptyLibraryDoc())}
                  className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                >
                  Form trống
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--play-muted)]">
              Cần quyền sửa để cập nhật metadata thư viện.
            </p>
          )}
        </div>
      ) : null}

      {panelTab === "lab" ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-amber-50/80 p-2.5 ring-1 ring-amber-200/60">
            <p className="play-heading text-xs">Lab theory staff</p>
            <p className="mt-1 text-[11px] text-[var(--play-muted)]">
              Public catalog strips notes/domains; Lab uses admin catalog với
              notes, domains, sourceDoc và level sâu.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/12">
                Deep: {researchSummary.deep}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/12">
                Có notes: {researchSummary.withNotes}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/12">
                Có domains: {researchSummary.withDomains}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {labSections.map((section) => (
              <article
                key={section.id}
                className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10"
              >
                <p className="play-heading text-xs">{section.title}</p>
                <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                  {section.lead}
                </p>
                <ul className="mt-2 space-y-1 text-[10px] text-[var(--play-muted)]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {researchSummary.highlighted.length ? (
            <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10">
              <p className="play-heading text-xs">Lá có ghi chú sâu</p>
              <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {researchSummary.highlighted.map((card) => {
                  const activeDomains = Object.entries(card.domains ?? {})
                    .filter(([, value]) => Boolean(value?.trim()))
                    .map(([key]) => CARD_DOMAIN_LABEL[key as keyof OracleCardDomains]);
                  return (
                    <li
                      key={`${card.deckId}:${card.key}`}
                      className="rounded-lg bg-amber-50/70 px-2 py-1.5 text-[11px] ring-1 ring-amber-200/40"
                    >
                      <p className="font-bold text-[var(--play-ink)]">
                        {card.nameVi}
                        <span className="ml-1 text-[10px] text-[var(--play-muted)]">
                          {card.deckId}/{card.key}
                        </span>
                      </p>
                      <p className="text-[10px] text-[var(--play-muted)]">
                        {card.level === "deep" ? "deep" : "public"}
                        {card.sourceDoc ? ` · ${card.sourceDoc}` : ""}
                        {activeDomains.length
                          ? ` · domains: ${activeDomains.join(", ")}`
                          : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

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
