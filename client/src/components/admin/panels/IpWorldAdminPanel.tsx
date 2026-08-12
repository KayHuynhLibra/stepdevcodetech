import { useMemo, useState } from "react";

export type IpWorldRow = {
  ip: string;
  online: boolean;
  blocked: boolean;
  clusterFlag?: boolean;
  guestCode?: string;
  kind: string;
  joinCount?: number;
  xu24h?: number;
  lastSeen?: number;
  geo?: {
    local?: boolean;
    country?: string;
    countryCode?: string;
    regionName?: string;
    city?: string;
    isp?: string;
    org?: string;
    proxy?: boolean;
    hosting?: boolean;
  } | null;
  users: {
    id: string;
    username: string;
    code: string;
    balance: number;
  }[];
};

type WorldKey = string;

type CountryBucket = {
  key: WorldKey;
  label: string;
  code: string;
  ips: IpWorldRow[];
  online: number;
  blocked: number;
  proxy: number;
  hosting: number;
  cluster: number;
  xu24h: number;
};

function formatXu(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

function countryKey(row: IpWorldRow): { key: WorldKey; label: string; code: string } {
  const g = row.geo;
  if (g?.local) return { key: "local", label: "Local / private", code: "LOC" };
  const code = (g?.countryCode || "").trim().toUpperCase();
  const name = (g?.country || "").trim();
  if (code || name) {
    return {
      key: code || name.toLowerCase(),
      label: name || code,
      code: code || "??",
    };
  }
  return { key: "unknown", label: "Unknown / no geo", code: "—" };
}

function riskScore(b: CountryBucket): number {
  return b.proxy * 3 + b.hosting * 2 + b.cluster * 2 + b.blocked + b.online;
}

/**
 * IpWorld — quản lý IP theo quốc gia / risk (bổ sung tab IP chi tiết).
 * Không auto-ban cả nước.
 */
export function IpWorldAdminPanel({
  rows,
  busy,
  onRefresh,
  onOpenIpTab,
  onBlockIp,
  onKickIp,
  onOpenHis,
  onMsg,
}: {
  rows: IpWorldRow[];
  busy?: boolean;
  onRefresh: () => void;
  onOpenIpTab: (ipFilter?: string) => void;
  onBlockIp: (ip: string, hours: number) => void;
  onKickIp: (ip: string) => void;
  onOpenHis: (userId: string) => void;
  onMsg: (s: string) => void;
}) {
  const [q, setQ] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selected, setSelected] = useState<WorldKey | null>(null);

  const buckets = useMemo(() => {
    const map = new Map<WorldKey, CountryBucket>();
    for (const row of rows) {
      const { key, label, code } = countryKey(row);
      let b = map.get(key);
      if (!b) {
        b = {
          key,
          label,
          code,
          ips: [],
          online: 0,
          blocked: 0,
          proxy: 0,
          hosting: 0,
          cluster: 0,
          xu24h: 0,
        };
        map.set(key, b);
      }
      b.ips.push(row);
      if (row.online) b.online += 1;
      if (row.blocked) b.blocked += 1;
      if (row.geo?.proxy) b.proxy += 1;
      if (row.geo?.hosting) b.hosting += 1;
      if (row.clusterFlag) b.cluster += 1;
      b.xu24h += row.xu24h ?? 0;
    }
    return [...map.values()].sort(
      (a, b) => riskScore(b) - riskScore(a) || b.ips.length - a.ips.length,
    );
  }, [rows]);

  const filteredBuckets = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return buckets.filter((b) => {
      if (onlineOnly && b.online === 0) return false;
      if (riskOnly && b.proxy + b.hosting + b.cluster + b.blocked === 0)
        return false;
      if (!needle) return true;
      if (
        b.label.toLowerCase().includes(needle) ||
        b.code.toLowerCase().includes(needle)
      )
        return true;
      return b.ips.some(
        (r) =>
          r.ip.includes(needle) ||
          (r.guestCode ?? "").toLowerCase().includes(needle) ||
          r.users.some((u) => u.username.toLowerCase().includes(needle)),
      );
    });
  }, [buckets, q, riskOnly, onlineOnly]);

  const active = selected
    ? (filteredBuckets.find((b) => b.key === selected) ??
      buckets.find((b) => b.key === selected) ??
      null)
    : filteredBuckets[0] ?? null;

  const totals = useMemo(() => {
    return {
      countries: buckets.length,
      ips: rows.length,
      online: rows.filter((r) => r.online).length,
      proxy: rows.filter((r) => r.geo?.proxy).length,
      hosting: rows.filter((r) => r.geo?.hosting).length,
      blocked: rows.filter((r) => r.blocked).length,
    };
  }, [buckets, rows]);

  return (
    <section className="app-panel mt-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">IpWorld · theo quốc gia</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            {totals.countries} vùng · {totals.ips} IP · online {totals.online} ·
            proxy {totals.proxy} · hosting {totals.hosting} · blocked{" "}
            {totals.blocked}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            className="app-btn-ghost !text-[10px]"
            onClick={onRefresh}
          >
            Refresh geo
          </button>
          <button
            type="button"
            className="app-btn-ghost !text-[10px]"
            onClick={() => onOpenIpTab()}
          >
            → Tab IP
          </button>
        </div>
      </div>

      <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
        Kiểm soát theo vùng để học / ops. Không tự khóa cả quốc gia — block từng
        IP. OFAC/geo-policy cần counsel trước khi hard-ban.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Lọc quốc gia / IP / user…"
          className="app-input !py-1.5 text-xs sm:!max-w-xs"
        />
        <button
          type="button"
          onClick={() => setOnlineOnly((v) => !v)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            onlineOnly
              ? "bg-[var(--wood-deep)] text-white"
              : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
          }`}
        >
          Online
        </button>
        <button
          type="button"
          onClick={() => setRiskOnly((v) => !v)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            riskOnly
              ? "bg-rose-700 text-white"
              : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
          }`}
        >
          Risk (proxy/host/cụm)
        </button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,14rem)_1fr]">
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
          {filteredBuckets.length === 0 && (
            <li className="text-[11px] text-[var(--play-muted)]">Không khớp</li>
          )}
          {filteredBuckets.map((b) => {
            const on = active?.key === b.key;
            return (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => setSelected(b.key)}
                  className={`w-full rounded-xl px-2.5 py-2 text-left text-[11px] ring-1 transition ${
                    on
                      ? "bg-[var(--wood-deep)] text-white ring-[var(--wood-deep)]"
                      : "bg-white/80 text-[var(--play-ink)] ring-[var(--wood-deep)]/10 hover:bg-white"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      <span className="font-mono text-[10px] opacity-80">
                        {b.code}
                      </span>{" "}
                      {b.label}
                    </span>
                    <span className={`tabular-nums ${on ? "opacity-90" : ""}`}>
                      {b.ips.length}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block text-[10px] ${
                      on ? "text-white/80" : "text-[var(--play-muted)]"
                    }`}
                  >
                    on {b.online}
                    {b.proxy ? ` · proxy ${b.proxy}` : ""}
                    {b.hosting ? ` · host ${b.hosting}` : ""}
                    {b.cluster ? ` · cụm ${b.cluster}` : ""}
                    {b.blocked ? ` · block ${b.blocked}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="min-w-0">
          {!active ? (
            <p className="text-[11px] text-[var(--play-muted)]">
              Chọn một quốc gia / vùng bên trái.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="play-heading text-sm">
                    {active.code} · {active.label}
                  </p>
                  <p className="text-[10px] text-[var(--play-muted)]">
                    {active.ips.length} IP · stake 24h{" "}
                    {formatXu(active.xu24h)} xu
                  </p>
                </div>
                <button
                  type="button"
                  className="app-btn-ghost !text-[10px]"
                  onClick={() => {
                    onOpenIpTab(active.label === "Local / private" ? "" : active.label);
                    onMsg(`Đã mở tab IP · gợi ý lọc «${active.label}»`);
                  }}
                >
                  Mở trong tab IP
                </button>
              </div>

              <ul className="mt-2 max-h-[62vh] space-y-2 overflow-y-auto">
                {active.ips
                  .slice()
                  .sort(
                    (a, b) =>
                      Number(b.online) - Number(a.online) ||
                      Number(b.clusterFlag) - Number(a.clusterFlag) ||
                      (b.xu24h ?? 0) - (a.xu24h ?? 0),
                  )
                  .map((row) => (
                    <li
                      key={row.ip}
                      className={`rounded-lg px-2.5 py-2 text-[11px] ring-1 ${
                        row.clusterFlag
                          ? "bg-amber-50 ring-amber-400/70"
                          : row.geo?.proxy || row.geo?.hosting
                            ? "bg-rose-50/80 ring-rose-300/60"
                            : "bg-white/70 ring-[var(--wood-deep)]/10"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-bold">
                            {row.ip}
                            {row.online ? (
                              <span className="ml-1 text-emerald-700">
                                · online
                              </span>
                            ) : null}
                            {row.blocked ? (
                              <span className="ml-1 text-rose-700">
                                · blocked
                              </span>
                            ) : null}
                            {row.geo?.proxy ? (
                              <span className="ml-1 text-rose-700">· proxy</span>
                            ) : null}
                            {row.geo?.hosting ? (
                              <span className="ml-1 text-orange-700">
                                · hosting
                              </span>
                            ) : null}
                            {row.clusterFlag ? (
                              <span className="ml-1 rounded bg-amber-500 px-1 text-[9px] font-extrabold uppercase text-[#1a1208]">
                                cụm
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                            {[row.geo?.city, row.geo?.regionName]
                              .filter(Boolean)
                              .join(", ") || "—"}
                            {row.geo?.isp ? ` · ${row.geo.isp}` : ""}
                            {` · ${row.kind}`}
                            {row.guestCode ? ` · ${row.guestCode}` : ""}
                            {` · joins ${row.joinCount ?? 0}`}
                            {` · 24h ${formatXu(row.xu24h ?? 0)}`}
                          </p>
                          {row.users.slice(0, 4).map((u) => (
                            <p
                              key={u.id}
                              className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]"
                            >
                              <span>
                                <span className="font-semibold">
                                  {u.username}
                                </span>{" "}
                                · {u.code} · {formatXu(u.balance)} xu
                              </span>
                              <button
                                type="button"
                                className="rounded-full bg-[var(--wood-deep)] px-2 py-0.5 text-[9px] font-bold text-white"
                                onClick={() => onOpenHis(u.id)}
                              >
                                His
                              </button>
                            </p>
                          ))}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            disabled={busy || !row.online}
                            className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-40"
                            onClick={() => onKickIp(row.ip)}
                          >
                            Kick
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
                            onClick={() =>
                              onBlockIp(row.ip, row.blocked ? 0 : 24)
                            }
                          >
                            {row.blocked ? "Unblock" : "Block 24h"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-[var(--wood-deep)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--wood-deep)]"
                            onClick={() => onOpenIpTab(row.ip)}
                          >
                            Chi tiết
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
