import { useState } from "react";
import {
  isOracleEmoji,
  ORACLE_SUIT_LABEL,
  type DrawnOracleCard,
  type OracleDrawHistoryRow,
} from "../oracle";
import {
  formatReadingPlain,
  ORACLE_DISCLAIMER,
  pickMantra,
} from "../oracleMantras";

function Face({ image }: { image: string }) {
  return (
    <div className="boi-reading__face">
      {isOracleEmoji(image) ? (
        <span className="boi-reading__emoji">{image || "🃏"}</span>
      ) : (
        <img src={image} alt="" draggable={false} />
      )}
    </div>
  );
}

export function BoiReadingDesk({
  row,
  deckName,
  mode = "live",
  onSave,
  onNotesChange,
  onClose,
  saved,
}: {
  row: OracleDrawHistoryRow;
  deckName?: string;
  mode?: "live" | "journal";
  onSave?: () => void | Promise<void>;
  onNotesChange?: (notes: string) => void | Promise<void>;
  onClose?: () => void;
  saved?: boolean;
}) {
  const [notes, setNotes] = useState(row.notes ?? "");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const mantraClose =
    row.mantraClose || pickMantra("closeReading", row.id || row.at);

  const copy = async () => {
    const text = formatReadingPlain({
      title: row.title,
      question: row.question,
      deckName,
      spread: row.spread ?? String(row.cards.length),
      at: row.at,
      mantraClose,
      cards: row.cards,
      notes,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const persistNotes = async () => {
    if (!onNotesChange) return;
    setBusy(true);
    try {
      await onNotesChange(notes);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="boi-reading">
      <header className="boi-reading__head">
        <div>
          <p className="boi-reading__eyebrow">Bàn đọc</p>
          <h2 className="boi-reading__title">
            {row.title || "Kết quả trải bài"}
          </h2>
          <p className="boi-reading__meta">
            {new Date(row.at).toLocaleString("vi-VN")}
            {deckName ? ` · ${deckName}` : ""}
            {row.spread ? ` · ${row.spread} lá` : ""}
          </p>
          {row.question ? (
            <p className="boi-reading__question">
              <span>Ý nguyện</span>
              {row.question}
            </p>
          ) : null}
        </div>
        {onClose ? (
          <button type="button" className="boi-reading__x" onClick={onClose}>
            Đóng
          </button>
        ) : null}
      </header>

      <ol className="boi-reading__list">
        {row.cards.map((c: DrawnOracleCard, i) => (
          <li key={`${c.key}-${i}`} className="boi-reading__card">
            <Face image={c.image} />
            <div className="boi-reading__body">
              <p className="boi-reading__pos">{c.position ?? `Lá ${i + 1}`}</p>
              <p className="boi-reading__name">
                {c.nameVi}
                <span>
                  {c.reversedDraw ? "Ngược" : "Xuôi"}
                  {c.suit
                    ? ` · ${ORACLE_SUIT_LABEL[c.suit] ?? c.suit}`
                    : ""}
                </span>
              </p>
              <p className="boi-reading__meaning">{c.meaning}</p>
              {c.keywords?.length ? (
                <p className="boi-reading__kw">
                  {c.keywords.slice(0, 6).join(" · ")}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <blockquote className="boi-reading__close">
        <span>Lời khép vòng</span>
        {mantraClose}
      </blockquote>

      <label className="boi-reading__notes">
        <span>Ghi chú của bạn</span>
        <textarea
          value={notes}
          rows={3}
          maxLength={2000}
          placeholder="Một dòng để ngày sau nhìn lại…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void persistNotes()}
        />
      </label>

      <p className="boi-reading__disc">{ORACLE_DISCLAIMER}</p>

      <div className="boi-reading__actions">
        {mode === "live" && onSave && !saved ? (
          <button
            type="button"
            className="boi-reading__cta"
            disabled={busy}
            onClick={() => void onSave()}
          >
            Lưu vào sổ
          </button>
        ) : null}
        {saved || mode === "journal" ? (
          <span className="boi-reading__saved">Đã trong sổ</span>
        ) : null}
        {onNotesChange ? (
          <button
            type="button"
            className="boi-reading__cta boi-reading__cta--ghost"
            disabled={busy}
            onClick={() => void persistNotes()}
          >
            Lưu ghi chú
          </button>
        ) : null}
        <button
          type="button"
          className="boi-reading__cta boi-reading__cta--ghost"
          onClick={() => void copy()}
        >
          {copied ? "Đã chép" : "Sao chép đọc"}
        </button>
      </div>
    </article>
  );
}
