import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../auth";

const PAY_LABELS: { id: string; label: string }[] = [
  { id: "ruby", label: "Ruby" },
  { id: "sapphire", label: "Sapphire" },
  { id: "emerald", label: "Emerald" },
  { id: "amethyst", label: "Amethyst" },
  { id: "topaz", label: "Topaz" },
  { id: "pearl", label: "Pearl" },
  { id: "crown", label: "Crown" },
];

type Snap = {
  ok: true;
  pay: Record<string, number>;
  payPct: Record<string, number>;
  bets: number[];
  buyBonusMult: number;
  comboLightningAt?: number;
  rageLightningAt?: number;
  payModeDefault?: "scatter" | "cluster";
  tier10Mult?: number;
  tier12Mult?: number;
  jackpotPool?: number;
  jackpotFeedRate?: number;
  jackpotFloor?: number;
  fsAward?: number;
  fsRetrigger?: number;
  holdTriggerCrowns?: number;
  interventions?: string[];
  noteVi?: string;
  updatedAt: number;
};

type SubTab = "pay" | "combo" | "jackpot" | "ops";

export function OlympusZeusPctPanel({ onMsg }: { onMsg: (s: string) => void }) {
  const [sub, setSub] = useState<SubTab>("combo");
  const [busy, setBusy] = useState(false);
  const [payPct, setPayPct] = useState<Record<string, string>>({});
  const [betsText, setBetsText] = useState("");
  const [buyMult, setBuyMult] = useState("100");
  const [comboAt, setComboAt] = useState("5");
  const [rageAt, setRageAt] = useState("70");
  const [payMode, setPayMode] = useState<"scatter" | "cluster">("scatter");
  const [tier10, setTier10] = useState("2");
  const [tier12, setTier12] = useState("3");
  const [jpFeed, setJpFeed] = useState("3");
  const [jpFloor, setJpFloor] = useState("8000");
  const [jpPool, setJpPool] = useState("80000");
  const [fsAward, setFsAward] = useState("15");
  const [fsRetrigger, setFsRetrigger] = useState("5");
  const [holdCrowns, setHoldCrowns] = useState("6");
  const [updatedAt, setUpdatedAt] = useState(0);
  const [note, setNote] = useState("");

  const [target, setTarget] = useState("");
  const [opsBet, setOpsBet] = useState("100");
  const [opsFsLeft, setOpsFsLeft] = useState("15");
  const [opsRage, setOpsRage] = useState("70");
  const [opsXu, setOpsXu] = useState("10000");
  const [lookupJson, setLookupJson] = useState("");

  const applySnap = useCallback((s: Snap) => {
    const next: Record<string, string> = {};
    for (const row of PAY_LABELS) {
      next[row.id] = String(s.payPct?.[row.id] ?? (s.pay?.[row.id] ?? 0) * 100);
    }
    setPayPct(next);
    setBetsText((s.bets || []).join(", "));
    setBuyMult(String(s.buyBonusMult ?? 100));
    setComboAt(String(s.comboLightningAt ?? 5));
    setRageAt(String(s.rageLightningAt ?? 70));
    setPayMode(s.payModeDefault === "cluster" ? "cluster" : "scatter");
    setTier10(String(s.tier10Mult ?? 2));
    setTier12(String(s.tier12Mult ?? 3));
    setJpFeed(String(Math.round((s.jackpotFeedRate ?? 0.03) * 10000) / 100));
    setJpFloor(String(s.jackpotFloor ?? 8000));
    setJpPool(String(s.jackpotPool ?? 80000));
    setFsAward(String(s.fsAward ?? 15));
    setFsRetrigger(String(s.fsRetrigger ?? 5));
    setHoldCrowns(String(s.holdTriggerCrowns ?? 6));
    setUpdatedAt(s.updatedAt || 0);
    setNote(s.noteVi || "");
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<Snap>("/api/mainadmin/olympus-economy");
      applySnap(r);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải BOLT%");
    } finally {
      setBusy(false);
    }
  }, [applySnap, onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveEconomy = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const pct: Record<string, number> = {};
      for (const row of PAY_LABELS) {
        const v = Number(payPct[row.id]);
        if (!Number.isFinite(v) || v < 0) {
          throw new Error(`% ${row.label} không hợp lệ`);
        }
        pct[row.id] = v;
      }
      const bets = betsText
        .split(/[,;\s]+/)
        .map((x) => Math.floor(Number(x.trim())))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!bets.length) throw new Error("Cần ít nhất 1 mức cược");
      const feedPct = Number(jpFeed);
      const r = await api<Snap>("/api/mainadmin/olympus-economy", {
        method: "POST",
        body: JSON.stringify({
          payPct: pct,
          bets,
          buyBonusMult: Math.round(Number(buyMult)),
          comboLightningAt: Math.round(Number(comboAt)),
          rageLightningAt: Math.round(Number(rageAt)),
          payModeDefault: payMode,
          tier10Mult: Number(tier10),
          tier12Mult: Number(tier12),
          jackpotFeedRate: feedPct / 100,
          jackpotFloor: Math.round(Number(jpFloor)),
          fsAward: Math.round(Number(fsAward)),
          fsRetrigger: Math.round(Number(fsRetrigger)),
          holdTriggerCrowns: Math.round(Number(holdCrowns)),
        }),
      });
      applySnap(r);
      onMsg("Đã lưu cấu hình BoltPeak — spin mới áp ngay");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi lưu");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset toàn bộ % / cược / FS / hũ config về mặc định?")) {
      return;
    }
    setBusy(true);
    try {
      const r = await api<Snap>("/api/mainadmin/olympus-economy", {
        method: "POST",
        body: JSON.stringify({ reset: true }),
      });
      applySnap(r);
      onMsg("Đã reset BOLT%");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi reset");
    } finally {
      setBusy(false);
    }
  };

  const runOps = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action, ...extra };
      if (
        action !== "setJackpot" &&
        action !== "clearLimits" &&
        !extra.guestId
      ) {
        body.username = target.trim();
        body.userId = target.trim();
      }
      const r = await api<Record<string, unknown>>(
        "/api/mainadmin/olympus-ops",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (action === "lookup") {
        setLookupJson(JSON.stringify(r, null, 2));
      }
      if (typeof r.jackpotPool === "number") {
        setJpPool(String(r.jackpotPool));
      }
      onMsg(
        action === "setJackpot"
          ? `Hũ = ${Number(r.jackpotPool).toLocaleString("vi-VN")}`
          : `OK · ${action}`,
      );
      if (action !== "lookup") void load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Ops lỗi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel mt-4 space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">BOLT% · BoltPeak</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Combo · % gem · hũ/FS · can thiệp player — chỉ mainadmin
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Tải lại
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reset()}
            className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          >
            Reset config
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["combo", "Combo"],
            ["pay", "% & cược"],
            ["jackpot", "Hũ & FS"],
            ["ops", "Can thiệp"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
              sub === id
                ? "bg-[var(--wood-deep)] text-white"
                : "bg-white ring-1 ring-[var(--wood-deep)]/15"
            }`}
            onClick={() => setSub(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "combo" ? (
        <form className="space-y-4" onSubmit={(e) => void saveEconomy(e)}>
          <div className="rounded-lg bg-amber-50/90 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--wood-deep)] ring-1 ring-amber-200/80">
            <p className="font-bold">Quản lý cascade / lightning (hãm xu)</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10px]">
              <li>
                Mỗi cascade thắng = +1 combo. Lightning kích khi{" "}
                <strong>combo ≥ ngưỡng</strong> hoặc{" "}
                <strong>rage ≥ ngưỡng</strong>.
              </li>
              <li>
                Tăng ngưỡng → ít lightning/storm → xu tăng chậm hơn. Giảm
                ngưỡng → dễ nổ combo.
              </li>
              <li>
                Tier × và pay mode nhân thêm thắng khi cluster/scatter lớn.
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
              Ngưỡng kích lightning
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-semibold ring-1 ring-[var(--wood-deep)]/10">
                Combo → lightning (≥)
                <input
                  type="number"
                  min={2}
                  max={20}
                  disabled={busy}
                  className="app-input mt-1 !w-full !py-1.5 font-mono !text-[12px]"
                  value={comboAt}
                  onChange={(ev) => setComboAt(ev.target.value)}
                />
                <span className="mt-1 block text-[10px] font-normal text-[var(--play-muted)]">
                  Mặc định 5 · khuyến nghị hãm xu: 7–10
                </span>
              </label>
              <label className="block rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-semibold ring-1 ring-[var(--wood-deep)]/10">
                Rage → lightning (≥)
                <input
                  type="number"
                  min={20}
                  max={100}
                  disabled={busy}
                  className="app-input mt-1 !w-full !py-1.5 font-mono !text-[12px]"
                  value={rageAt}
                  onChange={(ev) => setRageAt(ev.target.value)}
                />
                <span className="mt-1 block text-[10px] font-normal text-[var(--play-muted)]">
                  Mặc định 70 · khuyến nghị hãm xu: 80–90 · 100 = gần tắt
                </span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
              Nhân thắng khi số lượng lớn
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-semibold ring-1 ring-[var(--wood-deep)]/10">
                Tier ≥10 ×
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.1}
                  disabled={busy}
                  className="app-input mt-1 !w-full !py-1.5 font-mono !text-[12px]"
                  value={tier10}
                  onChange={(ev) => setTier10(ev.target.value)}
                />
                <span className="mt-1 block text-[10px] font-normal text-[var(--play-muted)]">
                  Scatter ≥10 (cluster ≥8) · mặc định 2
                </span>
              </label>
              <label className="block rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-semibold ring-1 ring-[var(--wood-deep)]/10">
                Tier ≥12 ×
                <input
                  type="number"
                  min={1}
                  max={15}
                  step={0.1}
                  disabled={busy}
                  className="app-input mt-1 !w-full !py-1.5 font-mono !text-[12px]"
                  value={tier12}
                  onChange={(ev) => setTier12(ev.target.value)}
                />
                <span className="mt-1 block text-[10px] font-normal text-[var(--play-muted)]">
                  ≥12 symbols · mặc định 3 · hãm xu: 1.2–1.5
                </span>
              </label>
            </div>
          </div>

          <label className="block rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-semibold ring-1 ring-[var(--wood-deep)]/10">
            Pay mode mặc định
            <select
              disabled={busy}
              className="app-input mt-1 w-full !py-1.5 !text-[11px]"
              value={payMode}
              onChange={(ev) =>
                setPayMode(
                  ev.target.value === "cluster" ? "cluster" : "scatter",
                )
              }
            >
              <option value="scatter">Scatter (≥8 anywhere) — êm hơn</option>
              <option value="cluster">
                Cluster (≥5 liền kề) — dễ phình xu hơn
              </option>
            </select>
            <span className="mt-1 block text-[10px] font-normal text-[var(--play-muted)]">
              Client có thể ghi đè; giá trị này dùng khi spin không gửi mode.
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-45"
          >
            {busy ? "…" : "Lưu combo / lightning"}
          </button>
        </form>
      ) : null}

      {note && sub === "pay" ? (
        <p className="rounded-lg bg-amber-50/90 px-3 py-2 text-[11px] text-[var(--wood-deep)] ring-1 ring-amber-200/80">
          {note}
        </p>
      ) : null}

      {sub === "pay" ? (
        <form className="space-y-4" onSubmit={(e) => void saveEconomy(e)}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
              % cược theo gem (tier ≥8)
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PAY_LABELS.map((row) => (
                <label
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-2 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                >
                  <span className="font-bold">{row.label}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={0.1}
                      disabled={busy}
                      className="app-input !w-20 !py-1 !text-right font-mono !text-[11px]"
                      value={payPct[row.id] ?? ""}
                      onChange={(ev) =>
                        setPayPct((p) => ({ ...p, [row.id]: ev.target.value }))
                      }
                    />
                    <span className="opacity-60">%</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-semibold">
              Mua bonus × cược
              <input
                type="number"
                min={10}
                max={500}
                disabled={busy}
                className="app-input mt-1 !w-24 !py-1.5 font-mono !text-[11px]"
                value={buyMult}
                onChange={(ev) => setBuyMult(ev.target.value)}
              />
            </label>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
              Mức xu đặt cược
            </p>
            <input
              className="app-input mt-1.5 w-full !py-2 font-mono !text-[11px]"
              disabled={busy}
              value={betsText}
              onChange={(ev) => setBetsText(ev.target.value)}
              placeholder="20, 50, 100, 200, 500, 1000…"
            />
            <p className="mt-1 text-[10px] text-[var(--play-muted)]">
              Combo / lightning / tier chỉnh ở tab <strong>Combo</strong>.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-45"
          >
            {busy ? "…" : "Lưu % & cược"}
          </button>
        </form>
      ) : null}

      {sub === "jackpot" ? (
        <form className="space-y-4" onSubmit={(e) => void saveEconomy(e)}>
          <div className="rounded-lg bg-white/80 px-3 py-3 ring-1 ring-[var(--wood-deep)]/10">
            <p className="text-[11px] font-bold">Hũ hiện tại</p>
            <p className="mt-1 font-mono text-lg font-extrabold">
              {Number(jpPool).toLocaleString("vi-VN")} xu
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="number"
                disabled={busy}
                className="app-input !w-36 !py-1.5 font-mono !text-[11px]"
                value={jpPool}
                onChange={(ev) => setJpPool(ev.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
                onClick={() =>
                  void runOps("setJackpot", {
                    pool: Math.round(Number(jpPool)),
                  })
                }
              >
                Đặt hũ
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-semibold">
              Feed hũ (% mỗi cược)
              <input
                type="number"
                min={0.1}
                max={20}
                step={0.1}
                disabled={busy}
                className="app-input mt-1 !w-24 !py-1.5 font-mono !text-[11px]"
                value={jpFeed}
                onChange={(ev) => setJpFeed(ev.target.value)}
              />
            </label>
            <label className="block text-[11px] font-semibold">
              Sàn hũ (floor)
              <input
                type="number"
                min={0}
                disabled={busy}
                className="app-input mt-1 !w-28 !py-1.5 font-mono !text-[11px]"
                value={jpFloor}
                onChange={(ev) => setJpFloor(ev.target.value)}
              />
            </label>
            <label className="block text-[11px] font-semibold">
              FS khi ≥4 Zeus
              <input
                type="number"
                min={5}
                max={50}
                disabled={busy}
                className="app-input mt-1 !w-24 !py-1.5 font-mono !text-[11px]"
                value={fsAward}
                onChange={(ev) => setFsAward(ev.target.value)}
              />
            </label>
            <label className="block text-[11px] font-semibold">
              FS retrigger
              <input
                type="number"
                min={1}
                max={20}
                disabled={busy}
                className="app-input mt-1 !w-24 !py-1.5 font-mono !text-[11px]"
                value={fsRetrigger}
                onChange={(ev) => setFsRetrigger(ev.target.value)}
              />
            </label>
            <label className="block text-[11px] font-semibold">
              Hold trigger (crown)
              <input
                type="number"
                min={3}
                max={20}
                disabled={busy}
                className="app-input mt-1 !w-24 !py-1.5 font-mono !text-[11px]"
                value={holdCrowns}
                onChange={(ev) => setHoldCrowns(ev.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-45"
          >
            {busy ? "…" : "Lưu hũ config & FS"}
          </button>
        </form>
      ) : null}

      {sub === "ops" ? (
        <div className="space-y-4">
          <p className="text-[11px] text-[var(--play-muted)]">
            Nhập <strong>username</strong> hoặc <strong>user id</strong> đang
            chơi BoltPeak (login). Guest: điền mã guest vào ô dưới khi cần.
          </p>
          <label className="block text-[11px] font-semibold">
            Mục tiêu
            <input
              className="app-input mt-1 w-full !py-2 !text-[12px]"
              disabled={busy}
              value={target}
              onChange={(ev) => setTarget(ev.target.value)}
              placeholder="username hoặc userId"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-[10px] font-semibold">
              Bet
              <input
                className="app-input mt-1 w-full !py-1.5 font-mono !text-[11px]"
                value={opsBet}
                onChange={(ev) => setOpsBet(ev.target.value)}
              />
            </label>
            <label className="block text-[10px] font-semibold">
              FS left
              <input
                className="app-input mt-1 w-full !py-1.5 font-mono !text-[11px]"
                value={opsFsLeft}
                onChange={(ev) => setOpsFsLeft(ev.target.value)}
              />
            </label>
            <label className="block text-[10px] font-semibold">
              Rage 0–100
              <input
                className="app-input mt-1 w-full !py-1.5 font-mono !text-[11px]"
                value={opsRage}
                onChange={(ev) => setOpsRage(ev.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
              onClick={() =>
                void runOps("forceFs", {
                  bet: Math.round(Number(opsBet)),
                  left: Math.round(Number(opsFsLeft)),
                })
              }
            >
              Force Free Spins
            </button>
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
              onClick={() =>
                void runOps("startHold", {
                  bet: Math.round(Number(opsBet)),
                })
              }
            >
              Start Hold &amp; Spin
            </button>
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
              onClick={() =>
                void runOps("setRage", {
                  rage: Math.round(Number(opsRage)),
                })
              }
            >
              Set Rage
            </button>
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
              onClick={() => void runOps("clearPlayer")}
            >
              Clear FS/Hold/Rage
            </button>
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
              onClick={() => void runOps("lookup")}
            >
              Tra cứu trạng thái
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--wood-deep)]/10 pt-3">
            <label className="block text-[10px] font-semibold">
              ± Xu tài khoản (login)
              <input
                className="app-input mt-1 !w-32 !py-1.5 font-mono !text-[11px]"
                value={opsXu}
                onChange={(ev) => setOpsXu(ev.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-emerald-800 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
              onClick={() =>
                void runOps("adjustXu", {
                  delta: Math.abs(Math.round(Number(opsXu)) || 0),
                })
              }
            >
              + Xu
            </button>
            <button
              type="button"
              disabled={busy || !target.trim()}
              className="rounded-full bg-red-900 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
              onClick={() =>
                void runOps("adjustXu", {
                  delta: -Math.abs(Math.round(Number(opsXu)) || 0),
                })
              }
            >
              − Xu
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
              onClick={() => void runOps("clearLimits")}
            >
              Clear rate-limit oly:*
            </button>
          </div>

          {lookupJson ? (
            <pre className="max-h-48 overflow-auto rounded-lg bg-[#1a120c] p-3 text-[10px] text-[#ffe6a8]">
              {lookupJson}
            </pre>
          ) : null}
        </div>
      ) : null}

      {updatedAt > 0 ? (
        <p className="text-[10px] text-[var(--play-muted)]">
          Config cập nhật {new Date(updatedAt).toLocaleString("vi-VN")}
        </p>
      ) : null}
    </section>
  );
}
