/**
 * Ops: inventory JSON data, local backups, recovery playbook.
 * Backup vẫn cùng volume — off-site (S3/R2) phải cấu hình ngoài app.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { STARTING_BALANCE } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function dataDirPath(): string {
  return join(__dirname, "..", "data");
}

export function backupsDirPath(): string {
  return join(dataDirPath(), "backups");
}

/** Trần client hint khi reconnect (mặc định = STARTING_BALANCE — không farm). */
export function guestClientBalanceCap(): number {
  const raw = Number(process.env.GUEST_CLIENT_BALANCE_CAP);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return STARTING_BALANCE;
}

/** true = bỏ qua guestBalance từ client (server chỉ dùng STARTING / carried). */
export function guestBalanceServerOnly(): boolean {
  const v = String(process.env.GUEST_BALANCE_SERVER_ONLY ?? "1").trim();
  return v !== "0" && v.toLowerCase() !== "false";
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export type DataFileInfo = {
  name: string;
  bytes: number;
  mtimeMs: number;
};

export type BackupInfo = {
  id: string;
  path: string;
  fileCount: number;
  bytes: number;
  mtimeMs: number;
};

export function listDataJsonFiles(): DataFileInfo[] {
  const dir = dataDirPath();
  if (!existsSync(dir)) return [];
  const out: DataFileInfo[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "backups" || !name.endsWith(".json")) continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      out.push({ name, bytes: st.size, mtimeMs: st.mtimeMs });
    } catch {
      /* skip */
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function listLocalBackups(limit = 20): BackupInfo[] {
  const root = backupsDirPath();
  if (!existsSync(root)) return [];
  const out: BackupInfo[] = [];
  for (const id of readdirSync(root)) {
    const full = join(root, id);
    try {
      const st = statSync(full);
      if (!st.isDirectory()) continue;
      let fileCount = 0;
      let bytes = 0;
      for (const f of readdirSync(full)) {
        if (!f.endsWith(".json")) continue;
        const fs = statSync(join(full, f));
        if (fs.isFile()) {
          fileCount += 1;
          bytes += fs.size;
        }
      }
      out.push({
        id,
        path: `server/data/backups/${id}`,
        fileCount,
        bytes,
        mtimeMs: st.mtimeMs,
      });
    } catch {
      /* skip */
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out.slice(0, Math.max(1, Math.min(50, limit)));
}

export function createLocalBackup(opts?: {
  by?: string;
}): { ok: true; backup: BackupInfo } | { ok: false; reason: string } {
  const dir = dataDirPath();
  if (!existsSync(dir)) {
    return { ok: false, reason: "Thiếu thư mục server/data" };
  }
  const id = stamp();
  const dest = join(backupsDirPath(), id);
  try {
    mkdirSync(dest, { recursive: true });
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Không tạo được thư mục backup",
    };
  }

  let fileCount = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    if (name === "backups" || !name.endsWith(".json")) continue;
    const from = join(dir, name);
    try {
      const st = statSync(from);
      if (!st.isFile()) continue;
      copyFileSync(from, join(dest, name));
      fileCount += 1;
      bytes += st.size;
    } catch (e) {
      return {
        ok: false,
        reason: `Copy ${name} thất bại: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  }

  try {
    writeFileSync(
      join(dest, "_meta.json"),
      JSON.stringify(
        {
          createdAt: Date.now(),
          by: opts?.by ?? "system",
          fileCount,
          bytes,
          note: "Local volume only — copy off-site for disaster recovery",
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    /* meta optional */
  }

  if (fileCount === 0) {
    return { ok: false, reason: "Không có file .json để sao lưu" };
  }

  return {
    ok: true,
    backup: {
      id,
      path: `server/data/backups/${id}`,
      fileCount,
      bytes,
      mtimeMs: Date.now(),
    },
  };
}

export type RecoveryStep = {
  id: string;
  title: string;
  detail: string;
  when: "web-ok" | "web-down" | "always";
};

export function recoveryPlaybook(): RecoveryStep[] {
  return [
    {
      id: "ops-page",
      title: "Trang khẩn /ops (khi SPA hỏng)",
      detail:
        "Mở https://YOUR_DOMAIN/ops — trang HTML tĩnh trên server, không cần client/dist. Đăng nhập mainadmin → xem health, backup JSON.",
      when: "web-ok",
    },
    {
      id: "admin-system",
      title: "Admin → tab Hệ thống",
      detail:
        "Khi web còn chạy: Dashboard admin → Hệ thống — quét an ninh, backup, checklist CORS/DB/Redis.",
      when: "web-ok",
    },
    {
      id: "health",
      title: "Probe /health",
      detail:
        "curl https://YOUR_DOMAIN/health — kiểm ready, db.configured, redis.configured dù UI chết.",
      when: "always",
    },
    {
      id: "railway",
      title: "Railway Dashboard (web/API sập hoàn toàn)",
      detail:
        "Vào project Railway → Logs / Metrics / Variables / Volume. Restart service, kiểm mount volume vào server/data, disk đầy, crash loop.",
      when: "web-down",
    },
    {
      id: "volume",
      title: "Xác nhận Volume",
      detail:
        "Volume phải mount đúng path chứa server/data. Quên mount = data ephemeral mất sau redeploy.",
      when: "always",
    },
    {
      id: "local-backup",
      title: "Backup local (cùng volume)",
      detail:
        "npm run backup:data hoặc nút Sao lưu trong /ops & tab Hệ thống. Lưu ý: cùng disk — không cứu được khi volume corrupt.",
      when: "always",
    },
    {
      id: "offsite",
      title: "Off-site S3/R2 (bắt buộc cho thảm họa)",
      detail:
        "Set BACKUP_S3_BUCKET + keys + ENDPOINT (R2). Chạy npm run backup:offsite hoặc Railway Cron `0 3 * * *` với cùng Volume. Giữ BACKUP_KEEP_REMOTE bản (mặc định 14).",
      when: "always",
    },
    {
      id: "cli-restore",
      title: "Khôi phục từ backup local",
      detail:
        "Dừng service → copy file từ server/data/backups/<stamp>/*.json vào server/data/ → start lại. Kiểm /health ready=true.",
      when: "web-down",
    },
  ];
}

export function opsSnapshot() {
  const files = listDataJsonFiles();
  const backups = listLocalBackups(15);
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  return {
    dataDir: "server/data",
    dataDirExists: existsSync(dataDirPath()),
    fileCount: files.length,
    totalBytes,
    files,
    backups,
    latestBackup: backups[0] ?? null,
    guest: {
      serverOnly: guestBalanceServerOnly(),
      clientCap: guestClientBalanceCap(),
      startingBalance: STARTING_BALANCE,
    },
    offsiteHint:
      "Off-site: set BACKUP_S3_* rồi npm run backup:offsite (hoặc Railway Cron 0 3 * * *). Chi tiết README § Backup off-site.",
    offsiteConfigured: Boolean(String(process.env.BACKUP_S3_BUCKET ?? "").trim()),
    playbook: recoveryPlaybook(),
  };
}
