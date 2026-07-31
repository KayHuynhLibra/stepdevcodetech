import type { OracleDrawHistoryRow, OracleDeckMeta } from "../oracle";

export function BoiJournalPanel({
  rows,
  decks,
  guestHint,
  onOpen,
}: {
  rows: OracleDrawHistoryRow[];
  decks: OracleDeckMeta[];
  guestHint?: boolean;
  onOpen: (row: OracleDrawHistoryRow) => void;
}) {
  const nameOf = (id: string) =>
    decks.find((d) => d.id === id)?.nameVi ?? id;

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
                <strong>{r.title || `Trải ${r.spread ?? r.cards.length} lá`}</strong>
                <span>
                  {nameOf(r.deckId)}
                  {r.spread ? ` · ${r.spread} lá` : ""}
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
