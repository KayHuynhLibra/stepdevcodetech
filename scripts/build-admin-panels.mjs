import fs from "node:fs";
import path from "node:path";

const root = path.resolve("client/src/components/admin/panels");
const usersJsx = fs.readFileSync(path.join(root, "_users_jsx.txt"), "utf8");
const interJsx = fs.readFileSync(path.join(root, "_inter_jsx.txt"), "utf8");
const vaultJsx = fs.readFileSync(path.join(root, "_vault_jsx.txt"), "utf8");

function xUsers(s) {
  return s
    .replaceAll("data?.me", "me")
    .replaceAll("data.me", "me")
    .replaceAll("data.users", "users")
    .replaceAll("data.liveGuests", "liveGuests");
}

function xInter(s) {
  return s
    .replaceAll("data.inter!", "inter")
    .replaceAll("data.inter", "inter")
    .replaceAll("data.users", "users")
    .replaceAll("data.vaultArcana", "vaultArcana")
    .replaceAll("data.vault", "vault");
}

function xVault(s) {
  return s.replaceAll("data.users", "users");
}

const usersPanel = `import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  getToken,
  saveSession,
  VIP_ROUNDS_REQUIRED,
  type AuthUser,
} from "../../../auth";
import { normalizeAvatar } from "../../../avatars";
import { formatXu } from "../../../cards";
import { CultivationChip } from "../../CultivationChip";

export type AdminUserRow = {
  id: string;
  code: string;
  username: string;
  role: string;
  balance: number;
  balances?: { play?: number; social?: number };
  isVip: boolean;
  vipGranted?: boolean;
  banned: boolean;
  muted: boolean;
  roundsPlayed: number;
  winToday?: number;
  guessesToday?: number;
  outcomeMode?: "normal" | "win" | "lose";
  outcomeWinPct?: number;
  cultivationRank?: string | null;
  avatar?: string;
  hideFromLeaderboard?: boolean;
  hideNickname?: boolean;
};

export type LiveGuestRow = {
  socketId: string;
  name: string;
  guestCode?: string;
  balance: number;
  inOrphan?: boolean;
};

export function UsersAdminPanel({
  users,
  liveGuests,
  me,
  botTarget,
  onMsg,
  onReload,
  onOpenPwReset,
  onMeUpdate,
}: {
  users: AdminUserRow[];
  liveGuests?: LiveGuestRow[];
  me: AuthUser;
  botTarget: number;
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
  onOpenPwReset: (u: {
    id: string;
    username: string;
    code?: string;
    role: string;
  }) => void;
  onMeUpdate?: (user: AuthUser) => void;
}) {
  const [botCount, setBotCount] = useState(botTarget);
  const [adjust, setAdjust] = useState<{
    userId: string;
    delta: string;
    lane: "play" | "social";
  }>({ userId: "", delta: "", lane: "play" });
  const [guestAdjust, setGuestAdjust] = useState<{ key: string; delta: string }>(
    { key: "", delta: "" },
  );
  const [userFilter, setUserFilter] = useState("");
  const [userQuick, setUserQuick] = useState<
    "all" | "vip" | "banned" | "muted"
  >("all");
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [codeBusyId, setCodeBusyId] = useState<string | null>(null);

  useEffect(() => {
    setBotCount(botTarget);
  }, [botTarget]);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        if (userQuick === "vip" && !u.isVip) return false;
        if (userQuick === "banned" && !u.banned) return false;
        if (userQuick === "muted" && !u.muted) return false;
        const q = userFilter.trim().toLowerCase();
        if (!q) return true;
        return \`\${u.username} \${u.code} \${u.id} \${u.role} \${u.cultivationRank ?? ""}\`
          .toLowerCase()
          .includes(q);
      }),
    [users, userFilter, userQuick],
  );

  const applyBots = async () => {
    try {
      await api("/api/admin/bots", {
        method: "POST",
        body: JSON.stringify({ count: botCount }),
      });
      onMsg(\`Đã đặt \${botCount} bot\`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const applyAdjust = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/adjust-balance", {
        method: "POST",
        body: JSON.stringify({
          userId: adjust.userId,
          delta: Number(adjust.delta),
          lane: adjust.lane,
        }),
      });
      onMsg(
        \`Đã cập nhật \${adjust.lane === "social" ? "xu quà" : "xu chơi"} user\`,
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const applyGuestAdjust = async (e: FormEvent) => {
    e.preventDefault();
    const key = guestAdjust.key.trim();
    const delta = Number(guestAdjust.delta);
    if (!key || !Number.isFinite(delta) || delta === 0) {
      onMsg("Chọn khách và nhập delta");
      return;
    }
    try {
      await api("/api/admin/guest/adjust-balance", {
        method: "POST",
        body: JSON.stringify({ socketId: key, delta }),
      });
      onMsg("Đã cập nhật số dư khách (bàn Tarot)");
      setGuestAdjust({ key: "", delta: "" });
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserOutcome = async (
    userId: string,
    mode: "normal" | "win" | "lose",
  ) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({ userId, mode }),
      });
      onMsg(
        mode === "normal"
          ? "Đã về Normal"
          : mode === "win"
            ? "User: ưu tiên WIN"
            : "User: ưu tiên LOSE",
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserVip = async (userId: string, isVip: boolean) => {
    try {
      await api("/api/admin/user-vip", {
        method: "POST",
        body: JSON.stringify({ userId, isVip }),
      });
      onMsg(isVip ? "Đã cấp VIP10K" : "Đã tắt VIP10K");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserCode = async (userId: string, code: string) => {
    if (codeBusyId) return;
    setCodeBusyId(userId);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/admin/user-code", {
        method: "POST",
        body: JSON.stringify({ userId, code }),
      });
      onMsg(\`Đã đổi ID → \${r.user.code}\`);
      setCodeDrafts((d) => {
        const next = { ...d };
        delete next[userId];
        return next;
      });
      if (me.id === userId) {
        const token = getToken();
        if (token) saveSession(token, { ...me, ...r.user });
        onMeUpdate?.({ ...me, ...r.user });
      }
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi đổi ID");
    } finally {
      setCodeBusyId(null);
    }
  };

  const setUserRole = async (
    userId: string,
    role: "user" | "deal" | "onl" | "tutien" | "mod",
  ) => {
    try {
      await api("/api/mainadmin/user-role", {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      onMsg("Đã cập nhật role");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi đổi role");
    }
  };

  const setUserLeaderboardHide = async (userId: string, hidden: boolean) => {
    try {
      await api("/api/mainadmin/user-leaderboard-hide", {
        method: "POST",
        body: JSON.stringify({ userId, hidden }),
      });
      onMsg(hidden ? "Đã ẩn khỏi bảng xếp hạng" : "Đã hiện trên bảng xếp hạng");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi ẩn BXH");
    }
  };

  const setUserHideNickname = async (userId: string, hidden: boolean) => {
    try {
      await api("/api/mainadmin/user-hide-nickname", {
        method: "POST",
        body: JSON.stringify({ userId, hidden }),
      });
      onMsg(hidden ? "Đã ẩn nick công khai" : "Đã hiện nick công khai");
      await onReload();
      if (userId === me.id) {
        const token = getToken();
        if (token) {
          try {
            const r = await api<{ ok: true; user: AuthUser }>("/api/auth/me");
            saveSession(token, r.user);
            onMeUpdate?.(r.user);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi ẩn nick");
    }
  };

  const setUserBan = async (userId: string, banned: boolean) => {
    try {
      const reason = banned
        ? window.prompt("Lý do khóa (tuỳ chọn)", "Vi phạm") ?? "Vi phạm"
        : "";
      await api("/api/admin/user-ban", {
        method: "POST",
        body: JSON.stringify({ userId, banned, reason }),
      });
      onMsg(banned ? "Đã khóa tài khoản" : "Đã mở khóa");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserMute = async (
    userId: string,
    opts: { minutes?: number; permanent?: boolean; off?: boolean },
  ) => {
    try {
      await api("/api/admin/user-mute", {
        method: "POST",
        body: JSON.stringify({
          userId,
          minutes: opts.off ? 0 : (opts.minutes ?? 0),
          permanent: !!opts.permanent,
        }),
      });
      onMsg(
        opts.off
          ? "Đã unmute"
          : opts.permanent
            ? "Mute vĩnh viễn"
            : \`Mute \${opts.minutes} phút\`,
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  return (
    <>
${xUsers(usersJsx)
  .split("\n")
  .map((l) => "      " + l)
  .join("\n")}
    </>
  );
}
`;

fs.writeFileSync(path.join(root, "UsersAdminPanel.tsx"), usersPanel);
console.log("Wrote UsersAdminPanel.tsx");
