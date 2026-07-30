import { useEffect, useState } from "react";
import { api } from "../auth";
import {
  ORACLE_SUIT_LABEL,
  type OracleCard,
  type OracleDeckId,
  type OracleDeckMeta,
} from "../oracle";

type Catalog = {
  decks: OracleDeckMeta[];
  cards: OracleCard[];
  counts?: { tarot: number; zodiac: number; enabled: number };
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
  image: "🃏",
  enabled: true,
  sort: 0,
});

export function OracleAdminPanel({
  main,
  onMsg,
}: {
  main: boolean;
  onMsg: (s: string) => void;
}) {
  const [data, setData] = useState<Catalog | null>(null);
  const [deckFilter, setDeckFilter] = useState<OracleDeckId | "all">("tarot");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<OracleCard>(() => emptyDraft("tarot"));

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

  const rows = (data?.cards ?? []).filter((c) => {
    if (deckFilter !== "all" && c.deckId !== deckFilter) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${c.key} ${c.name} ${c.nameVi} ${c.suit ?? ""}`
      .toLowerCase()
      .includes(needle);
  });

  const saveCard = async () => {
    if (!main) {
      onMsg("Chỉ mainadmin sửa dữ liệu bộ bài");
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
    if (!main) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true } & Catalog>(
        "/api/admin/oracle/card/toggle",
        {
          method: "POST",
          body: JSON.stringify({ key: c.key, enabled: !c.enabled }),
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
        "Khôi phục full seed Tarot 78 + Zodiac 12? Mọi chỉnh sửa tay sẽ mất.",
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
    <section className="app-panel mt-4 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Bói bài — dữ liệu bộ bài</p>
          <p className="text-[11px] text-[var(--play-muted)]">
            Full Tarot (Major + Minor) + 12 cung chiêm tinh. Người chơi rút bài
            tại bàn Bói bài.
            {data?.counts
              ? ` · ${data.counts.tarot} tarot · ${data.counts.zodiac} cung · ${data.counts.enabled} đang bật`
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
        {(
          [
            ["tarot", "Tarot"],
            ["zodiac", "Chiêm tinh"],
            ["all", "Tất cả"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDeckFilter(id)}
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              deckFilter === id
                ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                : "bg-white ring-1 ring-[var(--wood-deep)]/12"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          className="app-input !px-2 !py-1 min-w-[10rem] flex-1 text-[11px]"
          placeholder="Lọc key / tên…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {main ? (
        <div className="grid gap-2 rounded-xl bg-white/70 p-2.5 ring-1 ring-[var(--wood-deep)]/10 sm:grid-cols-2">
          <p className="play-heading col-span-full text-xs">
            Sửa / thêm lá
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
                  deckId: e.target.value as OracleDeckId,
                }))
              }
            >
              <option value="tarot">tarot</option>
              <option value="zodiac">zodiac</option>
            </select>
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
            Ảnh / emoji
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
              disabled={busy || !draft.key.trim()}
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
                      onMsg(
                        `Batch: +${r.upserted} · lỗi ${r.failed}`,
                      );
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
      ) : (
        <p className="text-[11px] text-[var(--play-muted)]">
          Staff xem được catalog · chỉ mainadmin sửa / seed.
        </p>
      )}

      <ul className="max-h-96 space-y-1.5 overflow-y-auto">
        {rows.map((c) => (
          <li
            key={c.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setDraft({ ...c })}
              title="Đưa vào form sửa"
            >
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
            </button>
            {main ? (
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
    </section>
  );
}
