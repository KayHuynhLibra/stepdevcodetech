import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  isOracleEmoji,
  ORACLE_SUIT_LABEL,
  type DrawnOracleCard,
  type OracleCard,
  type OracleDeckMeta,
  type OracleDrawHistoryRow,
} from "../oracle";
import {
  dealFromTop,
  filterDeckPool,
  shuffleFullDeck,
  spreadLayoutClass,
  type DeckPool,
  type PileCard,
  type RitualSpread,
} from "../oracleDeck";
import { pickMantra, spreadMantraHint } from "../oracleMantras";
import { makeReadingTitle } from "../boiJournal";
import { BoiReadingDesk } from "./BoiReadingDesk";
import { useSfx } from "../hooks/useSfx";
import type {
  BoiBgFx,
  BoiCardBackMode,
} from "../hooks/useBoiCosmetics";

export type { RitualSpread, DeckPool };

type RitualPhase = "center" | "shuffle" | "ready" | "reveal" | "reading";

function CardBackFace({
  mode,
  imageUrl,
}: {
  mode: BoiCardBackMode;
  imageUrl: string | null;
}) {
  if ((mode === "image" || mode === "ornate") && imageUrl) {
    return (
      <div
        className={`boi-ritual__card-back boi-ritual__card-back--${mode}`}
      >
        <img src={imageUrl} alt="" draggable={false} />
        {mode === "ornate" ? (
          <span className="boi-ritual__ornate-frame" aria-hidden />
        ) : null}
      </div>
    );
  }
  return (
    <div className="boi-ritual__card-back boi-ritual__card-back--css">
      <span className="boi-ritual__sigil">✦</span>
    </div>
  );
}

function suitFx(suit?: string): string {
  switch (suit) {
    case "major":
      return "boi-fx--major";
    case "wands":
      return "boi-fx--wands";
    case "cups":
      return "boi-fx--cups";
    case "swords":
      return "boi-fx--swords";
    case "pentacles":
      return "boi-fx--pentacles";
    case "zodiac":
      return "boi-fx--zodiac";
    default:
      return "boi-fx--default";
  }
}

function Face({
  image,
  className = "",
}: {
  image: string;
  className?: string;
}) {
  return (
    <div className={`boi-ritual-face ${className}`}>
      {isOracleEmoji(image) ? (
        <span className="boi-ritual-emoji">{image || "🃏"}</span>
      ) : (
        <img src={image} alt="" draggable={false} />
      )}
    </div>
  );
}

export type RitualDealtPayload = {
  cards: DrawnOracleCard[];
  remaining: number;
  spread: RitualSpread;
  reading: OracleDrawHistoryRow;
};

export function BoiRitualOverlay({
  open,
  deck,
  catalog,
  question,
  deckPool = "full",
  flipStyle = "olympus",
  flipFxOff = false,
  cardBackMode = "css",
  cardBackUrl = null,
  bgUrl = null,
  bgFx = "stars",
  onClose,
  onDealt,
  onSaveReading,
  onNotesChange,
}: {
  open: boolean;
  deck: OracleDeckMeta | null;
  catalog: OracleCard[];
  question?: string;
  deckPool?: DeckPool;
  flipStyle?: "olympus" | "cosmic" | "alchemy";
  flipFxOff?: boolean;
  cardBackMode?: BoiCardBackMode;
  cardBackUrl?: string | null;
  bgUrl?: string | null;
  bgFx?: BoiBgFx;
  onClose: () => void;
  onDealt: (payload: RitualDealtPayload) => void;
  onSaveReading?: (
    row: OracleDrawHistoryRow,
  ) => void | Promise<void | OracleDrawHistoryRow>;
  onNotesChange?: (
    id: string,
    notes: string,
  ) => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<RitualPhase>("center");
  const [pile, setPile] = useState<PileCard[]>([]);
  const [dealt, setDealt] = useState<DrawnOracleCard[] | null>(null);
  const [spread, setSpread] = useState<RitualSpread>(3);
  const [pool, setPool] = useState<DeckPool>(deckPool);
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set());
  const [dealReady, setDealReady] = useState(false);
  const [shuffleRound, setShuffleRound] = useState(0);
  const [sessionSeed] = useState(() => Date.now());
  const [readingRow, setReadingRow] = useState<OracleDrawHistoryRow | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const { play: playSfx } = useSfx("tarot", "boi");

  const q = (question ?? "").trim().slice(0, 120);
  const poolSize = filterDeckPool(catalog, pool).length;

  const runShuffle = () => {
    const next = shuffleFullDeck(catalog, { pool });
    setPile(next);
    setDealt(null);
    setFlipped(new Set());
    setDealReady(false);
    setReadingRow(null);
    setSaved(false);
    setPhase("shuffle");
    setShuffleRound((n) => n + 1);
  };

  useEffect(() => {
    if (!open) return;
    setPool(deckPool);
    setPhase("center");
    setPile([]);
    setDealt(null);
    setFlipped(new Set());
    setDealReady(false);
    setReadingRow(null);
    setSaved(false);
    setShuffleRound(0);
  }, [open, catalog, deckPool]);

  useEffect(() => {
    if (!open || phase !== "shuffle") return;
    const t = window.setTimeout(() => setPhase("ready"), 2400);
    return () => window.clearTimeout(t);
  }, [open, phase, shuffleRound]);

  useEffect(() => {
    if (!dealt?.length) return;
    if (phase === "reading") return;
    setPhase("reveal");
    setFlipped(new Set());
    setDealReady(false);
    const t = window.setTimeout(() => setDealReady(true), 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealt]);

  const shuffleTiles = useMemo(
    () => Array.from({ length: 14 }, (_, i) => i),
    [],
  );

  if (!open) return null;

  const mantra = pickMantra(
    phase === "ready"
      ? "pickSpread"
      : phase === "reveal"
        ? "flip"
        : phase === "reading"
          ? "closeReading"
          : phase === "center"
            ? "center"
            : phase === "shuffle"
              ? "shuffle"
              : "hub",
    `${sessionSeed}-${shuffleRound}-${phase}`,
  );

  const deal = (count: RitualSpread) => {
    if (pile.length < count) return;
    const { dealt: nextDealt, remaining } = dealFromTop(pile, count);
    setPile(remaining);
    setDealt(nextDealt);
    setSpread(count);
    const mantraClose = pickMantra(
      "closeReading",
      `${sessionSeed}-${shuffleRound}-close`,
    );
    const at = Date.now();
    const id = `od_${at.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const reading: OracleDrawHistoryRow = {
      id,
      at,
      deckId: deck?.id ?? nextDealt[0]?.deckId ?? "tarot",
      cards: nextDealt,
      spread: String(count),
      question: q || undefined,
      title: makeReadingTitle(q, count),
      mantraClose,
    };
    setReadingRow(reading);
    setSaved(false);
    onDealt({
      cards: nextDealt,
      remaining: remaining.length,
      spread: count,
      reading,
    });
  };

  const flipOne = (i: number) => {
    if (!dealReady) return;
    setFlipped((prev) => {
      if (prev.has(i)) return prev;
      playSfx("flip");
      return new Set(prev).add(i);
    });
  };

  const flipAll = () => {
    if (!dealt) return;
    playSfx("flip");
    setFlipped(new Set(dealt.map((_, i) => i)));
  };

  const allFlipped = !!dealt?.length && flipped.size >= dealt.length;
  const total = poolSize || pile.length;

  const openReading = () => {
    if (readingRow) setPhase("reading");
  };

  return (
    <div
      className={`boi-ritual boi-ritual--theatre boi-fx--${bgFx} boi-back--${cardBackMode}${flipFxOff ? " boi-ritual--no-flip-fx" : ""}`}
      role="dialog"
      aria-modal="true"
      style={
        {
          ...(bgUrl ? { ["--boi-bg" as string]: `url(${bgUrl})` } : {}),
          ...(cardBackUrl
            ? { ["--boi-card-back" as string]: `url(${cardBackUrl})` }
            : {}),
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="boi-ritual__backdrop"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="boi-ritual__fx" aria-hidden />
      <div className="boi-ritual__shell boi-ritual__shell--theatre">
        <header className="boi-ritual__head">
          <div>
            <p className="boi-ritual__eyebrow">Nghi thức · bộ thật</p>
            <h2 className="boi-ritual__title">{deck?.nameVi ?? "Bộ bài"}</h2>
          </div>
          <button type="button" className="boi-ritual__close" onClick={onClose}>
            Đóng
          </button>
        </header>

        {phase !== "center" && phase !== "reading" ? (
          <div className="boi-ritual__pilebar" aria-live="polite">
            <div className="boi-ritual__mini-stack" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div>
              <p className="boi-ritual__pile-count">
                Còn <strong>{pile.length}</strong> / {total} lá
              </p>
              <p className="boi-ritual__pile-hint">
                Thứ tự sau xào được giữ — rút từ đỉnh
              </p>
            </div>
            {phase !== "shuffle" ? (
              <button
                type="button"
                className="boi-ritual__reshuffle"
                onClick={runShuffle}
                title="Xào lại cả bộ"
              >
                Xào lại
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === "center" ? (
          <div className="boi-ritual__stage boi-ritual__stage--center">
            <p className="boi-ritual__mantra">{mantra}</p>
            {q ? (
              <p className="boi-ritual__intent">
                <span>Ý nguyện</span>
                {q}
              </p>
            ) : (
              <p className="boi-ritual__hint">
                Không có câu hỏi cụ thể — bài sẽ nói theo dòng chảy chung.
              </p>
            )}
            <div className="boi-ritual__pools" role="group" aria-label="Cấu hình bộ">
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
                  className={`boi-ritual__pool ${pool === id ? "on" : ""}`}
                  onClick={() => setPool(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="boi-ritual__cta"
              disabled={poolSize < 1}
              onClick={runShuffle}
            >
              Xào {poolSize || "…"} lá
            </button>
          </div>
        ) : null}

        {phase === "shuffle" ? (
          <div className="boi-ritual__stage boi-ritual__stage--shuffle">
            <div className="boi-ritual__orbit" aria-hidden>
              {shuffleTiles.map((i) => (
                <span
                  key={`${shuffleRound}-${i}`}
                  className="boi-ritual__fly"
                  style={{ ["--i" as string]: i }}
                />
              ))}
            </div>
            <div className="boi-ritual__deck-stack" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="boi-ritual__mantra">{mantra}</p>
            <p className="boi-ritual__hint">Đang xào {total || "…"} lá · giữ nguyên cả bộ</p>
          </div>
        ) : null}

        {phase === "ready" ? (
          <div className="boi-ritual__stage boi-ritual__stage--pick">
            <div className="boi-ritual__deck-hero" aria-hidden>
              <div className="boi-ritual__deck-glow" />
              <div className="boi-ritual__deck-back">
                <CardBackFace mode={cardBackMode} imageUrl={cardBackUrl} />
                <span className="boi-ritual__deck-n">{pile.length}</span>
              </div>
            </div>
            <p className="boi-ritual__mantra">{mantra}</p>
            <p className="boi-ritual__hint">{spreadMantraHint(spread)}</p>
            <div className="boi-ritual__spreads">
              {(
                [
                  [1, "1 lá · Lá chủ"],
                  [3, "3 lá · Thời gian"],
                  [5, "5 lá · Quan hệ"],
                  [10, "10 lá · Celtic Cross"],
                ] as const
              ).map(([n, label]) => (
                <button
                  key={n}
                  type="button"
                  className={`boi-ritual__spread ${spread === n ? "on" : ""}`}
                  disabled={pile.length < n}
                  onClick={() => setSpread(n)}
                >
                  <strong>{n}</strong>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="boi-ritual__cta"
              disabled={pile.length < spread}
              onClick={() => deal(spread)}
            >
              Rải {spread} lá lên bàn
            </button>
            {pile.length < spread ? (
              <p className="boi-ritual__hint">Không đủ lá — hãy xào lại</p>
            ) : null}
          </div>
        ) : null}

        {phase === "reveal" && dealt ? (
          <div className="boi-ritual__stage boi-ritual__stage--reveal">
            <p className="boi-ritual__mantra">{mantra}</p>
            <div className={`boi-spread ${spreadLayoutClass(dealt.length)}`}>
              {dealt.map((c, i) => {
                const isUp = flipped.has(i);
                return (
                  <button
                    key={`${c.key}-${i}`}
                    type="button"
                    className={`boi-ritual__card boi-spread__slot boi-spread__slot--${i + 1} ${flipFxOff ? "" : `boi-flip--${flipStyle}`} ${suitFx(c.suit)} ${isUp ? "is-flipped" : ""} ${c.reversedDraw && isUp ? "is-rev" : ""}`}
                    style={{ ["--delay" as string]: `${i * 0.07}s` }}
                    onClick={() => flipOne(i)}
                  >
                    <div className="boi-ritual__card-inner">
                      <CardBackFace
                        mode={cardBackMode}
                        imageUrl={cardBackUrl}
                      />
                      <div className="boi-ritual__card-front">
                        {c.position ? (
                          <span className="boi-ritual__pos">{c.position}</span>
                        ) : null}
                        <Face image={c.image} />
                        <div className="boi-ritual__meta">
                          <strong>{c.nameVi}</strong>
                          <span>
                            {c.reversedDraw ? "Ngược" : "Xuôi"}
                            {c.suit
                              ? ` · ${ORACLE_SUIT_LABEL[c.suit] ?? c.suit}`
                              : ""}
                          </span>
                        </div>
                        <span className="boi-ritual__aura" aria-hidden />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="boi-ritual__actions">
              {!allFlipped ? (
                <button
                  type="button"
                  className="boi-ritual__cta boi-ritual__cta--ghost"
                  onClick={flipAll}
                >
                  Lật tất cả
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="boi-ritual__cta"
                    onClick={openReading}
                  >
                    Mở bàn đọc
                  </button>
                  <button
                    type="button"
                    className="boi-ritual__cta boi-ritual__cta--ghost"
                    disabled={pile.length < 1}
                    onClick={() => setPhase("ready")}
                  >
                    Rút thêm ({pile.length})
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {phase === "reading" && readingRow ? (
          <div className="boi-ritual__stage boi-ritual__stage--reading">
            <BoiReadingDesk
              row={{ ...readingRow, notes: readingRow.notes }}
              deckName={deck?.nameVi}
              mode="live"
              saved={saved}
              onClose={onClose}
              onSave={
                onSaveReading
                  ? async () => {
                      const savedRow = await onSaveReading(readingRow);
                      if (savedRow && typeof savedRow === "object" && "id" in savedRow) {
                        setReadingRow(savedRow);
                      }
                      setSaved(true);
                    }
                  : undefined
              }
              onNotesChange={
                onNotesChange
                  ? async (notes) => {
                      setReadingRow((r) => (r ? { ...r, notes } : r));
                      await onNotesChange(readingRow.id, notes);
                    }
                  : (notes) => {
                      setReadingRow((r) => (r ? { ...r, notes } : r));
                    }
              }
            />
            <div className="boi-ritual__actions">
              <button
                type="button"
                className="boi-ritual__cta boi-ritual__cta--ghost"
                onClick={() => setPhase("reveal")}
              >
                Về bàn trải
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
