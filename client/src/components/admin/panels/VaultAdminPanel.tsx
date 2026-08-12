import { FormEvent, useEffect, useState } from "react";
import { api, type AuthUser } from "../../../auth";
import { formatXu } from "../../../cards";
import { formatGem } from "../../../gem";

export type ManagedGame = "tarot" | "arcana" | "gem";

type VaultInterFlags = {
  interSignal: boolean;
  interWeightPct: number;
  interPriority: number;
  lossThresholdXu: number;
  profitThresholdXu: number;
  onLossMode: string;
  onProfitMode: string;
  usePercent?: boolean;
  lossPct?: number;
  profitPct?: number;
};

export type VaultSnapshot = {
  balance: number;
  totalStakeIn: number;
  totalPayoutOut: number;
  totalMinted: number;
  totalBurned: number;
  netHouse: number;
  netFromPlay?: number;
  interFlags?: VaultInterFlags;
  health?: {
    edgePct: number;
    blendEdgePct: number;
    flowHourEdgePct: number;
    flowDayEdgePct: number;
    netVsBalancePct: number;
    band: string;
    steerIntensity: number;
  };
  breakdown?: Record<string, { count: number; sum: number }>;
  ledger?: VaultLedgerRow[];
};

type VaultLedgerRow = {
  id: string;
  at: number;
  type: string;
  amount: number;
  balanceAfter: number;
  username?: string;
  userId?: string;
  byUsername?: string;
  note?: string;
};

const LEDGER_LABEL: Record<string, string> = {
  stake_in: "Xu vào",
  stake_refund: "Hoàn xu",
  payout_out: "Trả xu",
  mint: "Bơm kho",
  burn: "Rút kho",
  grant_user: "Cấp user",
  seize_user: "Thu user",
  set_balance: "Đặt số dư",
  coupon_mint: "Coupon",
  admin_adjust: "Admin chỉnh xu",
  chat_fee: "Phí chat",
  cultivation_fee: "Phí cảnh giới",
  ring_fee: "Nhẫn / cầu hôn",
  pocket_fee: "Fee Pocket → Kho",
};

function vaultLabel(g: ManagedGame): string {
  if (g === "arcana") return "Kho Arcana";
  if (g === "gem") return "Kho Gem";
  return "Kho Tarot";
}

function vaultApiBase(g: ManagedGame): string {
  if (g === "arcana") return "/api/mainadmin/vault-arcana";
  if (g === "gem") return "/api/mainadmin/vault-gem";
  return "/api/mainadmin/vault";
}

function vaultKeyOf(g: ManagedGame): "tarot" | "arcana" | "gem" {
  return g;
}

function defaultVaultFlags(managedGame: ManagedGame): VaultInterFlags {
  if (managedGame === "arcana") {
    return {
      interSignal: false,
      interWeightPct: 50,
      interPriority: 5,
      lossThresholdXu: 0,
      profitThresholdXu: 0,
      onLossMode: "",
      onProfitMode: "",
      usePercent: true,
      lossPct: 10,
      profitPct: 15,
    };
  }
  if (managedGame === "gem") {
    return {
      interSignal: false,
      interWeightPct: 0,
      interPriority: 0,
      lossThresholdXu: 0,
      profitThresholdXu: 0,
      onLossMode: "",
      onProfitMode: "",
      usePercent: true,
      lossPct: 10,
      profitPct: 15,
    };
  }
  return {
    interSignal: true,
    interWeightPct: 100,
    interPriority: 10,
    lossThresholdXu: 0,
    profitThresholdXu: 0,
    onLossMode: "",
    onProfitMode: "",
    usePercent: true,
    lossPct: 8,
    profitPct: 12,
  };
}

export function VaultAdminPanel({
  activeVault,
  managedGame,
  users,
  onMsg,
  onReload,
}: {
  activeVault: VaultSnapshot;
  managedGame: ManagedGame;
  users: AuthUser[];
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
}) {
  const [vaultDelta, setVaultDelta] = useState("10000");
  const [vaultSet, setVaultSet] = useState("");
  const [vaultNote, setVaultNote] = useState("");
  const [vaultUser, setVaultUser] = useState({
    userId: "",
    amount: "1000",
  });
  const [vaultFlagsDraft, setVaultFlagsDraft] = useState<VaultInterFlags>(
    defaultVaultFlags(managedGame),
  );
  const [vaultFlagsBusy, setVaultFlagsBusy] = useState(false);
  const [vaultLedgerFilter, setVaultLedgerFilter] = useState<string>("all");
  const [vaultRowDetail, setVaultRowDetail] = useState<VaultLedgerRow | null>(
    null,
  );

  useEffect(() => {
    setVaultSet(String(activeVault.balance));
    if (activeVault.interFlags) {
      setVaultFlagsDraft({
        usePercent: true,
        lossPct: 8,
        profitPct: 12,
        ...activeVault.interFlags,
      });
    } else {
      setVaultFlagsDraft(defaultVaultFlags(managedGame));
    }
  }, [activeVault, managedGame]);

  const vaultAdjust = async (delta: number) => {
    try {
      await api(`${vaultApiBase(managedGame)}/adjust`, {
        method: "POST",
        body: JSON.stringify({ delta, note: vaultNote }),
      });
      onMsg(
        delta > 0
          ? `Đã bơm ${vaultLabel(managedGame)}`
          : `Đã rút ${vaultLabel(managedGame)}`,
      );
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const vaultSetBalance = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`${vaultApiBase(managedGame)}/set`, {
        method: "POST",
        body: JSON.stringify({
          balance: Number(vaultSet),
          note: vaultNote,
        }),
      });
      onMsg(`Đã đặt số dư ${vaultLabel(managedGame)}`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const vaultGrant = async () => {
    if (managedGame === "arcana") {
      onMsg("Cấp/thu xu chỉ dùng Kho Tarot (ví vận hành chung)");
      return;
    }
    try {
      const unit = managedGame === "gem" ? "Gem" : "xu";
      await api(`${vaultApiBase(managedGame)}/grant`, {
        method: "POST",
        body: JSON.stringify({
          userId: vaultUser.userId,
          amount: Number(vaultUser.amount),
          note: vaultNote,
        }),
      });
      onMsg(`Đã cấp ${unit} từ kho cho user`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const vaultSeize = async () => {
    if (managedGame === "arcana") {
      onMsg("Cấp/thu xu chỉ dùng Kho Tarot (ví vận hành chung)");
      return;
    }
    try {
      const unit = managedGame === "gem" ? "Gem" : "xu";
      await api(`${vaultApiBase(managedGame)}/seize`, {
        method: "POST",
        body: JSON.stringify({
          userId: vaultUser.userId,
          amount: Number(vaultUser.amount),
          note: vaultNote,
        }),
      });
      onMsg(`Đã thu ${unit} user về kho`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const saveVaultInterFlags = async () => {
    setVaultFlagsBusy(true);
    try {
      await api("/api/mainadmin/vault-flags", {
        method: "POST",
        body: JSON.stringify({
          vaultKey: vaultKeyOf(managedGame),
          flags: vaultFlagsDraft,
        }),
      });
      onMsg(`Đã lưu flag Inter · ${vaultLabel(managedGame)}`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi lưu flag kho");
    } finally {
      setVaultFlagsBusy(false);
    }
  };

  return (
    <>
              <>
                <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  {[
                    [
                      vaultLabel(managedGame) + " hiện tại",
                      formatXu(activeVault.balance),
                      true,
                    ],
                    ["Tổng xu vào", formatXu(activeVault.totalStakeIn), false],
                    ["Tổng trả xu", formatXu(activeVault.totalPayoutOut), false],
                    ["Đã bơm (mint)", formatXu(activeVault.totalMinted), false],
                    ["Đã rút (burn)", formatXu(activeVault.totalBurned), false],
                    ["Net kho", formatXu(activeVault.netHouse), false],
                  ].map(([label, value, accent]) => (
                    <div
                      key={String(label)}
                      className={`app-panel p-3 ${accent ? "ring-2 ring-amber-300/50" : ""}`}
                    >
                      <p className="play-section-title !normal-case !tracking-wide">
                        {label}
                      </p>
                      <p
                        className={`font-play mt-1 text-sm font-bold tabular-nums ${
                          accent ? "text-amber-700" : "text-[var(--play-ink)]"
                        }`}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </section>
      
                {activeVault.health && (
                  <section className="app-panel mt-3 space-y-2 p-3">
                    <p className="play-heading text-sm">% lỗ / lãi kho</p>
                    <p className="text-[11px] text-[var(--play-muted)]">
                      Edge = (xu vào − trả) / xu vào. Band + intensity (−2
                      hút … +2 nhả) dùng cho mode{" "}
                      <strong>vaultpct / flowguard / moneysteer</strong>.
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["Edge all-time", `${activeVault.health.edgePct}%`],
                          ["Blend (ưu tiên)", `${activeVault.health.blendEdgePct}%`],
                          ["Flow 1 giờ", `${activeVault.health.flowHourEdgePct}%`],
                          ["Flow 24 giờ", `${activeVault.health.flowDayEdgePct}%`],
                          [
                            "Net / balance",
                            `${activeVault.health.netVsBalancePct}%`,
                          ],
                          [
                            "Band",
                            `${activeVault.health.band} · i${activeVault.health.steerIntensity}`,
                          ],
                        ] as const
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className={`rounded-lg bg-white/70 px-2.5 py-2 ring-1 ${
                            activeVault.health!.band.includes("loss")
                              ? "ring-rose-300/50"
                              : activeVault.health!.band.includes("profit")
                                ? "ring-emerald-300/50"
                                : "ring-[var(--wood-deep)]/10"
                          }`}
                        >
                          <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
                            {label}
                          </p>
                          <p className="font-play mt-0.5 text-sm font-bold tabular-nums text-[var(--play-ink)]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
      
                <section className="app-panel mt-3 space-y-2 p-3">
                  <p className="play-heading text-sm">Flag → Inter auto</p>
                  <p className="text-[11px] text-[var(--play-muted)]">
                    Bật <strong>interSignal</strong> để kho này tham gia vault-link.
                    Ưu tiên <strong>usePercent</strong> (edge %) — ngưỡng xu chỉ khi
                    tắt %. Weight / priority cho combine weighted / priority.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={vaultFlagsDraft.interSignal}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            interSignal: e.target.checked,
                          }))
                        }
                      />
                      interSignal
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={!!vaultFlagsDraft.usePercent}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            usePercent: e.target.checked,
                          }))
                        }
                      />
                      usePercent
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Loss %
                      <input
                        type="number"
                        min={0.5}
                        max={80}
                        step={0.5}
                        value={vaultFlagsDraft.lossPct ?? 8}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            lossPct: Number(e.target.value) || 8,
                          }))
                        }
                        className="app-input mt-0.5 !w-20 !py-1"
                      />
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Profit %
                      <input
                        type="number"
                        min={0.5}
                        max={80}
                        step={0.5}
                        value={vaultFlagsDraft.profitPct ?? 12}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            profitPct: Number(e.target.value) || 12,
                          }))
                        }
                        className="app-input mt-0.5 !w-20 !py-1"
                      />
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Weight %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={vaultFlagsDraft.interWeightPct}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            interWeightPct: Number(e.target.value) || 0,
                          }))
                        }
                        className="app-input mt-0.5 !w-20 !py-1"
                      />
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Priority
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={vaultFlagsDraft.interPriority}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            interPriority: Number(e.target.value) || 0,
                          }))
                        }
                        className="app-input mt-0.5 !w-20 !py-1"
                      />
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Ngưỡng lỗ xu (0=global)
                      <input
                        type="number"
                        min={0}
                        value={vaultFlagsDraft.lossThresholdXu}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            lossThresholdXu: Number(e.target.value) || 0,
                          }))
                        }
                        className="app-input mt-0.5 !w-28 !py-1"
                      />
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Ngưỡng lãi xu (0=global)
                      <input
                        type="number"
                        min={0}
                        value={vaultFlagsDraft.profitThresholdXu}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            profitThresholdXu: Number(e.target.value) || 0,
                          }))
                        }
                        className="app-input mt-0.5 !w-28 !py-1"
                      />
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Mode khi lỗ
                      <select
                        value={vaultFlagsDraft.onLossMode}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            onLossMode: e.target.value,
                          }))
                        }
                        className="app-input mt-0.5 !py-1"
                      >
                        <option value="">(global)</option>
                        <option value="small">small</option>
                        <option value="app">app</option>
                        <option value="fed">fed</option>
                        <option value="cool">cool</option>
                        <option value="vaultguard">vaultguard</option>
                        <option value="vaultpct">vaultpct</option>
                        <option value="flowguard">flowguard</option>
                        <option value="moneysteer">moneysteer</option>
                        <option value="fogbreak">fogbreak</option>
                        <option value="smartai">smartai</option>
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold text-[var(--play-muted)]">
                      Mode khi lãi
                      <select
                        value={vaultFlagsDraft.onProfitMode}
                        onChange={(e) =>
                          setVaultFlagsDraft((d) => ({
                            ...d,
                            onProfitMode: e.target.value,
                          }))
                        }
                        className="app-input mt-0.5 !py-1"
                      >
                        <option value="">(global)</option>
                        <option value="big">big</option>
                        <option value="user">user</option>
                        <option value="softuser">softuser</option>
                        <option value="hot">hot</option>
                        <option value="auto">auto</option>
                        <option value="moneysteer">moneysteer</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={vaultFlagsBusy}
                      onClick={() => void saveVaultInterFlags()}
                      className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                    >
                      {vaultFlagsBusy ? "…" : "Lưu flag kho"}
                    </button>
                  </div>
                </section>
      
                <section className="app-panel mt-3 p-3">
                  <p className="play-heading text-sm">Phân loại ledger (gần đây)</p>
                  <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                    Net từ chơi:{" "}
                    <span className="font-bold tabular-nums">
                      {formatXu(
                        activeVault.netFromPlay ??
                          activeVault.totalStakeIn - activeVault.totalPayoutOut,
                      )}
                    </span>
                    {" · "}
                    chat/fee/xu ghi rõ loại.
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {Object.entries(activeVault.breakdown ?? {}).map(
                      ([type, row]) => (
                        <li
                          key={type}
                          className="rounded-lg bg-white/70 px-2 py-1.5 text-[10px] ring-1 ring-[var(--wood-deep)]/10"
                        >
                          <span className="font-semibold">
                            {LEDGER_LABEL[type] ?? type}
                          </span>
                          <span className="mt-0.5 block tabular-nums text-[var(--play-muted)]">
                            {row.count} GD · {formatXu(row.sum)}
                          </span>
                        </li>
                      ),
                    )}
                    {Object.keys(activeVault.breakdown ?? {}).length === 0 && (
                      <li className="text-[11px] text-[var(--play-muted)]">
                        Chưa có breakdown
                      </li>
                    )}
                  </ul>
                </section>
      
                <section className="app-panel mt-4 space-y-3 p-3">
                  <p className="play-heading text-sm">
                    Can thiệp {vaultLabel(managedGame)}
                  </p>
                  <p className="text-[11px] text-[var(--play-muted)]">
                    {managedGame === "arcana"
                      ? "Chỉ xu/trả bánh xe ghi kho này. Coupon/cấp xu user dùng Kho Tarot."
                      : managedGame === "gem"
                        ? "Kho Gem độc lập — cấp/thu Gem ví user. Bàn Gem (settle) để sau."
                        : "Xu bàn Tarot + coupon/cấp/thu xu. Không lẫn Kho Arcana/Gem."}
                  </p>
                  <input
                    value={vaultNote}
                    onChange={(e) => setVaultNote(e.target.value)}
                    placeholder="Ghi chú (tuỳ chọn)"
                    className="app-input"
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={vaultDelta}
                      onChange={(e) => setVaultDelta(e.target.value)}
                      className="app-input w-36"
                      placeholder="Số xu"
                    />
                    <button
                      type="button"
                      onClick={() => vaultAdjust(Math.abs(Number(vaultDelta) || 0))}
                      className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Bơm kho
                    </button>
                    <button
                      type="button"
                      onClick={() => vaultAdjust(-Math.abs(Number(vaultDelta) || 0))}
                      className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Rút kho
                    </button>
                  </div>
                  <form onSubmit={vaultSetBalance} className="flex flex-wrap gap-2">
                    <input
                      value={vaultSet}
                      onChange={(e) => setVaultSet(e.target.value)}
                      className="app-input w-40"
                      placeholder="Đặt số dư tuyệt đối"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Đặt số dư kho
                    </button>
                  </form>
                </section>
      
                {managedGame !== "arcana" && (
                <section className="app-panel mt-4 space-y-2 p-3">
                  <p className="play-heading text-sm">
                    {managedGame === "gem" ? "Gem kho ↔ user" : "Xu kho ↔ user"}
                  </p>
                  <select
                    value={vaultUser.userId}
                    onChange={(e) =>
                      setVaultUser((v) => ({ ...v, userId: e.target.value }))
                    }
                    className="app-input"
                  >
                    <option value="">Chọn user…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({formatXu(u.balance)} xu
                        {typeof u.gemBalance === "number"
                          ? ` · ${formatGem(u.gemBalance)} Gem`
                          : ""}
                        )
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={vaultUser.amount}
                      onChange={(e) =>
                        setVaultUser((v) => ({ ...v, amount: e.target.value }))
                      }
                      className="app-input w-36"
                      placeholder={managedGame === "gem" ? "Số Gem" : "Số xu"}
                    />
                    <button
                      type="button"
                      onClick={vaultGrant}
                      className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Cấp từ kho
                    </button>
                    <button
                      type="button"
                      onClick={vaultSeize}
                      className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Thu về kho
                    </button>
                  </div>
                </section>
                )}
      
                <section className="app-panel mt-4 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="play-heading text-sm">Sổ kho (gần đây)</p>
                    <select
                      value={vaultLedgerFilter}
                      onChange={(e) => setVaultLedgerFilter(e.target.value)}
                      className="app-input !w-auto !py-1 text-[10px]"
                    >
                      <option value="all">Tất cả</option>
                      <option value="outflow">Hao hụt (xu ra)</option>
                      {Object.entries(LEDGER_LABEL).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const rows = (activeVault.ledger ?? []).filter((row) => {
                      if (vaultLedgerFilter === "all") return true;
                      if (vaultLedgerFilter === "outflow") {
                        return (
                          row.amount < 0 ||
                          row.type === "payout_out" ||
                          row.type === "coupon_mint" ||
                          row.type === "grant_user" ||
                          row.type === "burn" ||
                          row.type === "stake_refund"
                        );
                      }
                      return row.type === vaultLedgerFilter;
                    });
                    return (
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
                          <thead className="sticky top-0 bg-[rgba(255,248,235,0.96)] text-[var(--play-muted)]">
                            <tr>
                              <th className="px-1.5 py-1 font-semibold">Thời gian</th>
                              <th className="px-1.5 py-1 font-semibold">Loại</th>
                              <th className="px-1.5 py-1 font-semibold">User</th>
                              <th className="px-1.5 py-1 text-right font-semibold">Xu</th>
                              <th className="px-1.5 py-1 text-right font-semibold">
                                Sau
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-1.5 py-3 text-[var(--play-muted)]"
                                >
                                  Không có dòng khớp bộ lọc
                                </td>
                              </tr>
                            ) : (
                              rows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="cursor-pointer border-t border-[var(--wood-deep)]/8 hover:bg-white/80"
                                  onClick={() => setVaultRowDetail(row)}
                                >
                                  <td className="px-1.5 py-1 tabular-nums text-[var(--play-muted)]">
                                    {new Date(row.at).toLocaleString("vi-VN")}
                                  </td>
                                  <td className="px-1.5 py-1 font-semibold">
                                    {LEDGER_LABEL[row.type] ?? row.type}
                                  </td>
                                  <td className="max-w-[6rem] truncate px-1.5 py-1">
                                    {row.username || "—"}
                                  </td>
                                  <td
                                    className={`px-1.5 py-1 text-right font-play font-bold tabular-nums ${
                                      row.amount < 0
                                        ? "text-rose-600"
                                        : "text-[var(--wood-deep)]"
                                    }`}
                                  >
                                    {row.amount >= 0 ? "+" : ""}
                                    {formatXu(row.amount)}
                                  </td>
                                  <td className="px-1.5 py-1 text-right tabular-nums text-[var(--play-muted)]">
                                    {formatXu(row.balanceAfter)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                  <p className="mt-1.5 text-[9px] text-[var(--play-muted)]">
                    Bấm dòng để xem chi tiết. Bộ lọc chỉ trên {activeVault.ledger?.length ?? 0}{" "}
                    dòng snapshot — dùng popup Tổng quan để tải thêm theo loại.
                  </p>
                </section>
              </>
      {vaultRowDetail && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setVaultRowDetail(null)}
        >
          <div
            className="app-panel w-full max-w-md p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="play-heading text-sm">Chi tiết giao dịch kho</p>
              <button
                type="button"
                className="app-btn-soft !px-2.5 !py-0.5 !text-[10px]"
                onClick={() => setVaultRowDetail(null)}
              >
                Đóng
              </button>
            </div>
            <dl className="space-y-1.5 text-[11px]">
              {(
                [
                  ["Loại", LEDGER_LABEL[vaultRowDetail.type] ?? vaultRowDetail.type],
                  ["Số xu", `${vaultRowDetail.amount >= 0 ? "+" : ""}${formatXu(vaultRowDetail.amount)}`],
                  ["Số dư sau", formatXu(vaultRowDetail.balanceAfter)],
                  ["Thời gian", new Date(vaultRowDetail.at).toLocaleString("vi-VN")],
                  ["User", vaultRowDetail.username || "—"],
                  ["User ID", vaultRowDetail.userId || "—"],
                  ["Bởi", vaultRowDetail.byUsername],
                  ["Ghi chú", vaultRowDetail.note || "—"],
                  ["ID GD", vaultRowDetail.id],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-[var(--wood-deep)]/8 py-1"
                >
                  <dt className="shrink-0 text-[var(--play-muted)]">{k}</dt>
                  <dd className="text-right font-semibold text-[var(--play-ink)] break-all">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

    </>
  );
}
