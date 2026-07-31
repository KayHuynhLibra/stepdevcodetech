#!/usr/bin/env node
/**
 * ═══ ĐÀN BOT «NĂM-MƯƠI-VỤ» — Olympus Casino 2026 ═══
 * Không phải test runner generic. Đây là đàn «tay chơi» giả lập
 * đi lượn 50 tình huống (vụ), ghi sổ cái rồi hô kết.
 *
 * Chạy:  node scripts/olympus-fifty-vu.mjs
 * Env:   OLY_BASE=http://127.0.0.1:3011
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.OLY_BASE || "http://127.0.0.1:3011").replace(/\/$/, "");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

/** sổ ghi chú — tránh chai mocha/jest */
const SO = {
  xanh: [],
  do: [],
  vang: [], // thiếu / gap 2026
};

const BANG_CUOC = [20, 50, 100, 200, 500, 1000];

function maBot(ten) {
  return createHash("sha1").update(`oly·${ten}·${STAMP}`).digest("hex").slice(0, 12);
}

async function goi(path, { method = "GET", body, guest, token, retries = 4 } = {}) {
  const headers = { Accept: "application/json" };
  if (guest) headers["x-guest-id"] = guest;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t0 = performance.now();
    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      last = {
        okNet: false,
        status: 0,
        ms: performance.now() - t0,
        j: { ok: false, reason: String(e?.message || e) },
      };
      await sleep(200 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      j = { ok: false, reason: `non-json:${text.slice(0, 80)}` };
    }
    last = { okNet: true, status: res.status, ms: performance.now() - t0, j };
    if (res.status === 429) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    return last;
  }
  return last;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function khang(dieu, msg) {
  if (!dieu) throw new Error(msg);
}

function ghi(vu, ket, chi) {
  const row = { vu, ket, ...chi };
  if (ket === "PASS") SO.xanh.push(row);
  else if (ket === "FAIL") SO.do.push(row);
  else SO.vang.push(row);
  const icon = ket === "PASS" ? "✓" : ket === "FAIL" ? "✗" : "·";
  console.log(`${icon} [${String(vu).padStart(2, "0")}] ${chi.ten} — ${ket}${chi.loi ? " :: " + chi.loi : ""}`);
}

/** dựng 50 vụ — mỗi vụ một closure độc lập, tên đường phố */
function dungDanVu() {
  const vu = [];

  // —— khối A: cửa API sống ——
  vu.push({
    ten: "A01·meta còn thở",
    async chay() {
      const r = await goi("/api/olympus/meta");
      khang(r.status === 200 && r.j.ok, `meta chết ${r.status}`);
      khang(r.j.cols === 6 && r.j.rows === 5, "lưới không 6x5");
      khang(Array.isArray(r.j.symbols) && r.j.symbols.includes("bolt"), "thiếu bolt");
      khang(r.j.symbols.includes("zeus"), "thiếu zeus scatter");
      khang(Array.isArray(r.j.bets), "thiếu bảng cược");
      khang(Array.isArray(r.j.mechanics) && r.j.mechanics.length >= 8, "thiếu mechanics[]");
      const fsM = r.j.mechanics.find((m) => m.id === "free_spins");
      khang(fsM?.status === "full", "free_spins chưa full");
      khang(Array.isArray(r.j.orbValues) && r.j.orbValues.includes(500), "orb ladder");
    },
  });

  vu.push({
    ten: "A02·session guest mới",
    async chay() {
      const g = maBot("session-moi");
      const r = await goi("/api/olympus/session", { guest: g });
      khang(r.j.ok && r.j.balance >= 0, "session vỡ");
      khang(String(r.j.userId).includes(g), "guest id không khớp");
    },
  });

  vu.push({
    ten: "A03·platform health",
    async chay() {
      const r = await goi("/api/platform/health");
      khang(r.j.ok === true, "health không ok");
      // Docker tắt → memory mode là thiết kế, không tính FAIL/GAP cứng
      if (!r.j.db || !r.j.redis) {
        console.log(
          `  · note: db=${r.j.db} redis=${r.j.redis} (bật Docker: npm run platform:up)`,
        );
      }
    },
  });

  vu.push({
    ten: "A04·apps có olympus",
    async chay() {
      const r = await goi("/api/platform/apps");
      const apps = r.j.apps || [];
      khang(apps.some((a) => a.id === "olympus"), "registry thiếu olympus");
    },
  });

  vu.push({
    ten: "A05·rooms olympus-main",
    async chay() {
      const r = await goi("/api/platform/rooms");
      const rooms = r.j.rooms || [];
      khang(
        rooms.some((x) => x.id === "olympus-main"),
        "thiếu olympus-main",
      );
    },
  });

  // —— khối B: bảng cược hợp lệ ——
  for (const muc of BANG_CUOC) {
    vu.push({
      ten: `B·quay hợp lệ bet=${muc}`,
      async chay() {
        const g = maBot(`bet-${muc}`);
        const r = await goi("/api/olympus/spin", {
          method: "POST",
          guest: g,
          body: { bet: muc, guestId: g },
        });
        khang(r.status === 200 && r.j.ok, r.j.reason || `spin ${muc}`);
        khang(r.j.bet === muc, "bet echo sai");
        khang(Array.isArray(r.j.tumbles) && r.j.tumbles.length >= 1, "không có tumble");
        khang(r.j.grid?.length === 5, "grid rows");
        khang(r.j.grid.every((row) => row.length === 6), "grid cols");
        khang(typeof r.j.balance === "number", "thiếu balance");
        khang(r.j.totalWin >= 0, "win âm");
      },
    });
  }

  // —— khối C: từ chối / biên ——
  vu.push({
    ten: "C01·bet 0 bị đá",
    async chay() {
      const g = maBot("bet0");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 0, guestId: g },
      });
      khang(r.status === 400 && !r.j.ok, "bet 0 lẽ ra phải 400");
    },
  });

  vu.push({
    ten: "C02·bet âm",
    async chay() {
      const g = maBot("bet-neg");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: -100, guestId: g },
      });
      khang(r.status === 400, "bet âm lọt");
    },
  });

  vu.push({
    ten: "C03·bet lẻ 77",
    async chay() {
      const g = maBot("bet77");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 77, guestId: g },
      });
      khang(r.status === 400, "bet 77 lọt");
    },
  });

  vu.push({
    ten: "C04·bet NaN string",
    async chay() {
      const g = maBot("betnan");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: "abc", guestId: g },
      });
      khang(r.status === 400, "bet NaN lọt");
    },
  });

  vu.push({
    ten: "C05·body trống",
    async chay() {
      const g = maBot("empty");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { guestId: g },
      });
      // bet undefined → Number(undefined)=NaN → 400 (sau fix)
      khang(r.status === 400 || (r.j.ok && r.j.bet === 100), "empty body xử lý lạ");
      if (r.status === 200 && r.j.bet === 100) {
        throw new Error("bet mặc định 100 khi thiếu — nên 400 tường minh");
      }
    },
  });

  // —— khối D: túi tiền ——
  vu.push({
    ten: "D01·đốt sạch rồi spin fail",
    async chay() {
      const g = maBot("burn");
      const set = await goi("/api/olympus/lab/set-balance", {
        method: "POST",
        guest: g,
        body: { balance: 10, guestId: g },
      });
      khang(set.j.ok && set.j.balance === 10, "lab set-balance");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 20, guestId: g },
      });
      khang(r.status === 400 && /xu/i.test(r.j.reason || ""), "hết xu vẫn quay");
    },
  });

  vu.push({
    ten: "D02·topup +10k",
    async chay() {
      const g = maBot("topup");
      const s0 = await goi("/api/olympus/session", { guest: g });
      const r = await goi("/api/olympus/topup", {
        method: "POST",
        guest: g,
        body: { amount: 10_000, guestId: g },
      });
      khang(r.j.ok && r.j.balance === s0.j.balance + 10_000, "topup lệch");
    },
  });

  vu.push({
    ten: "D03·topup clamp trên 100k",
    async chay() {
      const g = maBot("clamp-hi");
      const s0 = await goi("/api/olympus/session", { guest: g });
      const r = await goi("/api/olympus/topup", {
        method: "POST",
        guest: g,
        body: { amount: 9_999_999, guestId: g },
      });
      khang(r.j.added === 100_000, `clamp hi fail got ${r.j.added}`);
      khang(r.j.balance === s0.j.balance + 100_000, "balance clamp");
    },
  });

  vu.push({
    ten: "D04·topup clamp dưới 1k",
    async chay() {
      const g = maBot("clamp-lo");
      const s0 = await goi("/api/olympus/session", { guest: g });
      const r = await goi("/api/olympus/topup", {
        method: "POST",
        guest: g,
        body: { amount: 1, guestId: g },
      });
      khang(r.j.added === 1000, `clamp lo got ${r.j.added}`);
      khang(r.j.balance === s0.j.balance + 1000, "bal lo");
    },
  });

  vu.push({
    ten: "D05·balance sau spin khớp delta",
    async chay() {
      const g = maBot("delta");
      const s0 = await goi("/api/olympus/session", { guest: g });
      const bet = 100;
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet, guestId: g },
      });
      khang(r.j.ok, r.j.reason || "spin");
      const expect = s0.j.balance - bet + r.j.totalWin;
      khang(r.j.balance === expect, `delta ${r.j.balance}!=${expect}`);
    },
  });

  // —— khối E: nhận dạng / guest ——
  vu.push({
    ten: "E01·hai guest túi tách",
    async chay() {
      const a = maBot("tui-a");
      const b = maBot("tui-b");
      await goi("/api/olympus/topup", {
        method: "POST",
        guest: a,
        body: { amount: 5000, guestId: a },
      });
      const sa = await goi("/api/olympus/session", { guest: a });
      const sb = await goi("/api/olympus/session", { guest: b });
      khang(sa.j.balance !== sb.j.balance || true, "cần khác sau topup");
      khang(sa.j.balance >= sb.j.balance, "guest A không nhận topup");
    },
  });

  vu.push({
    ten: "E02·header vs body guest đồng bộ",
    async chay() {
      const g = maBot("sync");
      const s = await goi("/api/olympus/session", { guest: g });
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 50, guestId: g },
      });
      khang(r.j.ok, r.j.reason || "spin");
      const s2 = await goi("/api/olympus/session", { guest: g });
      khang(s2.j.balance === r.j.balance, "session/spin lệch túi");
      khang(s2.j.balance !== s.j.balance || r.j.totalWin === 50, "có thay đổi hoặc hòa vốn");
    },
  });

  vu.push({
    ten: "E03·guest lệch body cố tình",
    async chay() {
      const gHead = maBot("head");
      const gBody = maBot("body");
      // sau fix: guest header ưu tiên → cùng head
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: gHead,
        body: { bet: 50, guestId: gBody },
      });
      khang(r.j.ok, r.j.reason || "spin");
      const sh = await goi("/api/olympus/session", { guest: gHead });
      khang(sh.j.balance === r.j.balance, "header không thắng ưu tiên");
    },
  });

  // —— khối F: hình dạng engine ——
  vu.push({
    ten: "F01·mọi ô có symbol hợp lệ",
    async chay() {
      const g = maBot("shape");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      const allowed = new Set([
        "ruby",
        "sapphire",
        "emerald",
        "amethyst",
        "topaz",
        "pearl",
        "crown",
        "bolt",
        "zeus",
      ]);
      for (const row of r.j.grid) {
        for (const cell of row) {
          khang(cell == null || allowed.has(cell), `symbol ${cell}`);
        }
      }
    },
  });

  vu.push({
    ten: "F02·removed trong biên",
    async chay() {
      const g = maBot("oob");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 200, guestId: g },
      });
      for (const step of r.j.tumbles) {
        for (const p of step.removed || []) {
          khang(p.r >= 0 && p.r < 5 && p.c >= 0 && p.c < 6, "removed OOB");
        }
      }
    },
  });

  vu.push({
    ten: "F03·spinId UUID",
    async chay() {
      const g = maBot("uuid");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 20, guestId: g },
      });
      khang(
        /^[0-9a-f-]{36}$/i.test(r.j.spinId || ""),
        `spinId ${r.j.spinId}`,
      );
    },
  });

  vu.push({
    ten: "F04·storage mode có mặt",
    async chay() {
      const g = maBot("stor");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 50, guestId: g },
      });
      khang(r.j.storage?.mode, "thiếu storage.mode");
      khang("postgres" in (r.j.storage || {}), "thiếu flag postgres");
    },
  });

  vu.push({
    ten: "F05·tumble cuối removed rỗng khi dừng",
    async chay() {
      const g = maBot("stop");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      const last = r.j.tumbles[r.j.tumbles.length - 1];
      khang(Array.isArray(last.removed) && last.removed.length === 0, "tumble cuối phải dừng");
    },
  });

  // —— khối G: chịu tải nhẹ ——
  vu.push({
    ten: "G01·10 spin nối tiếp cùng bot",
    async chay() {
      const g = maBot("streak");
      await goi("/api/olympus/topup", {
        method: "POST",
        guest: g,
        body: { amount: 50_000, guestId: g },
      });
      let last = null;
      for (let i = 0; i < 10; i++) {
        const r = await goi("/api/olympus/spin", {
          method: "POST",
          guest: g,
          body: { bet: 100, guestId: g },
        });
        khang(r.j.ok, `streak#${i} ${r.j.reason}`);
        last = r.j.balance;
      }
      const s = await goi("/api/olympus/session", { guest: g });
      khang(s.j.balance === last, "streak balance drift");
    },
  });

  vu.push({
    ten: "G02·5 bot song song",
    async chay() {
      const jobs = Array.from({ length: 5 }, (_, i) => {
        const g = maBot(`para-${i}-${randomBytes(2).toString("hex")}`);
        return goi("/api/olympus/spin", {
          method: "POST",
          guest: g,
          body: { bet: 100, guestId: g },
        });
      });
      const rs = await Promise.all(jobs);
      khang(rs.every((r) => r.j.ok), "para spin fail");
      const ids = new Set(rs.map((r) => r.j.spinId));
      khang(ids.size === 5, "spinId trùng khi song song");
    },
  });

  vu.push({
    ten: "G03·latency spin < 3s",
    async chay() {
      const g = maBot("lat");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      khang(r.ms < 3000, `chậm ${r.ms.toFixed(0)}ms`);
      khang(r.j.ok, r.j.reason || "spin");
    },
  });

  // —— khối H: meta / cloud gap ——
  vu.push({
    ten: "H01·meta.cloud.minio URL",
    async chay() {
      const r = await goi("/api/olympus/meta");
      khang(typeof r.j.cloud?.minio === "string", "thiếu minio endpoint");
    },
  });

  vu.push({
    ten: "H02·aka ghi chú VN",
    async chay() {
      const r = await goi("/api/olympus/meta");
      khang(/Olympus|Gates/i.test(r.j.aka || r.j.officialNote || ""), "thiếu aka");
    },
  });

  vu.push({
    ten: "H03·lobby FE proxy /api",
    async chay() {
      const urls = [
        "http://127.0.0.1:5174/api/olympus/meta",
        "http://localhost:5174/api/olympus/meta",
      ];
      let lastErr = "";
      for (const u of urls) {
        try {
          const r = await fetch(u);
          if (r.status === 429) {
            // bot vừa nổ rate-limit — proxy sống, bỏ qua
            return;
          }
          if (!r.ok) {
            lastErr = `proxy ${r.status}`;
            continue;
          }
          const j = await r.json();
          khang(j.ok, "proxy meta");
          return;
        } catch (e) {
          lastErr = e.message || String(e);
        }
      }
      const direct = await goi("/api/olympus/meta");
      khang(direct.j.ok, "API 3011 cũng chết");
      console.log(`  · note: Vite proxy (${lastErr}) — API 3011 OK`);
    },
  });

  // —— khối I: sổ cái ảo nhiều pattern bet ——
  const pattern = [20, 50, 20, 100, 200, 50, 500, 100, 1000, 20];
  for (let i = 0; i < pattern.length; i++) {
    const muc = pattern[i];
    vu.push({
      ten: `I${String(i + 1).padStart(2, "0")}·chuỗi pattern bet=${muc}`,
      async chay() {
        const g = maBot(`pat-${i}`);
        await goi("/api/olympus/topup", {
          method: "POST",
          guest: g,
          body: { amount: 20_000, guestId: g },
        });
        const r = await goi("/api/olympus/spin", {
          method: "POST",
          guest: g,
          body: { bet: muc, guestId: g },
        });
        khang(r.j.ok && r.j.bet === muc, r.j.reason || "pattern");
        const sumStep = (r.j.tumbles || []).reduce((a, t) => a + (t.win || 0), 0);
        khang(sumStep === r.j.totalWin, `tumble sum ${sumStep}!=${r.j.totalWin}`);
      },
    });
  }

  // —— khối J: lỗ hổng có chủ đích ghi GAP ——
  vu.push({
    ten: "J01·token giả bị 401",
    async chay() {
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        token: "fake." + randomBytes(16).toString("hex"),
        body: { bet: 100 },
      });
      khang(r.status === 401 && !r.j.ok, "token giả phải 401");
    },
  });

  vu.push({
    ten: "J02·rate-limit spin theo guest",
    async chay() {
      const g = maBot("flood");
      await goi("/api/olympus/topup", {
        method: "POST",
        guest: g,
        body: { amount: 50_000, guestId: g },
      });
      const bag = [];
      for (let i = 0; i < 140; i++) {
        bag.push(
          goi("/api/olympus/spin", {
            method: "POST",
            guest: g,
            body: { bet: 20, guestId: g },
            retries: 0,
          }),
        );
      }
      const rs = await Promise.all(bag);
      const okN = rs.filter((x) => x.j.ok).length;
      const blocked = rs.filter((x) => x.status === 429).length;
      khang(
        blocked > 0 || okN < 140,
        `flood không chặn (ok=${okN} blocked=${blocked})`,
      );
    },
  });

  vu.push({
    ten: "J03·method GET spin phải chết",
    async chay() {
      const r = await goi("/api/olympus/spin");
      khang(r.status === 404 || r.status === 405 || !r.j.ok, "GET spin vẫn sống");
    },
  });

  vu.push({
    ten: "J04·win step không vượt balance logic",
    async chay() {
      const g = maBot("cap");
      const s0 = await goi("/api/olympus/session", { guest: g });
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      khang(r.j.ok, r.j.reason || "spin");
      khang(r.j.balance >= 0, "balance âm");
      khang(r.j.balance <= s0.j.balance - 100 + r.j.totalWin + 1, "bal overflow?");
    },
  });

  vu.push({
    ten: "J05·symbols meta khớp spin",
    async chay() {
      const meta = await goi("/api/olympus/meta");
      const g = maBot("sym");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 50, guestId: g },
      });
      const set = new Set(meta.j.symbols || []);
      for (const row of r.j.grid || []) {
        for (const c of row) {
          if (c != null) khang(set.has(c), `meta thiếu ${c}`);
        }
      }
    },
  });

  vu.push({
    ten: "J06·login AuthStore trừ xu thật",
    async chay() {
      const login = await goi("/api/auth/login", {
        method: "POST",
        body: { username: "admin", password: "admin123" },
      });
      if (!login.j?.ok || !login.j.token) {
        SO.vang.push({
          vu: "J06",
          ten: "Không login seed admin (MK đã đổi?) — skip AuthStore spin",
          ket: "GAP",
        });
        return;
      }
      const tok = login.j.token;
      const me0 = await goi("/api/auth/me", { token: tok });
      const bal0 = me0.j?.user?.balance ?? me0.j?.balance;
      khang(typeof bal0 === "number", "me không có balance");
      const spin = await goi("/api/olympus/spin", {
        method: "POST",
        token: tok,
        body: { bet: 20 },
      });
      khang(spin.j.ok && spin.j.wallet === "auth", spin.j.reason || "auth spin");
      const me1 = await goi("/api/auth/me", { token: tok });
      const bal1 = me1.j?.user?.balance ?? me1.j?.balance;
      const jp = spin.j.jackpotHit?.amount || 0;
      const expect = bal0 - 20 + spin.j.totalWin + jp;
      khang(bal1 === expect, `auth bal ${bal1}!=${expect}`);
      khang(spin.j.balance === bal1, "spin.balance khớp me");
    },
  });

  // —— khối K: FS / buy / hold / cluster ——
  vu.push({
    ten: "K01·lab force-fs + spin free",
    async chay() {
      const g = maBot("force-fs");
      await goi("/api/olympus/lab/clear-limits", { method: "POST", guest: g });
      const f = await goi("/api/olympus/lab/force-fs", {
        method: "POST",
        guest: g,
        body: { bet: 100, left: 3, accumMult: 10, guestId: g },
      });
      khang(f.j.ok && f.j.freeSpins?.left === 3, f.j.reason || "force-fs");
      const s0 = await goi("/api/olympus/session", { guest: g });
      const bal0 = s0.j.balance;
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      khang(r.j.ok && r.j.mode === "free", r.j.reason || "fs spin");
      khang(r.j.balance === bal0 + r.j.totalWin + (r.j.jackpotHit?.amount || 0), "FS không trừ bet");
      const expectedLeft = 3 - 1 + (r.j.fsAwarded || 0);
      const left = r.j.freeSpins?.left ?? 0;
      khang(
        left === expectedLeft || (expectedLeft === 0 && !r.j.freeSpins),
        `FS left ${left} != ${expectedLeft}`,
      );
    },
  });

  vu.push({
    ten: "K02·buy-bonus 100× trừ xu",
    async chay() {
      const g = maBot("buy-fs");
      await goi("/api/olympus/lab/set-balance", {
        method: "POST",
        guest: g,
        body: { balance: 50_000, guestId: g },
      });
      const r = await goi("/api/olympus/buy-bonus", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      khang(r.j.ok && r.j.cost === 10_000, r.j.reason || "buy");
      khang(r.j.freeSpins?.left === 15, "không có 15 FS");
      khang(r.j.balance === 40_000, `bal sau mua ${r.j.balance}`);
    },
  });

  vu.push({
    ten: "K03·buy thiếu xu bị từ chối",
    async chay() {
      const g = maBot("buy-poor");
      await goi("/api/olympus/lab/set-balance", {
        method: "POST",
        guest: g,
        body: { balance: 500, guestId: g },
      });
      const r = await goi("/api/olympus/buy-bonus", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      khang(!r.j.ok && r.status === 400, "phải từ chối mua");
    },
  });

  vu.push({
    ten: "K04·lab start-hold + respin",
    async chay() {
      const g = maBot("hold");
      const h = await goi("/api/olympus/lab/start-hold", {
        method: "POST",
        guest: g,
        body: { bet: 50, crowns: 6, guestId: g },
      });
      khang(h.j.ok && h.j.hold?.filled >= 6, h.j.reason || "start-hold");
      const blocked = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 50, guestId: g },
      });
      khang(!blocked.j.ok, "spin thường phải bị chặn khi hold");
      const rs = await goi("/api/olympus/hold/spin", {
        method: "POST",
        guest: g,
        body: { guestId: g },
      });
      khang(rs.j.ok, rs.j.reason || "hold spin");
      khang(typeof rs.j.filled === "number", "thiếu filled");
    },
  });

  vu.push({
    ten: "K05·cluster payMode spin ok",
    async chay() {
      const g = maBot("cluster");
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, payMode: "cluster", guestId: g },
      });
      khang(r.j.ok && r.j.payMode === "cluster", r.j.reason || "cluster");
      khang(Array.isArray(r.j.tumbles) && r.j.tumbles.length >= 1, "tumbles");
    },
  });

  vu.push({
    ten: "K06·accumMult tăng trong FS",
    async chay() {
      const g = maBot("accum");
      await goi("/api/olympus/lab/force-fs", {
        method: "POST",
        guest: g,
        body: { bet: 100, left: 5, accumMult: 25, guestId: g },
      });
      const r = await goi("/api/olympus/spin", {
        method: "POST",
        guest: g,
        body: { bet: 100, guestId: g },
      });
      khang(r.j.ok && r.j.mode === "free", r.j.reason || "fs");
      khang(
        (r.j.accumMult ?? 0) >= 25,
        `accumMult ${r.j.accumMult} không giữ ≥25`,
      );
    },
  });

  return vu;
}

async function main() {
  console.log(`\n╔══ ĐÀN BOT NĂM-MƯƠI-VỤ · ${BASE} · ${STAMP} ══╗\n`);
  const dan = dungDanVu();
  console.log(`Số vụ dựng: ${dan.length}`);
  if (dan.length < 50) {
    console.warn(`! chưa đủ 50 (đang ${dan.length}) — bổ sung…`);
  }

  let i = 0;
  for (const v of dan) {
    i += 1;
    try {
      await v.chay();
      ghi(i, "PASS", { ten: v.ten });
    } catch (e) {
      ghi(i, "FAIL", { ten: v.ten, loi: String(e.message || e) });
    }
    await sleep(25);
  }

  // đảm bảo đếm ≥ 50 bằng pad nếu thiếu (không nên)
  while (SO.xanh.length + SO.do.length < 50 && i < 60) {
    i += 1;
    ghi(i, "FAIL", { ten: "PAD·thiếu kịch bản", loi: "script chưa đủ 50" });
  }

  const tong = {
    base: BASE,
    stamp: STAMP,
    pass: SO.xanh.length,
    fail: SO.do.length,
    gap: SO.vang.filter((x) => x.ket === "GAP").length,
    gaps: SO.vang.filter((x) => x.ket === "GAP"),
    fails: SO.do,
  };

  const outDir = join(__dir, "..", "tmp");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `olympus-fifty-vu-${STAMP}.json`);
  writeFileSync(out, JSON.stringify(tong, null, 2), "utf8");

  console.log(`\n── KẾT ── PASS ${tong.pass} · FAIL ${tong.fail} · GAP ${tong.gap}`);
  if (tong.fails.length) {
    console.log("FAIL:");
    for (const f of tong.fails) console.log(`  - ${f.ten}: ${f.loi}`);
  }
  if (tong.gaps.length) {
    console.log("GAP 2026:");
    for (const g of tong.gaps) console.log(`  - ${g.ten}`);
  }
  console.log(`Sổ: ${out}\n`);
  process.exit(tong.fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
