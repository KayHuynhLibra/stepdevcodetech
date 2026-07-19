import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const TTL_MS = 24 * 60 * 60 * 1000;

export interface IpGeoInfo {
  local?: boolean;
  country?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
  query?: string;
}

interface CacheEntry {
  at: number;
  geo: IpGeoInfo;
}

interface CacheFile {
  version: 1;
  entries: Record<string, CacheEntry>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PATH = join(DATA_DIR, "ip-geo-cache.json");
const TMP = join(DATA_DIR, "ip-geo-cache.json.tmp");

const mem = new Map<string, CacheEntry>();
let loaded = false;

function isPrivateOrLocal(ip: string): boolean {
  const s = ip.trim().toLowerCase();
  if (!s || s === "unknown" || s === "::1" || s === "localhost") return true;
  if (s === "127.0.0.1") return true;
  if (s.startsWith("10.")) return true;
  if (s.startsWith("192.168.")) return true;
  if (s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80")) return true;
  const m = /^172\.(\d+)\./.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  // strip IPv4-mapped IPv6
  if (s.startsWith("::ffff:")) {
    return isPrivateOrLocal(s.slice(7));
  }
  return false;
}

function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    if (!existsSync(PATH)) return;
    const parsed = JSON.parse(readFileSync(PATH, "utf8")) as CacheFile;
    if (parsed?.version !== 1 || !parsed.entries) return;
    const now = Date.now();
    for (const [ip, e] of Object.entries(parsed.entries)) {
      if (!e?.geo || now - e.at > TTL_MS) continue;
      mem.set(ip, e);
    }
  } catch (err) {
    console.warn("[ip-geo] Failed to load cache:", err);
  }
}

function saveCache() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const now = Date.now();
    const entries: Record<string, CacheEntry> = {};
    for (const [ip, e] of mem) {
      if (now - e.at > TTL_MS) continue;
      entries[ip] = e;
    }
    writeFileSync(
      TMP,
      JSON.stringify({ version: 1, entries } satisfies CacheFile, null, 2),
      "utf8",
    );
    renameSync(TMP, PATH);
  } catch (err) {
    console.warn("[ip-geo] Failed to save cache:", err);
  }
}

async function fetchFromApi(ip: string): Promise<IpGeoInfo | null> {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,isp,org,as,proxy,hosting,query`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (data.status !== "success") return null;
    return {
      country: typeof data.country === "string" ? data.country : undefined,
      regionName:
        typeof data.regionName === "string" ? data.regionName : undefined,
      city: typeof data.city === "string" ? data.city : undefined,
      isp: typeof data.isp === "string" ? data.isp : undefined,
      org: typeof data.org === "string" ? data.org : undefined,
      as: typeof data.as === "string" ? data.as : undefined,
      proxy: !!data.proxy,
      hosting: !!data.hosting,
      query: typeof data.query === "string" ? data.query : ip,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Resolve geo for one IP (cached 24h). */
export async function lookupIpGeo(ip: string): Promise<IpGeoInfo | null> {
  loadCache();
  const key = String(ip ?? "").trim();
  if (!key) return null;
  if (isPrivateOrLocal(key)) {
    return { local: true, query: key };
  }
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.geo;

  const geo = await fetchFromApi(key);
  if (!geo) return null;
  mem.set(key, { at: Date.now(), geo });
  saveCache();
  return geo;
}

/** Batch lookup with light concurrency. */
export async function lookupIpGeoMany(
  ips: string[],
): Promise<Map<string, IpGeoInfo | null>> {
  const out = new Map<string, IpGeoInfo | null>();
  const unique = [...new Set(ips.map((i) => i.trim()).filter(Boolean))];
  const chunk = 5;
  for (let i = 0; i < unique.length; i += chunk) {
    const batch = unique.slice(i, i + chunk);
    const results = await Promise.all(batch.map((ip) => lookupIpGeo(ip)));
    batch.forEach((ip, idx) => out.set(ip, results[idx] ?? null));
  }
  return out;
}
