import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { formatXu } from "../cards";
import type { GiftFlyEvent } from "../gifts";

export type GiftFlyQueueItem = GiftFlyEvent & { key: string };

interface GiftFlyOverlayProps {
  queue: GiftFlyQueueItem[];
  onDone: (key: string) => void;
}

function GiftVisual({
  emoji,
  image,
  sizeClass,
}: {
  emoji: string;
  image?: string;
  sizeClass: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(image) && !imgFailed;
  if (showImg) {
    return (
      <span className={`relative inline-flex items-center justify-center ${sizeClass}`}>
        <img
          src={image}
          alt=""
          className="h-full w-full object-contain drop-shadow-lg"
          onError={() => setImgFailed(true)}
          draggable={false}
        />
        {emoji && (
          <span className="absolute -bottom-1 -right-1 text-lg leading-none drop-shadow">
            {emoji}
          </span>
        )}
      </span>
    );
  }
  return <span className={`leading-none ${sizeClass}`}>{emoji}</span>;
}

function FlyVisual({
  item,
  onDone,
}: {
  item: GiftFlyQueueItem;
  onDone: (key: string) => void;
}) {
  const durationMs = Math.max(800, item.fly.durationMs || 3000);
  const emoji = item.giftEmoji || "🎁";
  const image = item.giftImage;
  const name = item.giftNameVi || "Quà";
  const line = `${item.fromName} → ${item.toName} · ${emoji} ${name} · ${formatXu(item.amount)} xu`;

  useEffect(() => {
    const t = window.setTimeout(() => onDone(item.key), durationMs);
    return () => window.clearTimeout(t);
  }, [item.key, durationMs, onDone]);

  const style = item.fly.style;

  if (style === "toast") {
    return (
      <motion.div
        key={item.key}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.28 }}
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[75] flex justify-center px-3"
      >
        <div className="flex max-w-sm items-center gap-2 rounded-full bg-[#16100c]/92 px-4 py-2 text-center text-xs font-semibold text-[var(--jade-soft)] shadow-lg ring-1 ring-[var(--jade)]/40 backdrop-blur">
          {image && (
            <GiftVisual emoji={emoji} image={image} sizeClass="h-7 w-7 text-base" />
          )}
          <span>{line}</span>
        </div>
      </motion.div>
    );
  }

  if (style === "marquee") {
    return (
      <motion.div
        key={item.key}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="pointer-events-none fixed inset-x-0 top-16 z-[75] px-3"
      >
        <div className="overflow-hidden rounded-full bg-[var(--wood-deep)]/90 py-2 shadow-lg ring-1 ring-[var(--gold)]/45 backdrop-blur-sm">
          <p className="animate-shout-marquee flex items-center gap-2 whitespace-nowrap px-3 text-xs font-semibold text-[var(--gold-soft)]">
            {image ? (
              <GiftVisual emoji={emoji} image={image} sizeClass="h-5 w-5 text-sm" />
            ) : (
              <span>{emoji}</span>
            )}{" "}
            {line}
          </p>
        </div>
      </motion.div>
    );
  }

  if (style === "fly") {
    return (
      <motion.div
        key={item.key}
        initial={{ opacity: 0, scale: 0.4, x: -80, y: 40 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.6, y: -30 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center"
      >
        <div className="rounded-2xl bg-[#16100c]/88 px-6 py-5 text-center shadow-2xl ring-2 ring-[var(--jade)]/50 backdrop-blur">
          <motion.div
            initial={{ y: 24, rotate: -12 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="flex justify-center text-5xl"
          >
            <GiftVisual emoji={emoji} image={image} sizeClass="h-16 w-16 text-5xl" />
          </motion.div>
          <p className="mt-2 text-sm font-bold text-[var(--cream)]">{name}</p>
          <p className="mt-1 text-[11px] text-white/70">{line}</p>
        </div>
      </motion.div>
    );
  }

  // fullscreen
  return (
    <motion.div
      key={item.key}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-[78] flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-[var(--night)]/72 backdrop-blur-[2px]" />
      <motion.div
        initial={{ scale: 0.75, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-[#2a6b5e] via-[#163832] to-[#0a1c18] px-6 py-8 text-center shadow-2xl ring-2 ring-[var(--jade-soft)]/65"
      >
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--jade-soft)]/90">
          {item.fly.label || "Quà lớn"}
        </p>
        <div className="flex justify-center text-6xl leading-none">
          <GiftVisual emoji={emoji} image={image} sizeClass="h-24 w-24 text-6xl" />
        </div>
        <p className="mt-3 font-play text-xl font-bold text-[var(--cream)]">
          {name}
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--jade-soft)]">
          {item.fromName} tặng {item.toName}
        </p>
        <p className="font-play mt-1 text-lg font-bold tabular-nums text-amber-200">
          {formatXu(item.amount)} xu
        </p>
      </motion.div>
    </motion.div>
  );
}

/** Listen-driven overlay — parent owns the queue from socket `giftFly`. */
export function GiftFlyOverlay({ queue, onDone }: GiftFlyOverlayProps) {
  const [current, setCurrent] = useState<GiftFlyQueueItem | null>(null);

  useEffect(() => {
    if (current) return;
    if (!queue.length) return;
    setCurrent(queue[0]!);
  }, [queue, current]);

  const handleDone = (key: string) => {
    setCurrent(null);
    onDone(key);
  };

  return (
    <AnimatePresence mode="wait">
      {current && (
        <FlyVisual key={current.key} item={current} onDone={handleDone} />
      )}
    </AnimatePresence>
  );
}
