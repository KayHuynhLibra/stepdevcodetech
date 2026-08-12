import type { OracleDrawHistoryRow, OracleDeckMeta, OracleSpread } from "../oracle";

export function BoiJournalPanel({
  rows,
  decks,
  spreads,
  guestHint,
  onOpen,
}: {
  rows: OracleDrawHistoryRow[];
  decks: OracleDeckMeta[];
  spreads?: OracleSpread[];
  guestHint?: boolean;
  onOpen: (row: OracleDrawHistoryRow) => void;
}) {
  const nameOf = (id: string) =>
    decks.find((d) => d.id === id)?.nameVi ?? id;
  const spreadLabel = (spread?: string, fallbackCards = 0) => {
    if (!spread) return fallbackCards ? `${fallbackCards} lá` : "";
    const byId = spreads?.find((s) => s.id === spread);
    if (byId) return `${byId.nameVi} · ${byId.cardCount} lá`;
    if (spread.includes(":")) {
      const [id, count] = spread.split(":");
      const named = spreads?.find((s) => s.id === id);
      if (named) return `${named.nameVi} · ${named.cardCount} lá`;
      const n = Number(count);
      if (Number.isFinite(n) && n > 0) return `${n} lá`;
    }
    const n = Number(spread);
    if (Number.isFinite(n) && n > 0) return `${n} lá`;
    return spread;
  };

  if (!rows.length) {
    return (
      <div className="boi-journal boi-journal--empty">
        <p className="boi-journal__empty-title">Sổ còn trống</p>
        <p className="boi-journal__empty-hint">
          Hoàn thành một nghi thức rút bài — kết quả sẽ nằm ở đây.
          {guestHint
            ? " Bạn đang ở chế độ khách: sổ lưu trên máy này."
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="boi-journal">
      {guestHint ? (
        <p className="boi-journal__banner">Sổ máy này · chưa đồng bộ tài khoản</p>
      ) : null}
      <ul className="boi-journal__list">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="boi-journal__row"
              onClick={() => onOpen(r)}
            >
              <span className="boi-journal__date">
                {new Date(r.at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="boi-journal__main">
                <strong>
                  {r.title || `Trải ${spreadLabel(r.spread, r.cards.length)}`}
                </strong>
                <span>
                  {nameOf(r.deckId)}
                  {r.spread ? ` · ${spreadLabel(r.spread, r.cards.length)}` : ""}
                  {r.question ? ` · ${r.question}` : ""}
                </span>
              </span>
              <span className="boi-journal__chev" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
