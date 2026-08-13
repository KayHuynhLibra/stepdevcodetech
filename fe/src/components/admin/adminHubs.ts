/** Hub cấp 1 + map tab con — điều hướng admin gọn (theo mục / theo game). */

export type AdminTabId =
  | "overview"
  | "users"
  | "vault"
  | "traffic"
  | "coupons"
  | "invites"
  | "inter"
  | "mod"
  | "ips"
  | "ipWorld"
  | "chat"
  | "tools"
  | "system"
  | "zeusPct"
  | "xuLevels"
  | "ludo"
  | "oanQuan"
  | "uno"
  | "arcana"
  | "rolead"
  | "roles"
  | "tutien"
  | "level"
  | "gifts"
  | "rings"
  | "pm"
  | "oracle"
  | "games"
  | "room"
  | "feedback"
  | "mess"
  | "deleteAcc";

export type AdminHubId =
  | "overview"
  | "users"
  | "economy"
  | "play"
  | "content"
  | "ops"
  | "inbox";

export type AdminHubDef = {
  id: AdminHubId;
  label: string;
  tabs: AdminTabId[];
};

/**
 * Hub layout (check theo mục):
 * - Kinh tế = xu / kho / coupon (không trộn room game)
 * - Trò chơi = từng game + registry
 * - Nội dung = P+M assets
 */
export const ADMIN_HUBS: AdminHubDef[] = [
  {
    id: "overview",
    label: "Tổng quan",
    tabs: ["overview"],
  },
  {
    id: "users",
    label: "Người dùng",
    tabs: ["tools", "users", "roles", "mod", "level", "tutien", "deleteAcc"],
  },
  {
    id: "economy",
    label: "Kinh tế",
    tabs: ["xuLevels", "vault", "coupons"],
  },
  {
    id: "play",
    label: "Trò chơi",
    tabs: [
      "games",
      "inter",
      "arcana",
      "zeusPct",
      "ludo",
      "oanQuan",
      "uno",
      "oracle",
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    tabs: ["pm"],
  },
  {
    id: "ops",
    label: "Vận hành",
    tabs: ["system", "ips", "ipWorld", "chat", "room", "traffic", "invites"],
  },
  {
    id: "inbox",
    label: "Inbox",
    tabs: ["feedback", "mess", "gifts", "rings", "rolead"],
  },
];

export const TAB_LABELS: Record<AdminTabId, string> = {
  overview: "Tổng quan",
  tools: "Tra cứu",
  users: "User & Bot",
  roles: "Roles",
  mod: "Mod",
  level: "Level",
  tutien: "Tu Tiên",
  deleteAcc: "Xóa acc",
  vault: "Kho xu",
  xuLevels: "Mức xu",
  inter: "Tarot · Inter",
  coupons: "Coupon ẩn",
  zeusPct: "BoltPeak · BOLT%",
  ludo: "Cờ cá ngựa",
  oanQuan: "Ô ăn quan",
  uno: "HueRush",
  pm: "P+M",
  oracle: "Bói bài / Lab",
  games: "Games registry",
  arcana: "Bánh xe Arcana",
  system: "Hệ thống",
  ips: "IP",
  ipWorld: "IpWorld",
  chat: "Chat",
  room: "Room",
  traffic: "Lưu lượng",
  invites: "Đăng ký",
  feedback: "Feedback",
  mess: "Mess",
  gifts: "Quà",
  rings: "Nhẫn",
  rolead: "RoleAD",
};

/** Game checklist — tab quản trị gắn từng lane chơi. */
export const GAME_ADMIN_CHECK: {
  game: string;
  path: string;
  tabs: AdminTabId[];
  notes: string;
}[] = [
  {
    game: "Tarot",
    path: "/play",
    tabs: ["inter", "vault", "traffic", "games"],
    notes: "Inter + Vault(tarot) + Traffic; đổi managedGame=tarot",
  },
  {
    game: "Arcana",
    path: "/arcana",
    tabs: ["arcana", "vault", "games"],
    notes: "Bánh xe; Vault(arcana); managedGame=arcana",
  },
  {
    game: "BoltPeak",
    path: "/olympus",
    tabs: ["zeusPct", "games"],
    notes: "BOLT% RTP / Peak / FS",
  },
  {
    game: "Cờ cá ngựa",
    path: "/ludo",
    tabs: ["ludo", "games"],
    notes: "Phòng · economy · cosmetics",
  },
  {
    game: "Ô ăn quan",
    path: "/oan-quan",
    tabs: ["oanQuan", "games"],
    notes: "Rooms · force close",
  },
  {
    game: "HueRush",
    path: "/uno",
    tabs: ["uno", "games"],
    notes: "Rooms · force close",
  },
  {
    game: "Bói bài",
    path: "/boi-bai",
    tabs: ["oracle", "pm", "games"],
    notes: "CMS/Lab · P+M cosmetics Bói",
  },
];

const TAB_TO_HUB: Record<AdminTabId, AdminHubId> = {
  overview: "overview",
  tools: "users",
  users: "users",
  roles: "users",
  mod: "users",
  level: "users",
  tutien: "users",
  deleteAcc: "users",
  vault: "economy",
  xuLevels: "economy",
  coupons: "economy",
  games: "play",
  inter: "play",
  arcana: "play",
  zeusPct: "play",
  ludo: "play",
  oanQuan: "play",
  uno: "play",
  oracle: "play",
  pm: "content",
  system: "ops",
  ips: "ops",
  ipWorld: "ops",
  chat: "ops",
  room: "ops",
  traffic: "ops",
  invites: "ops",
  feedback: "inbox",
  mess: "inbox",
  gifts: "inbox",
  rings: "inbox",
  rolead: "inbox",
};

export function hubForTab(tab: AdminTabId): AdminHubId {
  return TAB_TO_HUB[tab] ?? "overview";
}

export function firstVisibleTabInHub(
  hubId: AdminHubId,
  visible: Set<AdminTabId> | AdminTabId[],
): AdminTabId | null {
  const vis = visible instanceof Set ? visible : new Set(visible);
  const hub = ADMIN_HUBS.find((h) => h.id === hubId);
  if (!hub) return null;
  for (const t of hub.tabs) {
    if (vis.has(t)) return t;
  }
  return null;
}

export function vaultTabLabel(managedGame: "tarot" | "arcana" | "gem"): string {
  if (managedGame === "arcana") return "Kho Arcana";
  if (managedGame === "gem") return "Kho Gem";
  return "Kho Tarot";
}
