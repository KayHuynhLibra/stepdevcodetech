import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  api,
  getStoredUser,
  hasCapability,
  isMainAdmin,
  type AuthUser,
} from "../auth";
import { ensureGuestCode, getGuestCode } from "../guest";
import { AppShell } from "../components/AppShell";
import { GameChrome } from "../components/GameChrome";
import {
  ORACLE_SUIT_LABEL,
  ORACLE_TRADITION_LABEL,
  type DrawnOracleCard,
  type OracleDeckId,
  type OracleDeckMeta,
  type OracleCard,
  type OracleDrawHistoryRow,
  type OracleTradition,
  isOracleEmoji,
} from "../oracle";
import { QUESTION_PRESETS, type DeckPool } from "../oracleDeck";
import { useApplyPlayMediaPresets } from "../hooks/useApplyPlayMediaPresets";
import {
  resolveCardBackUrl,
  useBoiCosmetics,
} from "../hooks/useBoiCosmetics";
import {
  BoiRitualOverlay,
  type RitualDealtPayload,
} from "../components/BoiRitualOverlay";
import { BoiJournalPanel } from "../components/BoiJournalPanel";
import { BoiReadingDesk } from "../components/BoiReadingDesk";
import {
  listGuestJournal,
  saveGuestJournal,
  updateGuestJournal,
} from "../boiJournal";
import { ORACLE_DISCLAIMER, pickMantra } from "../oracleMantras";
import { PlayPrefsSheet } from "../components/PlayPrefsSheet";
import { useSfx } from "../hooks/useSfx";

type PageMode = "draw" | "journal" | "lab";

function CardFace({
  image,
  className = "",
}: {
  image: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-[var(--cream)] ${className}`}
    >
      {isOracleEmoji(image) ? (
        <span className="text-2xl">{image || "🃏"}</span>
      ) : (
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = "0.25";
          }}
        />
      )}
    </div>
  );
}

export default function BoiBaiPage() {
  useApplyPlayMediaPresets("boi");
  const { muted: sfxMuted, toggleMute } = useSfx("tarot", "boi");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const cosmetics = useBoiCosmetics();
  const cardBackUrl = resolveCardBackUrl(cosmetics);
  const [me] = useState<AuthUser | null>(() => getStoredUser());
  const canLabStaff =
    !!me && (isMainAdmin(me) || hasCapability(me, "oracle_manage"));
  const [decks, setDecks] = useState<OracleDeckMeta[]>([]);
  const [cards, setCards] = useState<OracleCard[]>([]);
  const [deckId, setDeckId] = useState<OracleDeckId>("tarot");
  const [drawn, setDrawn] = useState<DrawnOracleCard[] | null>(null);
  const [lastReading, setLastReading] = useState<OracleDrawHistoryRow | null>(
    null,
  );
  const [pileLeft, setPileLeft] = useState<number | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [history, setHistory] = useState<OracleDrawHistoryRow[]>([]);
  const [guestJournal, setGuestJournal] = useState<OracleDrawHistoryRow[]>(() =>
    listGuestJournal(15),
  );
  const [journalOpen, setJournalOpen] = useState<OracleDrawHistoryRow | null>(
    null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<PageMode>("draw");
  const [question, setQuestion] = useState("");
  const [deckPool, setDeckPool] = useState<"full" | "major" | "minor">("full");
  const [hubSeed] = useState(() => Date.now());
  const [labQ, setLabQ] = useState("");
  const [labSuit, setLabSuit] = useState<string>("all");
  const [traditionFilter, setTraditionFilter] = useState<
    OracleTradition | "all"
  >("all");
  const [browseKey, setBrowseKey] = useState<string | null>(null);
  const [compareKeys, setCompareKeys] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [galleryOpen, setGalleryOpen] = useState(true);

  const loadCatalog = async (lab: boolean) => {
    const q = lab && canLabStaff ? "?lab=1" : "";
    const r = await api<{
      ok: true;
      decks: OracleDeckMeta[];
      cards: OracleCard[];
    }>(`/api/oracle/catalog${q}`);
    setDecks(r.decks ?? []);
    setCards(r.cards ?? []);
    if (r.decks?.[0]?.id) {
      setDeckId((cur) =>
        r.decks.some((d) => d.id === cur) ? cur : r.decks[0]!.id,
      );
    }
  };

  const loadHistory = async () => {
    if (!me) {
      setGuestJournal(listGuestJournal(15));
      return;
    }
    try {
      const r = await api<{ ok: true; rows: OracleDrawHistoryRow[] }>(
        "/api/oracle/history?limit=30",
      );
      setHistory(r.rows ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadCatalog(mode === "lab");
        await loadHistory();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Không tải được bộ bài");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, canLabStaff]);

  const activeDeck = decks.find((d) => d.id === deckId);
  const deckCards = useMemo(
    () => cards.filter((c) => c.deckId === deckId),
    [cards, deckId],
  );

  const journalRows = me ? history : guestJournal;

  const labCards = useMemo(() => {
    let list = deckCards;
    if (traditionFilter !== "all") {
      const ok = new Set(
        decks
          .filter((d) => (d.tradition ?? "custom") === traditionFilter)
          .map((d) => d.id),
      );
      list = cards.filter((c) => ok.has(c.deckId));
    }
    if (labSuit !== "all") {
      list = list.filter((c) => (c.suit ?? "") === labSuit);
    }
    const needle = labQ.trim().toLowerCase();
    if (needle) {
      list = list.filter((c) =>
        `${c.key} ${c.name} ${c.nameVi} ${(c.keywords ?? []).join(" ")} ${(c.tags ?? []).join(" ")} ${c.notes ?? ""} ${c.citations ?? ""}`
          .toLowerCase()
          .includes(needle),
      );
    }
    return list;
  }, [cards, deckCards, decks, labQ, labSuit, traditionFilter]);

  const browse =
    browseKey != null
      ? (labCards.find((c) => c.key === browseKey) ??
        deckCards.find((c) => c.key === browseKey) ??
        null)
      : null;

  const compareCards = [
    compareKeys[0]
      ? cards.find((c) => c.key === compareKeys[0] && c.deckId === deckId) ||
        cards.find((c) => c.key === compareKeys[0]) ||
        null
      : null,
    compareKeys[1]
      ? cards.find((c) => c.key === compareKeys[1] && c.deckId === deckId) ||
        cards.find((c) => c.key === compareKeys[1]) ||
        null
      : null,
  ] as [OracleCard | null, OracleCard | null];

  const onRitualDealt = (payload: RitualDealtPayload) => {
    setDrawn(payload.cards);
    setPileLeft(payload.remaining);
    setLastReading(payload.reading);
  };

  const saveReading = async (
    row: OracleDrawHistoryRow,
  ): Promise<OracleDrawHistoryRow> => {
    if (!me) {
      saveGuestJournal(row);
      setGuestJournal(listGuestJournal(15));
      setLastReading(row);
      return row;
    }
    try {
      const r = await api<{
        ok: true;
        drawId: string;
        at: number;
        id?: string;
      }>("/api/oracle/record", {
        method: "POST",
        body: JSON.stringify({
          deckId: row.deckId,
          cards: row.cards,
          spread: row.spread,
          question: row.question,
          notes: row.notes,
          title: row.title,
          mantraClose: row.mantraClose,
        }),
      });
      const savedRow: OracleDrawHistoryRow = {
        ...row,
        id: r.drawId ?? row.id,
        at: r.at ?? row.at,
      };
      setLastReading(savedRow);
      await loadHistory();
      return savedRow;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Không lưu được sổ");
      return row;
    }
  };

  const patchNotes = async (id: string, notes: string) => {
    if (!me) {
      const updated = updateGuestJournal(id, { notes });
      if (updated) {
        setGuestJournal(listGuestJournal(15));
        setLastReading((r) => (r?.id === id ? { ...r, notes } : r));
        setJournalOpen((r) => (r?.id === id ? { ...r, notes } : r));
      }
      return;
    }
    try {
      await api(`/api/oracle/history/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      await loadHistory();
      setLastReading((r) => (r?.id === id ? { ...r, notes } : r));
      setJournalOpen((r) => (r?.id === id ? { ...r, notes } : r));
    } catch {
      /* ignore */
    }
  };

  const startRitual = () => {
    if (!deckCards.length) return;
    setDrawn(null);
    setPileLeft(null);
    setLastReading(null);
    setRitualOpen(true);
  };

  const guestCode = !me ? getGuestCode() || ensureGuestCode() : null;
  const suitsInDeck = useMemo(() => {
    const s = new Set<string>();
    for (const c of deckCards) if (c.suit) s.add(c.suit);
    return [...s];
  }, [deckCards]);

  const pickCompare = (key: string) => {
    setCompareKeys(([a, b]) => {
      if (a === key) return [null, b];
      if (b === key) return [a, null];
      if (!a) return [key, b];
      if (!b) return [a, key];
      return [key, b];
    });
  };

  const hubMantra = pickMantra("hub", hubSeed);

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-3 pb-10 pt-3">
        <GameChrome
          title="Bói bài"
          active="boi"
          user={me}
          guestCode={guestCode}
          tools={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold ring-1 ${
                  sfxMuted
                    ? "bg-white/40 text-[var(--play-muted)] ring-[var(--wood-deep)]/15 line-through"
                    : "bg-white/70 text-[var(--wood-deep)] ring-[var(--wood-deep)]/20"
                }`}
              >
                {sfxMuted ? "Tắt" : "Âm"}
              </button>
              <button
                type="button"
                onClick={() => setPrefsOpen(true)}
                className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
              >
                Cài
              </button>
            </div>
          }
        />
        <div className="boi-tabs mb-3 flex gap-1.5">
          {(
            [
              ["draw", "Rút bài"],
              ["journal", "Sổ kết quả"],
              ["lab", "Lab"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex-1 rounded-full py-2 text-[12px] font-bold ${
                mode === id
                  ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                  : "bg-white ring-1 ring-[var(--wood-deep)]/12"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "draw" ? (
          <section
            className={`boi-hub boi-fx--${cosmetics.reduceFx ? "off" : cosmetics.bgFx} boi-back--${cosmetics.cardBackMode}`}
            style={
              {
                ...(cosmetics.bgUrl
                  ? { ["--boi-bg" as string]: `url(${cosmetics.bgUrl})` }
                  : {}),
                ...(cardBackUrl
                  ? { ["--boi-card-back" as string]: `url(${cardBackUrl})` }
                  : {}),
              } as CSSProperties
            }
          >
            <div className="boi-hub__hero">
              <div className="boi-hub__glow" aria-hidden />
              <div className="boi-hub__fx" aria-hidden />
              <p className="boi-hub__brand">
                {activeDeck?.nameVi ?? "Bói bài"}
              </p>
              <p className="boi-hub__mantra">{hubMantra}</p>
              <p className="boi-hub__sub">
                {deckCards.length} lá · xào cả bộ · rút từ đỉnh · trải đúng vị trí
                {pileLeft != null ? ` · lần trước còn ${pileLeft}` : ""}
              </p>
            </div>

            <div className="boi-hub__decks" role="list">
              {decks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="listitem"
                  onClick={() => {
                    setDeckId(d.id);
                    setDrawn(null);
                    setBrowseKey(null);
                  }}
                  className={`boi-hub__deck ${deckId === d.id ? "on" : ""}`}
                >
                  <span className="boi-hub__sigil" aria-hidden>
                    ✦
                  </span>
                  <span className="boi-hub__deck-name">{d.nameVi}</span>
                  <span className="boi-hub__deck-meta">
                    {d.tradition
                      ? ORACLE_TRADITION_LABEL[d.tradition] ?? d.tradition
                      : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="boi-hub__pools" role="group" aria-label="Cấu hình bộ">
              {(
                [
                  ["full", "Full 78"],
                  ["major", "Major 22"],
                  ["minor", "Minor 56"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`boi-hub__pool ${deckPool === id ? "on" : ""}`}
                  onClick={() => setDeckPool(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="boi-hub__intent">
              <span>Câu hỏi / ý nguyện</span>
              <div className="boi-hub__presets">
                {QUESTION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="boi-hub__preset"
                    onClick={() => setQuestion(p.text.slice(0, 120))}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                className="app-input w-full !py-2.5 text-[13px]"
                maxLength={120}
                placeholder="Vd: Tôi nên giữ hay buông mối quan hệ này?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>

            <button
              type="button"
              disabled={deckCards.length === 0}
              onClick={startRitual}
              className="boi-hub__cta"
            >
              Mở nghi thức
            </button>
            <p className="boi-hub__disc">{ORACLE_DISCLAIMER}</p>
            {msg ? (
              <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-800">
                {msg}
              </p>
            ) : null}

            {lastReading && !ritualOpen ? (
              <div className="boi-hub__last">
                <BoiReadingDesk
                  row={lastReading}
                  deckName={
                    decks.find((d) => d.id === lastReading.deckId)?.nameVi
                  }
                  mode={
                    journalRows.some((r) => r.id === lastReading.id)
                      ? "journal"
                      : "live"
                  }
                  saved={journalRows.some((r) => r.id === lastReading.id)}
                  onSave={
                    journalRows.some((r) => r.id === lastReading.id)
                      ? undefined
                      : async () => {
                          await saveReading(lastReading);
                        }
                  }
                  onNotesChange={(notes) =>
                    void patchNotes(lastReading.id, notes)
                  }
                />
              </div>
            ) : drawn && drawn.length > 0 && !ritualOpen && !lastReading ? (
              <div className="mt-4 space-y-2">
                <p className="play-heading text-sm">Kết quả gần nhất</p>
                {drawn.map((c) => (
                  <article
                    key={`${c.key}-${c.position ?? ""}`}
                    className="app-panel space-y-1 p-3"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
                      {c.position ?? "Lá"} ·{" "}
                      {c.reversedDraw ? "Ngược" : "Xuôi"}
                    </p>
                    <p className="font-bold">{c.nameVi}</p>
                    <p className="text-[12px] leading-relaxed">{c.meaning}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {mode === "journal" ? (
          <section className="app-panel space-y-3 p-3">
            <p className="play-heading text-sm">Sổ kết quả</p>
            <BoiJournalPanel
              rows={journalRows}
              decks={decks}
              guestHint={!me}
              onOpen={(row) => setJournalOpen(row)}
            />
            {journalOpen ? (
              <BoiReadingDesk
                row={journalOpen}
                deckName={
                  decks.find((d) => d.id === journalOpen.deckId)?.nameVi
                }
                mode="journal"
                onClose={() => setJournalOpen(null)}
                onNotesChange={(notes) =>
                  void patchNotes(journalOpen.id, notes)
                }
              />
            ) : null}
          </section>
        ) : null}

        {mode === "lab" ? (
          <>
            <section className="app-panel space-y-3 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
                Chọn bộ / lọc Lab
              </p>
              <div className="flex flex-wrap gap-1.5">
                {decks.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDeckId(d.id);
                      setBrowseKey(null);
                      setCompareKeys([null, null]);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                      deckId === d.id
                        ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                        : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/12"
                    }`}
                  >
                    {d.nameVi}
                  </button>
                ))}
              </div>
              <input
                className="app-input w-full !py-2 text-[12px]"
                placeholder="Tìm tên, keyword, tag, notes…"
                value={labQ}
                onChange={(e) => setLabQ(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                <select
                  className="app-input !w-auto !py-1.5 text-[11px]"
                  value={traditionFilter}
                  onChange={(e) =>
                    setTraditionFilter(
                      e.target.value as OracleTradition | "all",
                    )
                  }
                >
                  <option value="all">Tradition: bộ đang chọn</option>
                  <option value="rider-waite">Rider–Waite</option>
                  <option value="marseille">Marseille</option>
                  <option value="thoth">Thoth</option>
                  <option value="custom">Custom</option>
                  <option value="zodiac">Chiêm tinh</option>
                </select>
                <select
                  className="app-input !w-auto !py-1.5 text-[11px]"
                  value={labSuit}
                  onChange={(e) => setLabSuit(e.target.value)}
                >
                  <option value="all">Mọi suit</option>
                  {suitsInDeck.map((s) => (
                    <option key={s} value={s}>
                      {ORACLE_SUIT_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setGalleryOpen((v) => !v)}
                  className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/12"
                >
                  {galleryOpen ? "Ẩn lưới" : "Hiện lưới"}
                </button>
              </div>
              <p className="text-[10px] text-[var(--play-muted)]">
                {labCards.length} lá · chạm để xem · chạm 2 lá để so sánh
              </p>
            </section>

            <section className="app-panel mt-4 space-y-3 p-3">
              <p className="play-heading text-sm">Thư viện Lab</p>
              {galleryOpen ? (
                <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
                  {labCards.map((c) => {
                    const on =
                      browseKey === c.key ||
                      compareKeys[0] === c.key ||
                      compareKeys[1] === c.key;
                    return (
                      <button
                        key={`${c.deckId}-${c.key}`}
                        type="button"
                        onClick={() => {
                          setBrowseKey(c.key);
                          pickCompare(c.key);
                        }}
                        className={`overflow-hidden rounded-lg bg-white ring-1 ${
                          on
                            ? "ring-[var(--amber)]"
                            : "ring-[var(--wood-deep)]/10"
                        }`}
                      >
                        <CardFace
                          image={c.image}
                          className="aspect-[5/7] w-full"
                        />
                        <p className="truncate px-0.5 py-0.5 text-center text-[8px] font-semibold">
                          {c.nameVi}
                          {c.draft ? " ·D" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {browse ? (
                <div className="rounded-lg bg-white/80 p-2.5 text-[12px] ring-1 ring-[var(--wood-deep)]/10">
                  <div className="flex gap-2">
                    <CardFace
                      image={browse.image}
                      className="h-28 w-20 shrink-0 rounded-lg ring-1 ring-[var(--wood-deep)]/12"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-bold">{browse.nameVi}</p>
                      <p className="text-[10px] text-[var(--play-muted)]">
                        {browse.name}
                        {browse.suit
                          ? ` · ${ORACLE_SUIT_LABEL[browse.suit] ?? browse.suit}`
                          : ""}
                      </p>
                      <p>
                        <span className="font-semibold">Xuôi: </span>
                        {browse.upright}
                      </p>
                      <p>
                        <span className="font-semibold">Ngược: </span>
                        {browse.reversed}
                      </p>
                      {browse.notes ? (
                        <p className="rounded-md bg-amber-50/80 p-1.5 text-[11px]">
                          <span className="font-semibold">Notes: </span>
                          {browse.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {(compareCards[0] || compareCards[1]) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <p className="play-heading col-span-full text-xs">
                    So sánh 2 lá
                  </p>
                  {([0, 1] as const).map((i) => {
                    const c = compareCards[i];
                    return (
                      <div
                        key={i}
                        className="rounded-lg bg-white/80 p-2 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                      >
                        {c ? (
                          <>
                            <CardFace
                              image={c.image}
                              className="mb-1 aspect-[5/7] max-h-28 w-full rounded-md"
                            />
                            <p className="font-bold">{c.nameVi}</p>
                            <p className="mt-1 line-clamp-4">{c.upright}</p>
                          </>
                        ) : (
                          <p className="text-[var(--play-muted)]">
                            Chọn lá {i + 1}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      <BoiRitualOverlay
        open={ritualOpen}
        deck={activeDeck ?? null}
        catalog={deckCards}
        question={question}
        deckPool={deckPool as DeckPool}
        flipStyle={
          cosmetics.flipFx === "off" ? "olympus" : cosmetics.flipFx
        }
        flipFxOff={cosmetics.flipFx === "off" || cosmetics.reduceFx}
        cardBackMode={cosmetics.cardBackMode}
        cardBackUrl={cardBackUrl}
        bgUrl={cosmetics.bgUrl || null}
        bgFx={cosmetics.reduceFx ? "off" : cosmetics.bgFx}
        onClose={() => setRitualOpen(false)}
        onDealt={onRitualDealt}
        onSaveReading={(row) => saveReading(row)}
        onNotesChange={(id, notes) => patchNotes(id, notes)}
      />

      <PlayPrefsSheet
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
      />
    </AppShell>
  );
}
