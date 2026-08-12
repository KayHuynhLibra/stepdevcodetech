import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, getToken } from "../auth";

type Issue = {
  id: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
};

type BackupInfo = {
  id: string;
  path: string;
  fileCount: number;
  bytes: number;
  mtimeMs: number;
};

type PlaybookStep = {
  id: string;
  title: string;
  detail: string;
  when: "web-ok" | "web-down" | "always";
};

type SystemSecurityPayload = {
  ok: true;
  ts: number;
  summary: {
    ready: boolean;
    issueCount: number;
    critical: number;
    warn: number;
    info: number;
  };
  process: {
    node: string;
    uptimeSec: number;
    pid: number;
    platform: string;
    env: string;
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  };
  network: {
    trustProxy: boolean;
    httpRateMax: number;
    httpRateWindowMs: number;
    allowedOriginsRawCount: number;
    allowedOrigins: string[];
    corsMode: string;
    requireInvite: boolean;
    headers: string[];
  };
  runtime: {
    checks: Record<string, boolean>;
    ready: boolean;
    cards: number;
    phase: string;
    roundNumber: number;
    displayOnline: number;
    clientDist: boolean;
    dataDir: boolean;
    db: { configured: boolean; ok: boolean; [k: string]: unknown };
    redis: { configured: boolean; ok: boolean; [k: string]: unknown };
    scale: { databaseUrl: boolean; redisUrl: boolean; dualWrite: boolean };
  };
  rateLimit: { bucketCount: number; ipSocketGroups: number };
  ops?: {
    emergencyUrl: string;
    dataDir: string;
    dataDirExists: boolean;
    fileCount: number;
    totalBytes: number;
    latestBackup: BackupInfo | null;
    backupCount: number;
      guest: {
      serverOnly: boolean;
      clientCap: number;
      startingBalance: number;
    };
    offsiteHint: string;
    offsiteConfigured?: boolean;
    playbook: PlaybookStep[];
  };
  issues: Issue[];
};

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sevClass(s: Issue["severity"]): string {
  if (s === "critical") return "syssec-issue--critical";
  if (s === "warn") return "syssec-issue--warn";
  return "syssec-issue--info";
}

function sevLabel(s: Issue["severity"]): string {
  if (s === "critical") return "Nghiêm trọng";
  if (s === "warn") return "Cảnh báo";
  return "Thông tin";
}

function whenLabel(w: PlaybookStep["when"]): string {
  if (w === "web-down") return "Web sập";
  if (w === "web-ok") return "Web còn";
  return "Luôn";
}

export function SystemSecurityPanel() {
  const [data, setData] = useState<SystemSecurityPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<SystemSecurityPayload>("/api/admin/system-security");
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tải được");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runBackup = async () => {
    if (
      !window.confirm(
        "Tạo bản sao lưu JSON vào server/data/backups/? (cùng volume — không thay off-site)",
      )
    ) {
      return;
    }
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const r = await api<{
        ok: true;
        backup: BackupInfo;
      }>("/api/admin/system-backup", { method: "POST" });
      setBackupMsg(
        `Đã lưu ${r.backup.id} · ${r.backup.fileCount} file · ${fmtBytes(r.backup.bytes)}`,
      );
      await load();
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : "Backup thất bại");
    } finally {
      setBackupBusy(false);
    }
  };

  const openOps = () => {
    const t = getToken();
    const url = data?.ops?.emergencyUrl || "/ops";
    if (t) {
      try {
        localStorage.setItem("sofiaore_ops_token", t);
      } catch {
        /* ignore */
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="app-panel mt-4 space-y-4 p-3 sm:p-4 syssec">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">An ninh mạng &amp; hệ thống</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Health, CORS, backup, khôi phục khi sập — không lộ secret
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={openOps}
            className="rounded-xl border border-[rgba(58,34,16,0.2)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--play-ink)]"
          >
            Trang /ops
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-xl bg-[var(--wood-deep)] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-45"
          >
            {busy ? "Đang quét…" : "Quét lại"}
          </button>
        </div>
      </div>

      {err ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
          {err}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Ready"
              value={data.summary.ready ? "OK" : "FAIL"}
              tone={data.summary.ready ? "ok" : "bad"}
            />
            <Stat
              label="Critical"
              value={String(data.summary.critical)}
              tone={data.summary.critical ? "bad" : "ok"}
            />
            <Stat
              label="Warn"
              value={String(data.summary.warn)}
              tone={data.summary.warn ? "warn" : "ok"}
            />
            <Stat label="Info" value={String(data.summary.info)} tone="muted" />
          </div>

          {data.ops ? (
            <div className="syssec-ops">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="play-heading text-xs">Backup &amp; khi web sập</p>
                  <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
                    Data: <code>{data.ops.dataDir}</code> ·{" "}
                    {data.ops.fileCount} file · {fmtBytes(data.ops.totalBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() => void runBackup()}
                  className="rounded-xl bg-amber-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-45"
                >
                  {backupBusy ? "Đang sao lưu…" : "Sao lưu JSON"}
                </button>
              </div>
              {backupMsg ? (
                <p className="mt-2 text-[11px] font-semibold text-[var(--play-ink)]">
                  {backupMsg}
                </p>
              ) : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Row
                  k="Backup gần nhất"
                  v={
                    data.ops.latestBackup
                      ? `${data.ops.latestBackup.id} (${fmtBytes(data.ops.latestBackup.bytes)})`
                      : "Chưa có"
                  }
                  bad={!data.ops.latestBackup}
                />
                <Row
                  k="Số bản local"
                  v={String(data.ops.backupCount)}
                />
                <Row
                  k="Guest balance"
                  v={
                    data.ops.guest.serverOnly
                      ? "server-only"
                      : `client ≤ ${data.ops.guest.clientCap.toLocaleString("vi-VN")}`
                  }
                />
                <Row
                  k="Trang khẩn"
                  v={data.ops.emergencyUrl}
                />
                <Row
                  k="Off-site S3/R2"
                  v={data.ops.offsiteConfigured ? "đã set BACKUP_S3_BUCKET" : "chưa cấu hình"}
                  bad={!data.ops.offsiteConfigured}
                />
              </div>
              <p className="mt-2 text-[10px] text-[var(--play-muted)]">
                {data.ops.offsiteHint}
              </p>
              <ul className="mt-2 space-y-1.5">
                {data.ops.playbook.map((s) => (
                  <li key={s.id} className="syssec-play">
                    <span className="syssec-play__when">{whenLabel(s.when)}</span>
                    <strong className="text-[11px]">{s.title}</strong>
                    <p className="text-[10px] opacity-90">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="play-heading text-xs">Vấn đề phát hiện</p>
            {data.issues.length === 0 ? (
              <p className="mt-1 text-[11px] text-[var(--play-muted)]">
                Không có cảnh báo — hệ thống ổn.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.issues.map((i) => (
                  <li key={i.id} className={`syssec-issue ${sevClass(i.severity)}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="syssec-issue__badge">
                        {sevLabel(i.severity)}
                      </span>
                      <strong className="text-xs">{i.title}</strong>
                    </div>
                    <p className="mt-1 text-[11px] opacity-90">{i.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Block title="Process">
              <Row k="Env" v={data.process.env} />
              <Row k="Node" v={data.process.node} />
              <Row k="Uptime" v={fmtUptime(data.process.uptimeSec)} />
              <Row
                k="RAM"
                v={`${data.process.memory.heapUsedMb}/${data.process.memory.heapTotalMb} MB heap · ${data.process.memory.rssMb} RSS`}
              />
              <Row k="PID" v={String(data.process.pid)} />
            </Block>

            <Block title="Mạng / bảo mật">
              <Row k="CORS" v={data.network.corsMode} />
              <Row
                k="Origins"
                v={
                  data.network.allowedOrigins.length
                    ? data.network.allowedOrigins.join(", ")
                    : "(mở / chưa set)"
                }
              />
              <Row
                k="HTTP rate"
                v={`${data.network.httpRateMax} / ${data.network.httpRateWindowMs / 1000}s`}
              />
              <Row
                k="Invite"
                v={data.network.requireInvite ? "Bắt buộc" : "Tắt"}
              />
              <Row
                k="Headers"
                v={data.network.headers.slice(0, 3).join(", ") + "…"}
              />
            </Block>

            <Block title="Runtime checks">
              {Object.entries(data.runtime.checks).map(([k, ok]) => (
                <Row key={k} k={k} v={ok ? "OK" : "FAIL"} bad={!ok} />
              ))}
              <Row k="Phase" v={`${data.runtime.phase} #${data.runtime.roundNumber}`} />
              <Row k="Online (display)" v={String(data.runtime.displayOnline)} />
            </Block>

            <Block title="DB / Redis / rate">
              <Row
                k="DB"
                v={
                  data.runtime.db.configured
                    ? data.runtime.db.ok
                      ? "configured · OK"
                      : "configured · FAIL"
                    : "off"
                }
                bad={data.runtime.db.configured && !data.runtime.db.ok}
              />
              <Row
                k="Redis"
                v={
                  data.runtime.redis.configured
                    ? data.runtime.redis.ok
                      ? "configured · OK"
                      : "configured · FAIL"
                    : "off"
                }
                bad={data.runtime.redis.configured && !data.runtime.redis.ok}
              />
              <Row
                k="Dual-write"
                v={data.runtime.scale.dualWrite ? "on" : "off"}
              />
              <Row k="Rate buckets" v={String(data.rateLimit.bucketCount)} />
              <Row
                k="Socket IP groups"
                v={String(data.rateLimit.ipSocketGroups)}
              />
            </Block>
          </div>

          <p className="text-[10px] text-[var(--play-muted)]">
            Cập nhật {new Date(data.ts).toLocaleString("vi-VN")} ·{" "}
            <code>/api/admin/system-security</code> · khẩn{" "}
            <code>{data.ops?.emergencyUrl ?? "/ops"}</code>
          </p>
        </>
      ) : !err && busy ? (
        <p className="text-xs text-[var(--play-muted)]">Đang quét hệ thống…</p>
      ) : null}

      <style>{`
        .syssec-issue {
          border-radius: 0.65rem;
          padding: 0.55rem 0.7rem;
          border: 1px solid rgba(58, 34, 16, 0.12);
          background: #fffaf3;
        }
        .syssec-issue--critical {
          background: #fff1f0;
          border-color: #f5c2c0;
        }
        .syssec-issue--warn {
          background: #fff8e8;
          border-color: #f0d090;
        }
        .syssec-issue--info {
          background: #f4f7fb;
          border-color: #c5d4e8;
        }
        .syssec-issue__badge {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.1rem 0.35rem;
          border-radius: 999px;
          background: rgba(0,0,0,0.08);
        }
        .syssec-ops {
          border-radius: 0.75rem;
          padding: 0.75rem 0.85rem;
          border: 1px solid rgba(146, 64, 14, 0.25);
          background: linear-gradient(180deg, #fff7ed, #fffaf3);
        }
        .syssec-play {
          border-radius: 0.5rem;
          padding: 0.4rem 0.55rem;
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(58, 34, 16, 0.08);
        }
        .syssec-play__when {
          display: inline-block;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-right: 0.35rem;
          padding: 0.05rem 0.3rem;
          border-radius: 999px;
          background: rgba(92, 51, 16, 0.12);
        }
        .syssec-stat {
          border-radius: 0.65rem;
          padding: 0.55rem 0.65rem;
          background: rgba(58, 34, 16, 0.04);
          border: 1px solid rgba(58, 34, 16, 0.1);
        }
        .syssec-stat__label {
          font-size: 10px;
          font-weight: 700;
          opacity: 0.65;
        }
        .syssec-stat__value {
          font-size: 1.05rem;
          font-weight: 800;
          margin-top: 0.15rem;
        }
        .syssec-stat--ok .syssec-stat__value { color: #1b7a3d; }
        .syssec-stat--bad .syssec-stat__value { color: #b42318; }
        .syssec-stat--warn .syssec-stat__value { color: #b54708; }
        .syssec-block {
          border-radius: 0.65rem;
          padding: 0.65rem 0.75rem;
          background: #fff;
          border: 1px solid rgba(58, 34, 16, 0.12);
        }
        .syssec-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 11px;
          padding: 0.2rem 0;
          border-bottom: 1px dashed rgba(58, 34, 16, 0.08);
        }
        .syssec-row:last-child { border-bottom: 0; }
        .syssec-row__k { font-weight: 700; opacity: 0.7; flex-shrink: 0; }
        .syssec-row__v { text-align: right; word-break: break-word; }
        .syssec-row--bad .syssec-row__v { color: #b42318; font-weight: 800; }
      `}</style>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "warn" | "muted";
}) {
  return (
    <div className={`syssec-stat syssec-stat--${tone}`}>
      <div className="syssec-stat__label">{label}</div>
      <div className="syssec-stat__value">{value}</div>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="syssec-block">
      <p className="play-heading text-xs mb-1">{title}</p>
      {children}
    </div>
  );
}

function Row({
  k,
  v,
  bad,
}: {
  k: string;
  v: string;
  bad?: boolean;
}) {
  return (
    <div className={`syssec-row ${bad ? "syssec-row--bad" : ""}`}>
      <span className="syssec-row__k">{k}</span>
      <span className="syssec-row__v">{v}</span>
    </div>
  );
}
