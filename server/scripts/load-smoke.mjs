#!/usr/bin/env node
/** Smoke load: GET /health N times. Usage: node server/scripts/load-smoke.mjs [baseUrl] [n] */
const base = process.argv[2] || "http://127.0.0.1:3001";
const n = Math.min(500, Math.max(1, Number(process.argv[3]) || 50));
const t0 = Date.now();
let ok = 0;
let fail = 0;
const lat = [];
for (let i = 0; i < n; i++) {
  const a = Date.now();
  try {
    const r = await fetch(`${base}/health`);
    lat.push(Date.now() - a);
    if (r.ok) ok++;
    else fail++;
  } catch {
    fail++;
    lat.push(Date.now() - a);
  }
}
lat.sort((x, y) => x - y);
const p95 = lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] ?? 0;
console.log(
  JSON.stringify(
    {
      base,
      n,
      ok,
      fail,
      totalMs: Date.now() - t0,
      p50: lat[Math.floor(lat.length * 0.5)] ?? 0,
      p95,
      max: lat[lat.length - 1] ?? 0,
    },
    null,
    2,
  ),
);
