import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  getStoredUser,
  homePath,
  type AuthUser,
} from "../auth";
import { AppShell } from "../components/AppShell";
import { TableNav } from "../components/TableNav";
import {
  isOracleEmoji,
  ORACLE_SUIT_LABEL,
  type DrawnOracleCard,
  type OracleDeckId,
  type OracleDeckMeta,
  type OracleCard,
} from "../oracle";

type SpreadCount = 1 | 3 | 5 | 10;

interface HistoryRow {
  id: string;
  at: number;
  deckId: OracleDeckId;
  cards: DrawnOracleCard[];
}

export default function BoiBaiPage() {
  const [me] = useState<AuthUser | null>(() => getStoredUser());
  const [decks, setDecks] = useState<OracleDeckMeta[]>([]);
  const [cards, setCards] = useState<OracleCard[]>([]);
  const [deckId, setDeckId] = useState<OracleDeckId>("tarot");
  const [spread, setSpread] = useState<SpreadCount>(1);
  const [drawn, setDrawn] = useState<DrawnOracleCard[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [browseKey, setBrowseKey] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const r = await api<{ ok: true; rows: HistoryRow[] }>(
        "/api/oracle/history?limit=8",
      );
      setHistory(r.rows ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const r = await api<{
          ok: true;
          decks: OracleDeckMeta[];
          cards: OracleCard[];
        }>("/api/oracle/catalog");
        setDecks(r.decks ?? []);
        setCards(r.cards ?? []);
        if (r.decks?.[0]?.id) setDeckId(r.decks[0].id);
        await loadHistory();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Không tải được bộ bài");
      }
    })();
  }, []);

  const activeDeck = decks.find((d) => d.id === deckId);
  const deckCards = cards.filter((c) => c.deckId === deckId);
  const browse = browseKey
    ? deckCards.find((c) => c.key === browseKey) ?? null
    : null;

  const draw = async () => {
    setBusy(true);
    setMsg(null);
    setBrowseKey(null);
    try {
      const r = await api<{
        ok: true;
        cards: DrawnOracleCard[];
      }>("/api/oracle/draw", {
        method: "POST",
        body: JSON.stringify({ deckId, count: spread }),
      });
      setDrawn(r.cards ?? []);
      await loadHistory();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Rút bài thất bại");
    } finally {
      setBusy(false);
    }
  };

  if (!me) {
    return (
      <AppShell>
        <p className="p-4 text-sm">Cần đăng nhập để bói bài.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-3 pb-10 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="play-heading text-lg">Bói bài</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Full Tarot & chiêm tinh — không đặt xu.
            </p>
          </div>
          <Link
            to={homePath(me)}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
          >
            Về trang
          </Link>
        </div>

        <div className="mb-3">
          <TableNav user={me} active="boi" compact />
        </div>

        <section className="app-panel space-y-3 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
            Chọn bộ bài
          </p>
          <div className="flex flex-wrap gap-1.5">
            {decks.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDeckId(d.id);
                  setDrawn(null);
                  setBrowseKey(null);
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
          {activeDeck ? (
            <p className="text-[11px] text-[var(--play-muted)]">
              {activeDeck.blurb} · {deckCards.length} lá
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                [1, "1 lá"],
                [3, "3 lá QK–HT–TL"],
                [5, "5 lá quan hệ"],
                [10, "10 lá Celtic"],
              ] as const
            ).map(([n, label]) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpread(n)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  spread === n
                    ? "bg-[var(--wood-deep)]/90 text-[var(--cream)]"
                    : "bg-white ring-1 ring-[var(--wood-deep)]/12"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || deckCards.length === 0}
              onClick={() => void draw()}
              className="oracle-draw-btn rounded-full bg-[var(--wood-deep)] px-4 py-1.5 text-[11px] font-bold text-[var(--cream)] disabled:opacity-45"
            >
              {busy ? "Đang rút…" : "Rút bài"}
            </button>
          </div>
          {msg ? (
            <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-800">
              {msg}
            </p>
          ) : null}
        </section>

        {drawn && drawn.length > 0 ? (
          <section className="mt-4 space-y-3">
            <p className="play-heading text-sm">Kết quả</p>
            <div
              className={`grid gap-3 ${
                drawn.length === 1
                  ? "grid-cols-1"
                  : drawn.length <= 3
                    ? "grid-cols-1 sm:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {drawn.map((c) => (
                <article
                  key={`${c.key}-${c.position ?? ""}`}
                  className="oracle-card-flip app-panel space-y-2 p-3"
                >
                  {c.position ? (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
                      {c.position}
                    </p>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-[var(--wood-deep)]/12 ${
                        c.reversedDraw ? "rotate-180" : ""
                      }`}
                    >
                      {isOracleEmoji(c.image) ? (
                        <span className="text-3xl">{c.image || "🃏"}</span>
                      ) : (
                        <img
                          src={c.image}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[var(--play-ink)]">
                        {c.nameVi}
                      </p>
                      <p className="text-[10px] text-[var(--play-muted)]">
                        {c.name}
                        {c.suit
                          ? ` · ${ORACLE_SUIT_LABEL[c.suit] ?? c.suit}`
                          : ""}
                        {c.reversedDraw ? " · Ngược" : " · Xuôi"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[var(--play-ink)]">
                    {c.meaning}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {history.length > 0 ? (
          <section className="app-panel mt-4 space-y-2 p-3">
            <p className="play-heading text-sm">Lịch sử rút</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-md bg-white/70 px-2 py-1.5 text-[10px] ring-1 ring-[var(--wood-deep)]/8"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setDrawn(h.cards)}
                  >
                    <span className="font-semibold">
                      {h.cards.length} lá · {h.deckId}
                    </span>
                    <span className="ml-2 text-[var(--play-muted)]">
                      {new Date(h.at).toLocaleString("vi-VN")}
                    </span>
                    <p className="truncate text-[var(--play-muted)]">
                      {h.cards.map((c) => c.nameVi).join(" · ")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="app-panel mt-4 space-y-2 p-3">
          <p className="play-heading text-sm">Tra cứu bộ bài</p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {deckCards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  setBrowseKey((k) => (k === c.key ? null : c.key))
                }
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] ${
                  browseKey === c.key
                    ? "bg-[var(--wood-deep)]/10 ring-1 ring-[var(--wood-deep)]/20"
                    : "bg-white/70 ring-1 ring-[var(--wood-deep)]/8"
                }`}
              >
                <span className="font-semibold text-[var(--play-ink)]">
                  {c.nameVi}
                </span>
                <span className="font-mono text-[9px] text-[var(--play-muted)]">
                  {c.suit ? ORACLE_SUIT_LABEL[c.suit] : c.key}
                </span>
              </button>
            ))}
          </div>
          {browse ? (
            <div className="rounded-lg bg-white/80 p-2.5 text-[12px] ring-1 ring-[var(--wood-deep)]/10">
              <p className="font-bold">{browse.nameVi}</p>
              <p className="mt-2">
                <span className="font-semibold">Xuôi: </span>
                {browse.upright}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Ngược: </span>
                {browse.reversed}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
