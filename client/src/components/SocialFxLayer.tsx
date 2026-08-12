import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { formatXu } from "../cards";
import { formatGem } from "../gem";
import type { GiftFlyEvent } from "../gifts";
import {
  GiftFlyOverlay,
  type GiftFlyQueueItem,
} from "./GiftFlyOverlay";
import { usePlaySocketOptional } from "../socket/PlaySocketContext";

type SeekChip = {
  key: string;
  fromName: string;
  toName: string;
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  currency: "xu" | "gem";
  emoji: string;
  image?: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

function normName(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Tìm ghế / avatar gắn data-social-user | data-social-name */
export function findSocialAnchor(opts: {
  userId?: string | null;
  name?: string | null;
}): DOMRect | null {
  const id = String(opts.userId || "").trim();
  if (id) {
    const el = document.querySelector(
      `[data-social-user="${CSS.escape(id)}"]`,
    );
    if (el) return el.getBoundingClientRect();
  }
  const name = normName(opts.name || "");
  if (name) {
    const nodes = document.querySelectorAll("[data-social-name]");
    for (const node of nodes) {
      const n = normName(node.getAttribute("data-social-name") || "");
      if (n && (n === name || n.includes(name) || name.includes(n))) {
        return node.getBoundingClientRect();
      }
    }
  }
  return null;
}

function centerOf(r: DOMRect | null, fallback: { x: number; y: number }) {
  if (!r || r.width <= 0) return fallback;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function SeatSeekVisual({
  chip,
  onDone,
}: {
  chip: SeekChip;
  onDone: (key: string) => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onDone(chip.key), 2200);
    return () => window.clearTimeout(t);
  }, [chip.key, onDone]);

  const label =
    chip.currency === "gem"
      ? `${formatGem(chip.amount)} Gem`
      : `${formatXu(chip.amount)} xu`;

  return (
    <motion.div
      className="social-seek-chip pointer-events-none fixed z-[76]"
      initial={{
        opacity: 0,
        scale: 0.55,
        left: chip.from.x,
        top: chip.from.y,
        x: "-50%",
        y: "-50%",
      }}
      animate={{
        opacity: [0, 1, 1, 0.85],
        scale: [0.55, 1.12, 1, 0.9],
        left: chip.to.x,
        top: chip.to.y,
        x: "-50%",
        y: "-50%",
      }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="social-seek-chip__bubble">
        {chip.image ? (
          <img src={chip.image} alt="" className="social-seek-chip__img" />
        ) : (
          <span className="social-seek-chip__emoji">{chip.emoji}</span>
        )}
        <span className="social-seek-chip__amt">{label}</span>
      </div>
    </motion.div>
  );
}

/**
 * Overlay quà + xu bay theo ghế — gắn PlaySocket trên mọi bàn nhiều người.
 */
export function SocialFxLayer() {
  const play = usePlaySocketOptional();
  const socket = play?.socket ?? null;
  const active = !!play?.active;
  const [flyQueue, setFlyQueue] = useState<GiftFlyQueueItem[]>([]);
  const [chips, setChips] = useState<SeekChip[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const pushSeek = useCallback((payload: GiftFlyEvent & { currency?: string }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mid = { x: vw / 2, y: vh * 0.42 };
    const fromRect = findSocialAnchor({
      userId: payload.fromUserId,
      name: payload.fromName,
    });
    const toRect = findSocialAnchor({
      userId: payload.toUserId,
      name: payload.toName,
    });
    const from = centerOf(fromRect, { x: vw * 0.28, y: vh * 0.55 });
    const to = centerOf(toRect, mid);
    const currency: "xu" | "gem" =
      payload.currency === "gem" || String(payload.fly?.id || "").includes("gem")
        ? "gem"
        : "xu";
    const key = `seek-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const chip: SeekChip = {
      key,
      fromName: payload.fromName,
      toName: payload.toName,
      fromUserId: payload.fromUserId,
      toUserId: payload.toUserId,
      amount: Math.max(0, Math.floor(payload.amount || 0)),
      currency,
      emoji: payload.giftEmoji || (currency === "gem" ? "💎" : "🎁"),
      image: payload.giftImage,
      from,
      to,
    };
    setChips((prev) => [...prev, chip].slice(-8));
  }, []);

  useEffect(() => {
    if (!active || !socket) {
      setFlyQueue([]);
      setChips([]);
      return;
    }

    const onGiftFly = (payload: GiftFlyEvent & { currency?: string }) => {
      if (!payload?.fly?.style) return;
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setFlyQueue((prev) => [...prev, { ...payload, key }].slice(-6));
      pushSeek(payload);
    };

    const onGiftReceived = (payload: {
      amount?: number;
      fromName?: string;
      giftEmoji?: string;
      giftNameVi?: string;
      currency?: string;
    }) => {
      const from = payload.fromName?.trim() || "Ai đó";
      const unit = payload.currency === "gem" ? "Gem" : "xu";
      const label =
        payload.giftEmoji && payload.giftNameVi
          ? `${payload.giftEmoji} ${payload.giftNameVi}`
          : `${Math.floor(payload.amount || 0).toLocaleString("vi-VN")} ${unit}`;
      setToast(`${from} tặng bạn ${label}`);
    };

    socket.on("giftFly", onGiftFly);
    socket.on("giftReceived", onGiftReceived);
    return () => {
      socket.off("giftFly", onGiftFly);
      socket.off("giftReceived", onGiftReceived);
    };
  }, [active, socket, pushSeek]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!active) return null;

  return (
    <>
      <GiftFlyOverlay
        queue={flyQueue}
        onDone={(key) =>
          setFlyQueue((prev) => prev.filter((x) => x.key !== key))
        }
      />
      <AnimatePresence>
        {chips.map((c) => (
          <SeatSeekVisual
            key={c.key}
            chip={c}
            onDone={(key) =>
              setChips((prev) => prev.filter((x) => x.key !== key))
            }
          />
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none fixed inset-x-0 bottom-24 z-[77] flex justify-center px-3"
          >
            <div className="rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/35 backdrop-blur">
              {toast}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
