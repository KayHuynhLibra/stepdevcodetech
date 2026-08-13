/**
 * User-facing game brand labels — original SOFIA names.
 * Keep internal ids (`uno`, `olympus`, routes) stable; never show third-party marks.
 */
export const GAME_BRAND = {
  uno: {
    id: "uno",
    name: "HueRush",
    nameVi: "HueRush",
    short: "HR",
    blurb: "Bài 4 màu · 112 lá · 2–10 người · chồng +2/+4 · demo SOFIA.",
    /** Call when 1–2 cards left (not a third-party mark). */
    shout: "Rush!",
    shoutVi: "Rush!",
    shopTitle: "Shop HueRush · skin Gem",
    adminTitle: "HueRush · Quản trị",
    winLine: "thắng HueRush",
  },
  olympus: {
    id: "olympus",
    name: "BoltPeak",
    nameVi: "BoltPeak",
    short: "BP",
    blurb: "Slot tumble 6×5 · xu chơi · demo giáo dục SOFIA (original).",
    adminTitle: "BOLT% · BoltPeak",
    economyTab: "BOLT%",
  },
  ludo: {
    id: "ludo",
    name: "Cờ cá ngựa",
    nameVi: "Cờ cá ngựa",
    short: "CCH",
    blurb: "Bàn 2D/3D · 1v3 bot · lobby · demo SOFIA.",
  },
  oanQuan: {
    id: "oan-quan",
    name: "Ô ăn quan",
    nameVi: "Ô ăn quan",
    short: "OQ",
    blurb: "Dân gian Việt — PvP / vs bot · rải dân ăn quan.",
  },
  tarot: {
    id: "tarot",
    name: "Tarot",
    nameVi: "Tarot",
    short: "TR",
    blurb: "Dùng xu chơi — đoán lá · bàn chính SOFIA.",
  },
  arcana: {
    id: "arcana",
    name: "Arcana",
    nameVi: "Arcana",
    short: "AR",
    blurb: "Bánh xe quay — spin xu chơi.",
  },
  boi: {
    id: "boi",
    name: "Bói bài",
    nameVi: "Bói bài",
    short: "BB",
    blurb: "Theatre 78 lá — xào/rút thật, không cược · giải trí only.",
  },
} as const;

export type GameBrandKey = keyof typeof GAME_BRAND;
