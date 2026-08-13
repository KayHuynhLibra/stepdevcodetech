import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  api,
  getStoredUser,
  type AuthUser,
} from "../auth";
import { ensureGuestCode, getGuestCode } from "../guest";
import { AppShell } from "../components/AppShell";
import { GameChrome } from "../components/GameChrome";
import {
  ORACLE_TRADITION_LABEL,
  type DrawnOracleCard,
  type OracleDeckId,
  type OracleDeckMeta,
  type OracleCard,
  type OracleDrawHistoryRow,
  type OracleSpread,
  type OracleTimingHint,
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
import { theoryForAudience } from "../oracleTheory";
import { PlayPrefsSheet } from "../components/PlayPrefsSheet";
import { VirtualPlayFooter } from "../components/VirtualPlayFooter";
import { useSfx } from "../hooks/useSfx";
import "../platform/boi/boi-mystic.css";

type PageMode = "draw" | "journal" | "guide";

export default function BoiBaiPage() {
  useApplyPlayMediaPresets("boi");
  const { muted: sfxMuted, toggleMute } = useSfx("tarot", "boi");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const cosmetics = useBoiCosmetics();
  const cardBackUrl = resolveCardBackUrl(cosmetics);
  const [me] = useState<AuthUser | null>(() => getStoredUser());
  const [decks, setDecks] = useState<OracleDeckMeta[]>([]);
  const [cards, setCards] = useState<OracleCard[]>([]);
  const [spreads, setSpreads] = useState<OracleSpread[]>([]);
  const [timingRules, setTimingRules] = useState<OracleTimingHint[]>([]);
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
  
  const loadCatalog = async () => {
    const r = await api<{
      ok: true;
      decks: OracleDeckMeta[];
      cards: OracleCard[];
      spreads: OracleSpread[];
      timingRules: OracleTimingHint[];
    }>("/api/oracle/catalog");
    setDecks(r.decks ?? []);
    setCards(r.cards ?? []);
    setSpreads(r.spreads ?? []);
    setTimingRules(r.timingRules ?? []);
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
        await loadCatalog();
        await loadHistory();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Không tải được bộ bài");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDeck = decks.find((d) => d.id === deckId);
  const deckCards = useMemo(
    () => cards.filter((c) => c.deckId === deckId),
    [cards, deckId],
  );

  const journalRows = me ? history : guestJournal;
  const supportsPoolSplit = !["lenormand", "tea", "zodiac"].includes(deckId);
  const guideSections = theoryForAudience("player");

  useEffect(() => {
    if (!supportsPoolSplit && deckPool !== "full") {
      setDeckPool("full");
    }
  }, [deckPool, supportsPoolSplit]);

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
          timingHint: row.timingHint,
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
  const hubMantra = pickMantra("hub", hubSeed);

  return (
    <AppShell>
      <div className="boi-mystic">
        <div className="boi-mystic__veil" aria-hidden />
        <div className="boi-mystic__stars" aria-hidden />
        <div className="boi-mystic__content mx-auto max-w-lg px-3 pb-10 pt-3">
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
                className={`boi-chrome-btn px-2 py-1 text-[10px] ${
                  sfxMuted ? "is-muted" : ""
                }`}
              >
                {sfxMuted ? "Tắt" : "Âm"}
              </button>
              <button
                type="button"
                onClick={() => setPrefsOpen(true)}
                className="boi-chrome-btn px-2 py-1 text-[10px]"
              >
                Cài
              </button>
            </div>
          }
        />
        <div className="boi-tabs mb-3 flex flex-wrap gap-1.5">
          {(
            [
              ["draw", "Rút bài"],
              ["journal", "Sổ"],
              ["guide", "Hướng dẫn"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              data-on={mode === id ? "1" : "0"}
              className={`min-w-[22%] flex-1 py-2 text-[12px] font-bold ${
                mode === id ? "boi-tab--on" : ""
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
              <div className="boi-hub__orb" aria-hidden />
              <p className="boi-hub__eyebrow">SOFIA · ORACLE</p>
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
                supportsPoolSplit
                  ? ([
                      ["full", "Full 78"],
                      ["major", "Major 22"],
                      ["minor", "Minor 56"],
                    ] as const)
                  : ([["full", "Full 78"]] as const)
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
            {msg ? <p className="boi-msg">{msg}</p> : null}

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
                  showDeep={false}
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
              spreads={spreads}
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
                showDeep={false}
                onClose={() => setJournalOpen(null)}
                onNotesChange={(notes) =>
                  void patchNotes(journalOpen.id, notes)
                }
              />
            ) : null}
          </section>
        ) : null}

        {mode === "guide" ? (
          <section className="app-panel space-y-3 p-3">
            <header className="space-y-1">
              <p className="play-heading text-sm">Hướng dẫn Bói bài</p>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--boi-muted)" }}
              >
                Nội dung dành cho người chơi: khung đọc, chọn kiểu trải, xuôi
                ngược và gợi ý giải trí về thời gian.
              </p>
            </header>
            <div className="space-y-2.5">
              {guideSections.map((sec) => (
                <article key={sec.id} className="boi-theory-card">
                  <h3>{sec.title}</h3>
                  <p>{sec.lead}</p>
                  <ul>
                    {sec.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p
              className="text-[10px] leading-relaxed"
              style={{ color: "var(--boi-muted)" }}
            >
              {ORACLE_DISCLAIMER}
            </p>
          </section>
        ) : null}
        <VirtualPlayFooter className="mt-4" />
        </div>

      <BoiRitualOverlay
        open={ritualOpen}
        deck={activeDeck ?? null}
        catalog={deckCards}
        question={question}
        deckPool={deckPool as DeckPool}
        spreads={spreads}
        timingRules={timingRules}
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
      </div>
    </AppShell>
  );
}
