import { useMemo, useState } from "react";
import { formatXu } from "../cards";

export type TrafficPeriodStats = {
  stake: number;
  payout: number;
  profit: number;
  stakes: number;
  wins: number;
  loses: number;
  uniqueUsers: number;
  uniqueRounds: number;
  houseEdge: number;
};

export type VaultFlowWindow = {
  stakeIn: number;
  stakeRefund: number;
  payoutOut: number;
  couponOut: number;
  grantOut: number;
  seizeIn: number;
  feesIn: number;
  mint: number;
  burn: number;
  adminAdjust: number;
  net: number;
  rows: number;
};

export type TrafficPayload = {
  realStakeRound: number;
  botStakeRound: number;
  displayStakeRound: number;
  realPlacersRound: number;
  botPlacersRound: number;
  loggedInOnline: number;
  guestOnline: number;
  historyRounds: number;
  nextRound: number;
  totalAccounts: number;
  playerAccounts: number;
  adminAccounts: number;
  mainadminAccounts: number;
  balanceTotal: number;
  stakeRows: number;
  uniqueUsers: number;
  uniqueRounds: number;
  stakeTotal: number;
  payoutTotal: number;
  profitTotal: number;
  winCount: number;
  loseCount: number;
  stakeToday: number;
  stakesToday: number;
  stakeHour: number;
  stakesHour: number;
  vaultBalance: number;
  vaultStakeIn: number;
  vaultPayoutOut: number;
  vaultNetHouse: number;
  houseEdgeXu: number;
  vaultFlows?: {
    note: string;
    ledgerRows: number;
    windows: {
      hour: VaultFlowWindow;
      day: VaultFlowWindow;
      week: VaultFlowWindow;
      month: VaultFlowWindow;
    };
  };
  vaultArcanaBalance?: number;
  vaultArcanaStakeIn?: number;
  vaultArcanaPayoutOut?: number;
  vaultArcanaNetHouse?: number;
  arcanaHouseEdgeXu?: number;
  vaultArcanaFlows?: TrafficPayload["vaultFlows"];
  interMode?: string;
  interEffectiveMode?: string;
  rolling?: {
    hour: TrafficPeriodStats;
    rolling24h: TrafficPeriodStats;
    calendarDay: TrafficPeriodStats;
    calendarWeek: TrafficPeriodStats;
    calendarMonth: TrafficPeriodStats;
  };
  periods?: {
    timezoneNote: string;
    todayKey: string;
    weekKey: string;
    monthKey: string;
    day: TrafficPeriodStats;
    week: TrafficPeriodStats;
    month: TrafficPeriodStats;
    daySeries: {
      day: string;
      stake: number;
      payout: number;
      profit: number;
      stakes: number;
      wins: number;
      loses: number;
      uniqueUsers: number;
      uniqueRounds: number;
    }[];
    weekSeries: { week: string; stats: TrafficPeriodStats }[];
    monthSeries: { month: string; stats: TrafficPeriodStats }[];
  };
};

type Mode = "live" | "day" | "week" | "month" | "guide";

const GLOSSARY: { key: string; title: string; body: string }[] = [
  {
    key: "stake",
    title: "Stake (xu vào)",
    body: "Xu user login đặt trên bàn Tarot. Vào ví user trừ → cộng vào Kho (vault). Guest không vào kho.",
  },
  {
    key: "payout",
    title: "Xu trả (payout)",
    body: "Xu trả khi user thắng. Trừ khỏi Kho → cộng ví user. Edge kho ≈ tổng stake − tổng payout (không kể mint/coupon).",
  },
  {
    key: "profit",
    title: "Profit user",
    body: "Tổng lãi/lỗ của người chơi trên các dòng xu đã ghi (payout − stake từng dòng). Dương = user thắng ròng.",
  },
  {
    key: "vault",
    title: "Kho xu (vault)",
    body: "Sổ nhà game: balance hiện tại + totalStakeIn / totalPayoutOut all-time. Coupon, grant, phí chat/cảnh giới cũng ghi ledger.",
  },
  {
    key: "edge",
    title: "Edge kho",
    body: "stake_in − payout_out (all-time trên vault). Dương = nhà game lời từ xu đặt. Khác Net kho (còn gồm mint/burn/coupon).",
  },
  {
    key: "rolling",
    title: "Rolling vs lịch",
    body: "«1 giờ / 24h» = cửa sổ lùi từ bây giờ trên stakes.json (cap 2000 dòng). «Ngày / tuần / tháng» = lịch UTC từ traffic-rollup (giữ lâu hơn).",
  },
  {
    key: "display",
    title: "Stake hiển thị",
    body: "Stake thật + bot trên ván hiện tại — chỉ UI bàn chơi, không vào kho.",
  },
  {
    key: "balanceHeld",
    title: "Xu đang cầm",
    body: "Tổng balance mọi tài khoản login. Xu «ngoài bàn»; khi xu đặt thì chuyển sang kho rồi trả lại khi thắng/hoàn.",
  },
];

function StatCard({
  label,
  value,
  hint,
  accent,
  onHelp,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  onHelp?: () => void;
}) {
  return (
    <div
      className={`app-panel p-3 ${accent ? "ring-2 ring-amber-300/50" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="play-section-title !normal-case !tracking-wide">{label}</p>
        {onHelp && (
          <button
            type="button"
            onClick={onHelp}
            className="rounded-full px-1.5 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
            title="Giải thích"
          >
            ?
          </button>
        )}
      </div>
      <p
        className={`font-play mt-1 text-sm font-bold tabular-nums ${
          accent ? "text-amber-800" : "text-[var(--play-ink)]"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[9px] text-[var(--play-muted)]">{hint}</p>
      )}
    </div>
  );
}

function periodCards(p: TrafficPeriodStats, onHelp: (k: string) => void) {
  return [
    {
      label: "Stake",
      value: formatXu(p.stake),
      help: "stake",
    },
    {
      label: "Trả xu",
      value: formatXu(p.payout),
      help: "payout",
    },
    {
      label: "Profit user",
      value: formatXu(p.profit),
      help: "profit",
    },
    {
      label: "Edge (stake−payout)",
      value: formatXu(p.houseEdge),
      help: "edge",
      accent: true,
    },
    { label: "Số xu đặt", value: String(p.stakes) },
    { label: "Win / Lose", value: `${p.wins}/${p.loses}` },
    {
      label: "User (ước lượng)",
      value: String(p.uniqueUsers),
      hint: "Trên nhiều ngày có thể cộng trùng",
    },
    { label: "Ván", value: String(p.uniqueRounds) },
  ].map((row) => (
    <StatCard
      key={row.label}
      label={row.label}
      value={row.value}
      hint={row.hint}
      accent={row.accent}
      onHelp={row.help ? () => onHelp(row.help!) : undefined}
    />
  ));
}

function FlowGrid({
  flow,
  title,
}: {
  flow: VaultFlowWindow;
  title: string;
}) {
  const rows: [string, string][] = [
    ["Xu vào kho", formatXu(flow.stakeIn)],
    ["Hoàn xu", formatXu(flow.stakeRefund)],
    ["Trả xu", formatXu(flow.payoutOut)],
    ["Coupon ra", formatXu(flow.couponOut)],
    ["Grant ra", formatXu(flow.grantOut)],
    ["Seize vào", formatXu(flow.seizeIn)],
    ["Phí (chat/cảnh)", formatXu(flow.feesIn)],
    ["Mint / Burn", `${formatXu(flow.mint)} / ${formatXu(flow.burn)}`],
    ["Admin chỉnh", formatXu(flow.adminAdjust)],
    ["Net ledger", formatXu(flow.net)],
    ["Dòng sổ", String(flow.rows)],
  ];
  return (
    <div className="mt-2">
      <p className="text-[11px] font-bold text-[var(--play-ink)]">{title}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

export function TrafficPanel({
  traffic,
  displayOnline,
}: {
  traffic: TrafficPayload;
  displayOnline: number;
}) {
  const [mode, setMode] = useState<Mode>("live");
  const [helpKey, setHelpKey] = useState<string | null>(null);

  const help = useMemo(
    () => GLOSSARY.find((g) => g.key === helpKey) ?? null,
    [helpKey],
  );

  const openHelp = (key: string) => setHelpKey(key);

  const modes: { id: Mode; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "day", label: "Ngày" },
    { id: "week", label: "Tuần" },
    { id: "month", label: "Tháng" },
    { id: "guide", label: "Hiểu dòng tiền" },
  ];

  const period =
    mode === "day"
      ? traffic.periods?.day
      : mode === "week"
        ? traffic.periods?.week
        : mode === "month"
          ? traffic.periods?.month
          : null;

  const series =
    mode === "day"
      ? traffic.periods?.daySeries
      : mode === "week"
        ? traffic.periods?.weekSeries
        : mode === "month"
          ? traffic.periods?.monthSeries
          : null;

  const vaultWinKey =
    mode === "day" ? "day" : mode === "week" ? "week" : mode === "month" ? "month" : "hour";
  const vaultFlow = traffic.vaultFlows?.windows?.[vaultWinKey];

  return (
    <>
      <section className="app-panel mt-4 space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="play-heading text-sm">Lưu lượng · dòng xu</p>
            <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
              {traffic.periods
                ? `${traffic.periods.todayKey} · ${traffic.periods.weekKey} · ${traffic.periods.monthKey} (UTC)`
                : "Đang tải period…"}
              {" · "}
              Nhấn <strong>?</strong> để giải thích từng chỉ số.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpKey("rolling")}
            className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
          >
            Rolling vs lịch?
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                mode === m.id
                  ? "bg-[var(--wood-deep)] text-[var(--gold-soft)]"
                  : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {mode === "live" && (
        <>
          <section className="mt-4">
            <p className="play-heading text-sm">Online & bàn hiện tại</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatCard
                label="Login online"
                value={String(traffic.loggedInOnline)}
              />
              <StatCard
                label="Khách online"
                value={String(traffic.guestOnline)}
              />
              <StatCard label="Hiển thị CCU" value={String(displayOnline)} />
              <StatCard
                label="Stake thật (ván)"
                value={formatXu(traffic.realStakeRound)}
                onHelp={() => openHelp("stake")}
              />
              <StatCard
                label="Stake bot (ván)"
                value={formatXu(traffic.botStakeRound)}
              />
              <StatCard
                label="Stake hiển thị"
                value={formatXu(traffic.displayStakeRound)}
                onHelp={() => openHelp("display")}
              />
              <StatCard
                label="Người đặt (thật)"
                value={String(traffic.realPlacersRound)}
              />
              <StatCard
                label="Bot đặt"
                value={String(traffic.botPlacersRound)}
              />
              <StatCard
                label="Ván tiếp theo"
                value={`#${traffic.nextRound}`}
              />
            </div>
          </section>

          <section className="mt-4">
            <p className="play-heading text-sm">Cửa sổ gần (stakes.json)</p>
            <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
              Rolling — không phải «hôm nay» lịch. Cap {traffic.stakeRows} dòng
              đang giữ.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {periodCards(
                traffic.rolling?.hour ?? {
                  stake: traffic.stakeHour,
                  payout: 0,
                  profit: 0,
                  stakes: traffic.stakesHour,
                  wins: 0,
                  loses: 0,
                  uniqueUsers: 0,
                  uniqueRounds: 0,
                  houseEdge: 0,
                },
                openHelp,
              )}
            </div>
            <p className="mt-3 text-[11px] font-bold text-[var(--play-ink)]">
              Rolling 24 giờ
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {periodCards(
                traffic.rolling?.rolling24h ?? {
                  stake: traffic.stakeToday,
                  payout: 0,
                  profit: 0,
                  stakes: traffic.stakesToday,
                  wins: 0,
                  loses: 0,
                  uniqueUsers: 0,
                  uniqueRounds: 0,
                  houseEdge: 0,
                },
                openHelp,
              )}
            </div>
          </section>

          <section className="mt-4">
            <p className="play-heading text-sm">Tài khoản & kho (all-time)</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatCard
                label="Tổng tài khoản"
                value={String(traffic.totalAccounts)}
              />
              <StatCard
                label="Player"
                value={String(traffic.playerAccounts)}
              />
              <StatCard
                label="Xu đang cầm (user)"
                value={formatXu(traffic.balanceTotal)}
                onHelp={() => openHelp("balanceHeld")}
              />
              <StatCard
                label="Kho xu"
                value={formatXu(traffic.vaultBalance)}
                accent
                onHelp={() => openHelp("vault")}
              />
              <StatCard
                label="Xu vào kho"
                value={formatXu(traffic.vaultStakeIn)}
                onHelp={() => openHelp("stake")}
              />
              <StatCard
                label="Trả từ kho"
                value={formatXu(traffic.vaultPayoutOut)}
                onHelp={() => openHelp("payout")}
              />
              <StatCard
                label="Edge kho"
                value={formatXu(traffic.houseEdgeXu)}
                accent
                onHelp={() => openHelp("edge")}
              />
              <StatCard
                label="Net kho"
                value={formatXu(traffic.vaultNetHouse)}
              />
              <StatCard
                label="Tổng stake (log)"
                value={formatXu(traffic.stakeTotal)}
              />
            </div>
          </section>

          {vaultFlow && (
            <section className="app-panel mt-4 p-3">
              <p className="play-heading text-sm">Dòng tiền kho · 1 giờ</p>
              <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                {traffic.vaultFlows?.note}
              </p>
              <FlowGrid flow={vaultFlow} title="Ledger gần đây" />
            </section>
          )}
        </>
      )}

      {(mode === "day" || mode === "week" || mode === "month") && period && (
        <>
          <section className="mt-4">
            <p className="play-heading text-sm">
              {mode === "day"
                ? `Ngày ${traffic.periods?.todayKey}`
                : mode === "week"
                  ? `Tuần ${traffic.periods?.weekKey}`
                  : `Tháng ${traffic.periods?.monthKey}`}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
              Rollup bền (`traffic-rollup.json`) — không mất khi stakes bị cắt
              2000 dòng.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {periodCards(period, openHelp)}
            </div>
          </section>

          {vaultFlow && (
            <section className="app-panel mt-4 p-3">
              <p className="play-heading text-sm">
                Dòng tiền kho ·{" "}
                {mode === "day"
                  ? "24h ledger"
                  : mode === "week"
                    ? "7 ngày ledger"
                    : "30 ngày ledger"}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                {traffic.vaultFlows?.note}
              </p>
              <FlowGrid flow={vaultFlow} title="Phân loại sổ cái" />
            </section>
          )}

          {series && series.length > 0 && (
            <section className="app-panel mt-4 p-3">
              <p className="play-heading text-sm">Chuỗi gần đây</p>
              <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                {mode === "day" &&
                  (
                    series as NonNullable<
                      TrafficPayload["periods"]
                    >["daySeries"]
                  ).map((row) => (
                    <li
                      key={row.day}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                    >
                      <span className="font-semibold">{row.day}</span>
                      <span className="tabular-nums text-[var(--play-muted)]">
                        stake {formatXu(row.stake)} · edge{" "}
                        {formatXu(row.stake - row.payout)} · {row.stakes} ván
                      </span>
                    </li>
                  ))}
                {mode === "week" &&
                  (
                    series as NonNullable<
                      TrafficPayload["periods"]
                    >["weekSeries"]
                  ).map((row) => (
                    <li
                      key={row.week}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                    >
                      <span className="font-semibold">{row.week}</span>
                      <span className="tabular-nums text-[var(--play-muted)]">
                        stake {formatXu(row.stats.stake)} · edge{" "}
                        {formatXu(row.stats.houseEdge)} · {row.stats.stakes}{" "}
                        xu đặt
                      </span>
                    </li>
                  ))}
                {mode === "month" &&
                  (
                    series as NonNullable<
                      TrafficPayload["periods"]
                    >["monthSeries"]
                  ).map((row) => (
                    <li
                      key={row.month}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                    >
                      <span className="font-semibold">{row.month}</span>
                      <span className="tabular-nums text-[var(--play-muted)]">
                        stake {formatXu(row.stats.stake)} · edge{" "}
                        {formatXu(row.stats.houseEdge)} · {row.stats.stakes}{" "}
                        xu đặt
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {mode === "guide" && (
        <section className="app-panel mt-4 space-y-3 p-3">
          <p className="play-heading text-sm">Hệ thống tiền & lưu lượng</p>
          <ol className="list-decimal space-y-2 pl-4 text-[12px] text-[var(--play-ink)]">
            <li>
              <strong>Ví user</strong> — balance cá nhân. Đặt xu → trừ ví,
              thắng → cộng ví.
            </li>
            <li>
              <strong>Kho (vault)</strong> — đối ứng: xu vào cộng kho, trả
              thưởng trừ kho. Guest không đi qua kho.
            </li>
            <li>
              <strong>stakes.json</strong> — log từng dòng xu (cap 2000) → Live /
              rolling.
            </li>
            <li>
              <strong>traffic-rollup</strong> — cộng dồn theo ngày UTC → tab
              Ngày/Tuần/Tháng bền lâu.
            </li>
            <li>
              <strong>Ledger kho</strong> — 200 dòng gần nhất: coupon, grant,
              phí, mint… (tab theo cửa sổ).
            </li>
          </ol>
          <div className="rounded-lg bg-white/70 p-3 text-[11px] ring-1 ring-[var(--wood-deep)]/10">
            <p className="font-bold">Luồng nhanh</p>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-[var(--play-muted)]">
              User đặt → ví↓ vault↑ (stake_in)
              <br />
              User thắng → vault↓ ví↑ (payout_out)
              <br />
              Coupon → vault↓ ví↑ (coupon_mint)
              <br />
              Bot / display stake → chỉ UI, không vault
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {GLOSSARY.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setHelpKey(g.key)}
                className="rounded-lg bg-white/80 px-3 py-2 text-left ring-1 ring-[var(--wood-deep)]/10"
              >
                <p className="text-[12px] font-bold text-[var(--play-ink)]">
                  {g.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--play-muted)]">
                  {g.body}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {help && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setHelpKey(null)}
        >
          <div
            className="app-panel w-full max-w-md space-y-2 p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="play-heading text-sm">{help.title}</p>
            <p className="text-[12px] leading-relaxed text-[var(--play-ink)]">
              {help.body}
            </p>
            <button
              type="button"
              onClick={() => setHelpKey(null)}
              className="mt-1 rounded-full bg-[var(--wood-deep)] px-4 py-1.5 text-xs font-bold text-white"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
