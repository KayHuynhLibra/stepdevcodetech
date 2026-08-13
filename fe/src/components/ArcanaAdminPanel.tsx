import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { formatXu } from "../cards";

interface ArcanaSlotAdmin {
  id: number;
  key: string;
  name: string;
  nameVi: string;
  ratio: number;
  weight: number;
  image: string;
}

interface ArcanaConfig {
  version: number;
  enabled: boolean;
  stakeTiers: number[];
  pickMin?: number;
  pickMax?: number;
  maxStake?: number;
  payoutScale?: number;
  slots: ArcanaSlotAdmin[];
  updatedAt: number;
  updatedBy?: string;
}

interface ArcanaRtpRow {
  pickCount: number;
  winProbability: number;
  rtpSequential: number;
  rtpOptimal: number;
}

interface ArcanaStats {
  spinCount: number;
  winCount: number;
  loseCount: number;
  winRate: number;
  vaultBalance: number;
  houseEdgeXu: number;
  enabled: boolean;
}

type ArcanaConfigPayload = {
  ok: true;
  config: ArcanaConfig;
  stats: ArcanaStats;
  rtpPreview: ArcanaRtpRow[];
};

export function ArcanaAdminPanel({
  onMsg,
}: {
  onMsg?: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ArcanaConfig | null>(null);
  const [stats, setStats] = useState<ArcanaStats | null>(null);
  const [rtpPreview, setRtpPreview] = useState<ArcanaRtpRow[]>([]);
  const [recentSpinCount, setRecentSpinCount] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [stakeTiersText, setStakeTiersText] = useState("");
  const [payoutScale, setPayoutScale] = useState("0.3");

  const hydrate = useCallback((payload: ArcanaConfigPayload) => {
    setConfig(payload.config);
    setStats(payload.stats);
    setRtpPreview(payload.rtpPreview ?? []);
    setEnabled(payload.config.enabled);
    setStakeTiersText(payload.config.stakeTiers.join(", "));
    setPayoutScale(String(payload.config.payoutScale ?? 0.3));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, spins] = await Promise.all([
        api<ArcanaConfigPayload>("/api/mainadmin/arcana/config"),
        api<{ ok: true; spins: Array<{ id: string }> }>(
          "/api/mainadmin/arcana/spins?limit=20",
        ),
      ]);
      hydrate(cfg);
      setRecentSpinCount(spins.spins.length);
    } catch (err) {
      onMsg?.(err instanceof Error ? err.message : "Lỗi tải Arcana");
    } finally {
      setLoading(false);
    }
  }, [hydrate, onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const lastUpdatedLabel = useMemo(() => {
    if (!config?.updatedAt) return "Chưa có";
    return new Date(config.updatedAt).toLocaleString("vi-VN");
  }, [config?.updatedAt]);

  const save = useCallback(async () => {
    const stakeTiers = [...new Set(
      stakeTiersText
        .split(",")
        .map((part) => Math.floor(Number(part.trim().replace(/_/g, ""))))
        .filter((n) => Number.isFinite(n) && n > 0),
    )].sort((a, b) => a - b);
    const payout = Number(payoutScale);
    if (!stakeTiers.length) {
      onMsg?.("Nhập ít nhất 1 stake tier hợp lệ");
      return;
    }
    if (!Number.isFinite(payout) || payout < 0.01 || payout > 2) {
      onMsg?.("payoutScale phải từ 0.01 đến 2");
      return;
    }
    setSaving(true);
    try {
      const payload = await api<ArcanaConfigPayload>(
        "/api/mainadmin/arcana/config",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled,
            stakeTiers,
            payoutScale: payout,
          }),
        },
      );
      hydrate(payload);
      onMsg?.("Đã lưu cấu hình Arcana");
      const spins = await api<{ ok: true; spins: Array<{ id: string }> }>(
        "/api/mainadmin/arcana/spins?limit=20",
      );
      setRecentSpinCount(spins.spins.length);
    } catch (err) {
      onMsg?.(err instanceof Error ? err.message : "Lỗi lưu Arcana");
    } finally {
      setSaving(false);
    }
  }, [enabled, hydrate, onMsg, payoutScale, stakeTiersText]);

  if (loading && !config) {
    return (
      <p className="mt-4 text-[11px] text-[var(--play-muted)]">
        Đang tải Arcana...
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <section className="app-panel space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="play-heading text-sm">Bánh xe Arcana</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Bật/tắt bàn, stake tiers công khai và payoutScale.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[11px] font-bold text-[var(--wood-deep)] underline underline-offset-2"
          >
            Tải lại
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
            <p className="text-[var(--play-muted)]">Spins</p>
            <p className="font-play font-bold">{stats?.spinCount ?? 0}</p>
          </div>
          <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
            <p className="text-[var(--play-muted)]">Win rate</p>
            <p className="font-play font-bold">{stats?.winRate ?? 0}%</p>
          </div>
          <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
            <p className="text-[var(--play-muted)]">Edge</p>
            <p className="font-play font-bold">
              {formatXu(stats?.houseEdgeXu ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
            <p className="text-[var(--play-muted)]">Kho Arcana</p>
            <p className="font-play font-bold">
              {formatXu(stats?.vaultBalance ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-white/70 p-2 ring-1 ring-[var(--wood-deep)]/10">
            <p className="text-[var(--play-muted)]">Spin gần đây</p>
            <p className="font-play font-bold">{recentSpinCount}</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--play-ink)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--jade-deep)]"
          />
          {enabled ? "Arcana đang mở" : "Arcana đang khóa"}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--play-muted)]">
            Stake tiers
            <input
              type="text"
              value={stakeTiersText}
              onChange={(e) => setStakeTiersText(e.target.value)}
              className="app-input mt-1"
              placeholder="300, 800, 1500, 3000..."
            />
          </label>
          <label className="text-xs font-semibold text-[var(--play-muted)]">
            payoutScale
            <input
              type="number"
              min={0.01}
              max={2}
              step={0.01}
              value={payoutScale}
              onChange={(e) => setPayoutScale(e.target.value)}
              className="app-input mt-1"
            />
          </label>
        </div>

        <div className="rounded-lg bg-white/60 p-2.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10">
          <p>
            Stake tiers hiện tại:{" "}
            <span className="font-semibold text-[var(--play-ink)]">
              {config?.stakeTiers.map((tier) => formatXu(tier)).join(" · ") || "—"}
            </span>
          </p>
          <p className="mt-1 text-[var(--play-muted)]">
            Cập nhật: {lastUpdatedLabel}
            {config?.updatedBy ? ` · ${config.updatedBy}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu Arcana"}
          </button>
          <span className="text-[10px] text-[var(--play-muted)]">
            Chỉnh `enabled`, tiers công khai và scale tại đây.
          </span>
        </div>
      </section>

      {rtpPreview.length > 0 && (
        <section className="app-panel p-3">
          <div className="mb-2">
            <p className="play-heading text-sm">RTP preview</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Xem nhanh xác suất thắng và RTP theo số ô chọn.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-[10px]">
              <thead>
                <tr className="text-[var(--play-muted)]">
                  <th className="py-1 pr-2">Số ô</th>
                  <th className="py-1 pr-2">P thắng %</th>
                  <th className="py-1 pr-2">RTP tối ưu %</th>
                  <th className="py-1">RTP tuần tự %</th>
                </tr>
              </thead>
              <tbody>
                {rtpPreview.map((row) => (
                  <tr
                    key={row.pickCount}
                    className={
                      row.rtpOptimal > 105 || row.rtpOptimal < 85
                        ? "font-bold text-rose-700"
                        : "text-[var(--play-ink)]"
                    }
                  >
                    <td className="py-0.5 pr-2">{row.pickCount}</td>
                    <td className="py-0.5 pr-2 tabular-nums">
                      {row.winProbability}
                    </td>
                    <td className="py-0.5 pr-2 tabular-nums">{row.rtpOptimal}</td>
                    <td className="py-0.5 tabular-nums">{row.rtpSequential}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
