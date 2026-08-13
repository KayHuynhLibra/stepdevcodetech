/**
 * Generate 78 stylized Tarot SVGs + redraw lobby covers (1:1).
 * Run: node scripts/gen-oracle-tarot-svgs.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fe/public/assets/oracle/tarot");
const lobbyDir = join(root, "fe/public/assets/lobby");
mkdirSync(outDir, { recursive: true });
mkdirSync(lobbyDir, { recursive: true });

const MAJOR = [
  ["fool", "Kẻ Khờ", "0"],
  ["magician", "Ảo Thuật", "I"],
  ["priestess", "Nữ Tư Tế", "II"],
  ["empress", "Nữ Hoàng", "III"],
  ["emperor", "Hoàng Đế", "IV"],
  ["hierophant", "Giáo Hoàng", "V"],
  ["lovers", "Người Yêu", "VI"],
  ["chariot", "Chiến Xa", "VII"],
  ["strength", "Sức Mạnh", "VIII"],
  ["hermit", "Ẩn Sĩ", "IX"],
  ["wheel", "Bánh Xe", "X"],
  ["justice", "Công Lý", "XI"],
  ["hanged", "Người Treo", "XII"],
  ["death", "Thần Chết", "XIII"],
  ["temperance", "Tiết Chế", "XIV"],
  ["devil", "Ác Quỷ", "XV"],
  ["tower", "Tòa Tháp", "XVI"],
  ["star", "Ngôi Sao", "XVII"],
  ["moon", "Mặt Trăng", "XVIII"],
  ["sun", "Mặt Trời", "XIX"],
  ["judgement", "Phán Xét", "XX"],
  ["world", "Thế Giới", "XXI"],
];

const SUITS = [
  { key: "wands", nameVi: "Gậy", color: "#8b3a1a", accent: "#e8a060", glyph: "†" },
  { key: "cups", nameVi: "Cốc", color: "#1a4a6b", accent: "#7ec8e8", glyph: "♡" },
  { key: "swords", nameVi: "Kiếm", color: "#2a2a4a", accent: "#c0c8e0", glyph: "⚔" },
  { key: "pentacles", nameVi: "Tiền", color: "#2a4a28", accent: "#a8d080", glyph: "◆" },
];

const RANKS = [
  [1, "Át"],
  [2, "Hai"],
  [3, "Ba"],
  [4, "Bốn"],
  [5, "Năm"],
  [6, "Sáu"],
  [7, "Bảy"],
  [8, "Tám"],
  [9, "Chín"],
  [10, "Mười"],
  [11, "Page"],
  [12, "Knight"],
  [13, "Queen"],
  [14, "King"],
];

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardSvg({ bg, accent, title, sub, glyph, numeral }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="#1a1208"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5e6c8"/>
      <stop offset="50%" stop-color="#d4a84b"/>
      <stop offset="100%" stop-color="#8b6914"/>
    </linearGradient>
  </defs>
  <rect width="200" height="280" rx="14" fill="url(#bg)"/>
  <rect x="10" y="10" width="180" height="260" rx="10" fill="none" stroke="url(#gold)" stroke-width="3"/>
  <rect x="18" y="18" width="164" height="244" rx="6" fill="none" stroke="${accent}" stroke-width="1" opacity="0.55"/>
  <text x="100" y="48" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#f5e6c8">${esc(numeral)}</text>
  <text x="100" y="140" text-anchor="middle" font-family="Georgia,serif" font-size="48" fill="${accent}">${esc(glyph)}</text>
  <text x="100" y="210" text-anchor="middle" font-family="Georgia,serif" font-size="15" font-weight="700" fill="#f5e6c8">${esc(title)}</text>
  <text x="100" y="232" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#c8b080">${esc(sub)}</text>
</svg>
`;
}

const MAJOR_GLYPH = {
  fool: "★",
  magician: "✦",
  priestess: "☽",
  empress: "❀",
  emperor: "♔",
  hierophant: "✝",
  lovers: "♥",
  chariot: "▣",
  strength: "∞",
  hermit: "⚑",
  wheel: "◎",
  justice: "⚖",
  hanged: "⇓",
  death: "†",
  temperance: "⚗",
  devil: "▽",
  tower: "⚡",
  star: "✧",
  moon: "☾",
  sun: "☼",
  judgement: "📯",
  world: "◉",
};

for (const [key, nameVi, numeral] of MAJOR) {
  writeFileSync(
    join(outDir, `${key}.svg`),
    cardSvg({
      bg: "#3d2a1a",
      accent: "#d4a84b",
      title: nameVi,
      sub: "Major Arcana",
      glyph: MAJOR_GLYPH[key] || "✦",
      numeral,
    }),
  );
}

for (const suit of SUITS) {
  for (const [n, rankVi] of RANKS) {
    const key = `${suit.key}_${n}`;
    writeFileSync(
      join(outDir, `${key}.svg`),
      cardSvg({
        bg: suit.color,
        accent: suit.accent,
        title: `${rankVi} ${suit.nameVi}`,
        sub: `Minor · ${suit.nameVi}`,
        glyph: suit.glyph,
        numeral: String(n),
      }),
    );
  }
}

function lobbySvg({ title, glyph, c1, c2 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5e6c8"/>
      <stop offset="100%" stop-color="#8b6914"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" fill="url(#g)"/>
  <rect x="24" y="24" width="272" height="272" rx="18" fill="none" stroke="url(#gold)" stroke-width="4"/>
  <rect x="40" y="40" width="240" height="240" rx="12" fill="rgba(255,248,232,0.08)" stroke="#f5e6c8" stroke-width="1" opacity="0.5"/>
  <text x="160" y="155" text-anchor="middle" font-family="Georgia,serif" font-size="72" fill="#f5e6c8">${esc(glyph)}</text>
  <text x="160" y="230" text-anchor="middle" font-family="Georgia,serif" font-size="28" font-weight="700" fill="#f5e6c8">${esc(title)}</text>
</svg>
`;
}

const lobbies = [
  ["tarot.svg", { title: "TAROT", glyph: "★", c1: "#3d2a1a", c2: "#8b6914" }],
  ["arcana.svg", { title: "ARCANA", glyph: "◎", c1: "#2a1840", c2: "#6b3a8b" }],
  ["olympus.svg", { title: "OLYMPUS", glyph: "⚡", c1: "#1a0e2e", c2: "#3a2060" }],
  ["boi.svg", { title: "BÓI BÀI", glyph: "☽", c1: "#1a2a3a", c2: "#3a5a6b" }],
  ["soon.svg", { title: "SẮP CÓ", glyph: "·", c1: "#2a2418", c2: "#4a4030" }],
];

for (const [file, opts] of lobbies) {
  writeFileSync(join(lobbyDir, file), lobbySvg(opts));
}

console.log("Wrote", 22 + 56, "oracle SVGs +", lobbies.length, "lobby covers");
