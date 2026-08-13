/** Gửi quà xu / mở gift API — dùng chung bàn nhiều người. */
import { api, getToken, saveSession, type AuthUser } from "./auth";
import type { GiftItem } from "./gifts";

export async function sendGiftXu(opts: {
  toUserId?: string;
  toCode?: string;
  toUsername?: string;
  amount?: number;
  giftKey?: string;
  note?: string;
}): Promise<
  | { ok: true; amount: number; from: AuthUser; to: AuthUser; giftKey?: string }
  | { ok: false; reason: string }
> {
  if (!getToken()) return { ok: false, reason: "Đăng nhập để tặng quà" };
  try {
    const r = await api<{
      ok: true;
      amount: number;
      from: AuthUser;
      to: AuthUser;
      giftKey?: string;
    }>("/api/auth/gift-xu", {
      method: "POST",
      body: JSON.stringify({
        toUserId: opts.toUserId,
        toCode: opts.toCode,
        toUsername: opts.toUsername,
        amount: opts.amount,
        giftKey: opts.giftKey,
        note: opts.note,
      }),
    });
    const token = getToken();
    if (token) saveSession(token, r.from);
    return r;
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Không tặng được",
    };
  }
}

export async function sendGiftFromCatalog(opts: {
  gift: GiftItem;
  toUserId?: string;
  toCode?: string;
  toUsername?: string;
  note?: string;
}) {
  return sendGiftXu({
    toUserId: opts.toUserId,
    toCode: opts.toCode,
    toUsername: opts.toUsername,
    giftKey: opts.gift.key,
    amount: opts.gift.price,
    note: opts.note,
  });
}
