import { useCallback, useEffect, useState } from "react";
import { api } from "../auth";
import { ImageUploadPopup } from "./ImageUploadPopup";
import { formatXu } from "../cards";
import {
  isRingEmoji,
  RING_EFFECT_LABELS,
  RING_EFFECTS,
  type BondAdminRow,
  type RingEffect,
  type RingItem,
} from "../rings";

function BondDesignForm({
  row,
  busy,
  presets,
  canUnlock,
  uploadUrl,
  onClearUpload,
  onUpload,
  onSaveCustom,
  onEquip,
  onMeta,
}: {
  row: BondAdminRow;
  busy: boolean;
  presets: RingItem[];
  canUnlock: boolean;
  uploadUrl?: string | null;
  onClearUpload: () => void;
  onUpload: (key: string) => void;
  onSaveCustom: (o: {
    nameVi: string;
    image: string;
    effect: RingEffect;
  }) => void;
  onEquip: (key: string) => void;
  onMeta: (o: {
    note: string;
    couplePhrase: string;
    designLocked?: boolean;
  }) => void;
}) {
  const [nameVi, setNameVi] = useState(row.ringNameVi);
  const [image, setImage] = useState(row.ringImage);
  const [effect, setEffect] = useState<RingEffect>(
    (RING_EFFECTS.includes(row.ringEffect as RingEffect)
      ? row.ringEffect
      : "glow") as RingEffect,
  );
  const [note, setNote] = useState(row.note ?? "");
  const [phrase, setPhrase] = useState(row.couplePhrase ?? "");
  const locked = !!row.designLocked;
  const blocked = locked && !canUnlock;

  useEffect(() => {
    setNameVi(row.ringNameVi);
    setImage(row.ringImage);
    setEffect(
      (RING_EFFECTS.includes(row.ringEffect as RingEffect)
        ? row.ringEffect
        : "glow") as RingEffect,
    );
    setNote(row.note ?? "");
    setPhrase(row.couplePhrase ?? "");
  }, [row]);

  useEffect(() => {
    if (!uploadUrl) return;
    setImage(uploadUrl);
    onClearUpload();
  }, [uploadUrl, onClearUpload]);

  const customKey = row.coupleCode
    ? `c_${row.coupleCode.toLowerCase()}`
    : `b_${row.id.replace(/[^a-z0-9_-]/gi, "").toLowerCase().slice(0, 36)}`;

  return (
    <div className="mt-2 space-y-2 border-t border-[var(--wood-deep)]/10 pt-2">
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-[var(--wood-deep)]/10">
          {isRingEmoji(image) ? (
            <span className="text-2xl">{image || "💍"}</span>
          ) : (
            <img src={image} alt="" className="h-10 w-10 object-contain" />
          )}
        </div>
        <button
          type="button"
          disabled={busy || blocked}
          onClick={() => onUpload(customKey)}
          className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
        >
          Tải ảnh lên
        </button>
        {locked ? (
          <span className="text-[10px] font-bold text-amber-800">khóa TK</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.slice(0, 6).map((r) => (
          <button
            key={r.key}
            type="button"
            disabled={busy || blocked || r.key === row.ringKey}
            onClick={() => onEquip(r.key)}
            className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold ring-1 ring-[var(--wood-deep)]/12 disabled:opacity-40"
          >
            {r.nameVi}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-1.5">
        <label className="min-w-[7rem] flex-1 text-[10px] text-[var(--play-muted)]">
          Tên riêng
          <input
            className="app-input mt-0.5 w-full !px-2 !py-1 text-[11px]"
            value={nameVi}
            disabled={busy || blocked}
            onChange={(e) => setNameVi(e.target.value)}
          />
        </label>
        <label className="min-w-[8rem] flex-[1.4] text-[10px] text-[var(--play-muted)]">
          Ảnh / emoji
          <input
            className="app-input mt-0.5 w-full !px-2 !py-1 text-[11px]"
            value={image}
            disabled={busy || blocked}
            onChange={(e) => setImage(e.target.value)}
          />
        </label>
        <label className="text-[10px] text-[var(--play-muted)]">
          FX
          <select
            className="app-input mt-0.5 !px-2 !py-1 text-[11px]"
            value={effect}
            disabled={busy || blocked}
            onChange={(e) => setEffect(e.target.value as RingEffect)}
          >
            {RING_EFFECTS.map((fx) => (
              <option key={fx} value={fx}>
                {RING_EFFECT_LABELS[fx]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || blocked || !nameVi.trim()}
          onClick={() => onSaveCustom({ nameVi, image, effect })}
          className="rounded-full bg-[var(--wood-deep)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
        >
          Lưu & đeo
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-1.5">
        <label className="min-w-[7rem] flex-1 text-[10px] text-[var(--play-muted)]">
          Ghi chú
          <input
            className="app-input mt-0.5 w-full !px-2 !py-1 text-[11px]"
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="min-w-[6rem] flex-1 text-[10px] text-[var(--play-muted)]">
          Chữ cặp
          <input
            className="app-input mt-0.5 w-full !px-2 !py-1 text-[11px]"
            value={phrase}
            disabled={busy}
            onChange={(e) => setPhrase(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => onMeta({ note, couplePhrase: phrase })}
          className="rounded-full bg-white px-2.5 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
        >
          Lưu meta
        </button>
        {canUnlock ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onMeta({
                note,
                couplePhrase: phrase,
                designLocked: !locked,
              })
            }
            className="rounded-full bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-950 ring-1 ring-amber-200"
          >
            {locked ? "Mở khóa" : "Khóa TK"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminRingsPanel({
  main,
  onMsg,
}: {
  main: boolean;
  onMsg: (s: string) => void;
}) {
  const [bonds, setBonds] = useState<BondAdminRow[]>([]);
  const [rings, setRings] = useState<RingItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{
    itemKey: string;
    bondId: string;
  } | null>(null);
  const [uploadUrl, setUploadUrl] = useState<{
    bondId: string;
    url: string;
  } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        rings?: RingItem[];
        bondRows?: BondAdminRow[];
      }>("/api/ring/config");
      setRings(r.rings ?? []);
      setBonds(r.bondRows ?? []);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải nhẫn");
    } finally {
      setBusy(false);
    }
  }, [onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalog = rings.filter((r) => (r.kind ?? "catalog") === "catalog");

  const breakBond = async (row: BondAdminRow) => {
    if (!confirm(row.status === "pending" ? "Hủy lời cầu hôn?" : "Tách cặp?"))
      return;
    setBusy(true);
    try {
      const r = await api<{ ok: true; bondRows?: BondAdminRow[] }>(
        "/api/ring/bonds/break",
        {
          method: "POST",
          body: JSON.stringify({ bondId: row.id }),
        },
      );
      if (r.bondRows) setBonds(r.bondRows);
      else await load();
      onMsg("Đã tách / hủy bond");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tách cặp");
    } finally {
      setBusy(false);
    }
  };

  const setRing = async (row: BondAdminRow, ringKey: string) => {
    setBusy(true);
    try {
      const r = await api<{ ok: true; bondRows?: BondAdminRow[] }>(
        "/api/ring/bond-set-ring",
        {
          method: "POST",
          body: JSON.stringify({ bondId: row.id, ringKey }),
        },
      );
      if (r.bondRows) setBonds(r.bondRows);
      else await load();
      onMsg(`Đã đeo ${ringKey}`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi đổi nhẫn");
    } finally {
      setBusy(false);
    }
  };

  const saveCustom = async (
    row: BondAdminRow,
    opts: { nameVi: string; image: string; effect: RingEffect },
  ) => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        bondRows?: BondAdminRow[];
        rings?: RingItem[];
      }>("/api/ring/custom-upsert", {
        method: "POST",
        body: JSON.stringify({
          bondId: row.id,
          equip: true,
          ring: opts,
        }),
      });
      if (r.bondRows) setBonds(r.bondRows);
      if (r.rings) setRings(r.rings);
      else await load();
      onMsg("Đã lưu nhẫn riêng");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi nhẫn riêng");
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async (
    row: BondAdminRow,
    opts: {
      note: string;
      couplePhrase: string;
      designLocked?: boolean;
    },
  ) => {
    setBusy(true);
    try {
      const r = await api<{ ok: true; bondRows?: BondAdminRow[] }>(
        "/api/ring/bond-meta",
        {
          method: "POST",
          body: JSON.stringify({ bondId: row.id, ...opts }),
        },
      );
      if (r.bondRows) setBonds(r.bondRows);
      else await load();
      onMsg("Đã lưu meta cặp");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi meta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <section className="app-panel space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="play-heading text-sm">Cặp / nhẫn (module tách)</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Lazy-loaded · {bonds.length} bond · {rings.length} lá catalog/custom
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
          >
            Làm mới
          </button>
        </div>
        {bonds.length === 0 ? (
          <p className="text-[11px] text-[var(--play-muted)]">Chưa có cặp.</p>
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {bonds.map((row) => {
              const aName = row.a.displayName || row.a.username;
              const bName = row.b.displayName || row.b.username;
              const when = new Date(
                row.acceptedAt ?? row.proposedAt,
              ).toLocaleString("vi-VN");
              return (
                <li
                  key={row.id}
                  className="rounded-lg bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--play-ink)]">
                        {aName} × {bName}
                        {row.coupleCode ? (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                            {row.coupleCode}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-[var(--play-muted)]">
                        {row.status} · {row.ringNameVi} ·{" "}
                        {formatXu(row.ringPrice)} xu · {when}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void breakBond(row)}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-red-800 ring-1 ring-red-300/60"
                    >
                      {row.status === "pending" ? "Hủy" : "Tách cặp"}
                    </button>
                  </div>
                  {row.status === "active" ? (
                    <BondDesignForm
                      row={row}
                      busy={busy}
                      presets={catalog.filter((r) => r.enabled)}
                      canUnlock={main}
                      uploadUrl={
                        uploadUrl?.bondId === row.id ? uploadUrl.url : null
                      }
                      onClearUpload={() => setUploadUrl(null)}
                      onUpload={(itemKey) =>
                        setUpload({ itemKey, bondId: row.id })
                      }
                      onSaveCustom={(o) => void saveCustom(row, o)}
                      onEquip={(k) => void setRing(row, k)}
                      onMeta={(o) => void saveMeta(row, o)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="app-panel space-y-2 p-3 sm:p-4">
        <p className="play-heading text-sm">Catalog nhẫn (xem nhanh)</p>
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {rings
            .slice()
            .sort((a, b) => a.sort - b.sort)
            .map((g) => (
              <li
                key={g.key}
                className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1 text-[11px] ring-1 ring-[var(--wood-deep)]/8"
              >
                <span className="flex items-center gap-2 truncate">
                  {isRingEmoji(g.image) ? (
                    <span>{g.image}</span>
                  ) : (
                    <img src={g.image} alt="" className="h-6 w-6 object-contain" />
                  )}
                  <span className="font-semibold">{g.nameVi}</span>
                  <span className="font-mono text-[9px] text-[var(--play-muted)]">
                    {g.key}
                  </span>
                </span>
                <span className="text-[var(--play-muted)]">
                  {formatXu(g.price)} · {g.enabled ? "on" : "off"}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <ImageUploadPopup
        open={!!upload}
        kind="ring"
        itemKey={upload?.itemKey ?? ""}
        onClose={() => setUpload(null)}
        onUploaded={(url) => {
          if (upload?.bondId) {
            setUploadUrl({ bondId: upload.bondId, url });
            onMsg("Đã tải ảnh — Lưu & đeo để áp dụng");
          }
          setUpload(null);
        }}
      />
    </div>
  );
}

export default AdminRingsPanel;
