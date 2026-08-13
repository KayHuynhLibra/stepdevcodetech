import { useEffect, useState } from "react";
import { api } from "../auth";

type CatalogItem = {
  id: string;
  nameVi: string;
  kind: string;
  priceXu: number;
};

type Economy = {
  stakePresets: number[];
  botWinMult: number;
  catalogPrices: Record<string, number>;
  updatedAt: number;
};

export function LudoEconomyAdmin({
  canEdit,
  onMsg,
}: {
  canEdit: boolean;
  onMsg: (s: string) => void;
}) {
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [stakesText, setStakesText] = useState("0, 500, 1000, 5000");
  const [botMult, setBotMult] = useState("2");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        economy: Economy;
        catalog: CatalogItem[];
      }>("/api/admin/ludo/economy");
      setEconomy(r.economy);
      setCatalog(r.catalog || []);
      setStakesText((r.economy.stakePresets || []).join(", "));
      setBotMult(String(r.economy.botWinMult ?? 2));
      const p: Record<string, string> = {};
      for (const c of r.catalog || []) {
        p[c.id] = String(c.priceXu);
      }
      setPrices(p);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải Ludo economy");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!canEdit) {
      onMsg("Chỉ mainadmin sửa economy Ludo");
      return;
    }
    setBusy(true);
    try {
      const stakePresets = stakesText
        .split(/[,;\s]+/)
        .map((s) => Math.floor(Number(s.trim())))
        .filter((n) => Number.isFinite(n) && n >= 0);
      const catalogPrices: Record<string, number> = {};
      for (const [id, raw] of Object.entries(prices)) {
        const n = Math.floor(Number(raw));
        if (Number.isFinite(n) && n >= 0) catalogPrices[id] = n;
      }
      const r = await api<{ ok: true; economy: Economy; catalog: CatalogItem[] }>(
        "/api/admin/ludo/economy",
        {
          method: "POST",
          body: JSON.stringify({
            stakePresets,
            botWinMult: Number(botMult),
            catalogPrices,
          }),
        },
      );
      setEconomy(r.economy);
      setCatalog(r.catalog || []);
      onMsg("Đã lưu Ludo economy");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel mt-3 p-3">
      <p className="play-heading text-sm">Ludo · Tiền bạc</p>
      <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
        Mức xu tạo phòng · hệ số thắng 1v3 bot · giá shop bàn/quân/khung (xu).
        {economy?.updatedAt
          ? ` · cập nhật ${new Date(economy.updatedAt).toLocaleString("vi-VN")}`
          : ""}
      </p>

      <label className="mt-3 block text-[11px] font-semibold">
        Stake presets (phân tách bằng dấu phẩy)
        <input
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          value={stakesText}
          disabled={busy || !canEdit}
          onChange={(e) => setStakesText(e.target.value)}
        />
      </label>

      <label className="mt-2 block text-[11px] font-semibold">
        Bot win mult (1v3 bot)
        <input
          className="mt-1 w-28 rounded border px-2 py-1.5 text-sm"
          type="number"
          min={1}
          max={10}
          value={botMult}
          disabled={busy || !canEdit}
          onChange={(e) => setBotMult(e.target.value)}
        />
      </label>

      <div className="mt-3 space-y-1.5">
        <p className="text-[11px] font-semibold">Giá shop (xu)</p>
        {catalog.map((c) => (
          <label
            key={c.id}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="min-w-0 truncate">
              {c.nameVi}{" "}
              <span className="opacity-60">({c.kind})</span>
            </span>
            <input
              className="w-24 rounded border px-2 py-1 text-sm tabular-nums"
              type="number"
              min={0}
              value={prices[c.id] ?? "0"}
              disabled={busy || !canEdit}
              onChange={(e) =>
                setPrices((prev) => ({ ...prev, [c.id]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="ludo-btn-block ludo-btn-block--primary"
          disabled={busy || !canEdit}
          onClick={() => void save()}
        >
          Lưu economy
        </button>
        <button
          type="button"
          className="ludo-btn-block"
          disabled={busy}
          onClick={() => void load()}
        >
          Tải lại
        </button>
      </div>
    </section>
  );
}
