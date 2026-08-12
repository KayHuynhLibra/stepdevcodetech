#!/usr/bin/env node
/**
 * Backup off-site (S3-compatible: AWS S3 / Cloudflare R2 / MinIO).
 *
 * 1) Sao lưu local → server/data/backups/<stamp>/  (trừ khi BACKUP_SKIP_LOCAL=1)
 * 2) Upload server/data/*.json lên bucket: <prefix>/<stampUtc>/
 * 3) Giữ BACKUP_KEEP_REMOTE bản gần nhất (mặc định 14)
 *
 * Env:
 *   BACKUP_S3_BUCKET              (bắt buộc)
 *   BACKUP_S3_ACCESS_KEY_ID       (bắt buộc)
 *   BACKUP_S3_SECRET_ACCESS_KEY   (bắt buộc)
 *   BACKUP_S3_ENDPOINT            R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *   BACKUP_S3_REGION              mặc định auto (R2) hoặc us-east-1
 *   BACKUP_S3_PREFIX              mặc định sofiaore-data
 *   BACKUP_KEEP_REMOTE            mặc định 14
 *   BACKUP_SKIP_LOCAL=1           bỏ bước copy local
 *
 * Chạy: npm run backup:offsite
 * Railway Cron (mount cùng volume vào server/data):
 *   node server/scripts/backup-offsite.mjs
 */
import {
  createHash,
  createHmac,
} from "crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const BACKUPS_DIR = join(DATA_DIR, "backups");

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function mustEnv(name) {
  const v = env(name);
  if (!v) {
    console.error(`[backup:offsite] Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

function stampUtc() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function amzDate(d = new Date()) {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso, day: iso.slice(0, 8) };
}

function encodeKeyPath(key) {
  return key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
}

function signingKey(secret, day, region) {
  const kDate = hmac(`AWS4${secret}`, day);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

async function s3Request({
  method,
  endpoint,
  region,
  bucket,
  key = "",
  query = "",
  body,
  accessKeyId,
  secretAccessKey,
  contentType,
}) {
  const host = new URL(endpoint).host;
  const { amz, day } = amzDate();
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const canonicalUri = key
    ? `/${bucket}/${encodeKeyPath(key)}`
    : `/${bucket}`;
  const canonicalQuery = query;
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (contentType) headers["content-type"] = contentType;
  if (method === "PUT" || method === "POST") {
    headers["content-length"] = String(payload.length);
  }

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((n) => `${n}:${headers[n]}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, day, region))
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const path = key
    ? `/${bucket}/${encodeKeyPath(key)}`
    : `/${bucket}`;
  const url =
    `${endpoint.replace(/\/$/, "")}${path}` +
    (canonicalQuery ? `?${canonicalQuery}` : "");

  const res = await fetch(url, {
    method,
    headers: {
      ...Object.fromEntries(
        Object.entries(headers).map(([k, v]) => {
          if (k === "host") return ["Host", v];
          if (k === "content-type") return ["Content-Type", v];
          if (k === "content-length") return ["Content-Length", v];
          if (k === "x-amz-content-sha256") return ["X-Amz-Content-Sha256", v];
          if (k === "x-amz-date") return ["X-Amz-Date", v];
          return [k, v];
        }),
      ),
      Authorization: authorization,
    },
    body: method === "GET" || method === "DELETE" ? undefined : payload,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok && !(method === "DELETE" && res.status === 204)) {
    throw new Error(`S3 ${method} ${key || query} → ${res.status} ${text.slice(0, 400)}`);
  }
  return text;
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && name !== "backups")
    .map((name) => {
      const full = join(dir, name);
      try {
        const st = statSync(full);
        return st.isFile() ? { name, full, bytes: st.size } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function latestLocalBackupId() {
  if (!existsSync(BACKUPS_DIR)) return null;
  const dirs = readdirSync(BACKUPS_DIR)
    .map((name) => {
      const full = join(BACKUPS_DIR, name);
      try {
        const st = statSync(full);
        return st.isDirectory() ? { name, m: st.mtimeMs } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.m - a.m);
  return dirs[0]?.name ?? null;
}

function parseXmlTags(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, "g");
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

async function pruneRemote(cfg, keep) {
  const prefix = `${cfg.prefix}/`;
  const qs = new URLSearchParams({
    "list-type": "2",
    prefix,
    delimiter: "/",
  });
  const canonicalQuery = [...qs.entries()]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");
  const xml = await s3Request({
    method: "GET",
    endpoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    query: canonicalQuery,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  });
  const stamps = parseXmlTags(xml, "Prefix")
    .map((p) => p.replace(prefix, "").replace(/\/$/, ""))
    .filter((p) => p && p !== cfg.prefix)
    .sort()
    .reverse();
  const drop = stamps.slice(keep);
  for (const id of drop) {
    const listQs = new URLSearchParams({
      "list-type": "2",
      prefix: `${prefix}${id}/`,
    });
    const listQuery = [...listQs.entries()]
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join("&");
    const listXml = await s3Request({
      method: "GET",
      endpoint: cfg.endpoint,
      region: cfg.region,
      bucket: cfg.bucket,
      query: listQuery,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    });
    for (const key of parseXmlTags(listXml, "Key")) {
      await s3Request({
        method: "DELETE",
        endpoint: cfg.endpoint,
        region: cfg.region,
        bucket: cfg.bucket,
        key,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      });
      console.log(`[backup:offsite] pruned ${key}`);
    }
  }
}

async function main() {
  const bucket = env("BACKUP_S3_BUCKET");
  if (!bucket) {
    console.error(
      "[backup:offsite] Set BACKUP_S3_BUCKET + ACCESS_KEY + SECRET (+ ENDPOINT for R2).",
    );
    console.error("  Xem README § Backup off-site.");
    process.exit(1);
  }

  const cfg = {
    bucket,
    accessKeyId: mustEnv("BACKUP_S3_ACCESS_KEY_ID"),
    secretAccessKey: mustEnv("BACKUP_S3_SECRET_ACCESS_KEY"),
    endpoint: env("BACKUP_S3_ENDPOINT", "https://s3.us-east-1.amazonaws.com"),
    region: env("BACKUP_S3_REGION", "auto"),
    prefix: env("BACKUP_S3_PREFIX", "sofiaore-data").replace(/^\/+|\/+$/g, ""),
  };
  const keep = Math.max(1, Number(env("BACKUP_KEEP_REMOTE", "14")) || 14);
  const skipLocal = env("BACKUP_SKIP_LOCAL") === "1";
  const id = stampUtc();

  if (!skipLocal) {
    const localScript = join(__dirname, "backup-data.mjs");
    const r = spawnSync(process.execPath, [localScript], {
      stdio: "inherit",
      env: process.env,
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }

  const localId = latestLocalBackupId() || id;
  const files = listJsonFiles(DATA_DIR);
  if (files.length === 0) {
    console.error("[backup:offsite] No *.json in", DATA_DIR);
    process.exit(1);
  }

  console.log(
    `[backup:offsite] upload ${files.length} files → s3://${cfg.bucket}/${cfg.prefix}/${id}/`,
  );

  for (const f of files) {
    const body = readFileSync(f.full);
    const key = `${cfg.prefix}/${id}/${f.name}`;
    await s3Request({
      method: "PUT",
      endpoint: cfg.endpoint,
      region: cfg.region,
      bucket: cfg.bucket,
      key,
      body,
      contentType: "application/json",
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    });
    console.log(`[backup:offsite] ok ${key} (${f.bytes} B)`);
  }

  const meta = Buffer.from(
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        localBackupId: localId,
        fileCount: files.length,
        host:
          process.env.RAILWAY_PUBLIC_DOMAIN ||
          process.env.PUBLIC_ORIGIN ||
          "",
      },
      null,
      2,
    ),
    "utf8",
  );
  await s3Request({
    method: "PUT",
    endpoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    key: `${cfg.prefix}/${id}/_meta.json`,
    body: meta,
    contentType: "application/json",
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  });

  try {
    await pruneRemote(cfg, keep);
  } catch (e) {
    console.warn(
      "[backup:offsite] prune skipped:",
      e instanceof Error ? e.message : e,
    );
  }

  console.log(`[backup:offsite] done remote=${cfg.prefix}/${id} keep=${keep}`);
}

main().catch((e) => {
  console.error("[backup:offsite] failed:", e);
  process.exit(1);
});
