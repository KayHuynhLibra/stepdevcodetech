import { AnimatePresence, motion } from "framer-motion";
import type { ShoutEvent } from "../shouts";

interface ShoutMarqueeProps {
  items: (ShoutEvent & { key: string })[];
}

export function ShoutMarquee({ items }: ShoutMarqueeProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[55] flex flex-col gap-1.5 px-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: -12, x: 40 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden rounded-full bg-[var(--wood-deep)]/90 py-1.5 shadow-lg shadow-[0_0_16px_rgba(255,176,64,0.22)] ring-1 ring-[var(--gold)]/45 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 whitespace-nowrap px-3">
              <img
                src={item.avatar || "/assets/ui/avatar-default.png"}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/30"
              />
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="animate-shout-marquee inline-block text-xs font-semibold text-[var(--gold-soft)]">
                  <span className="text-white/90">{item.name}</span>
                  <span className="mx-1.5 text-white/40">·</span>
                  <span>{item.text}</span>
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
