import { AnimatePresence, motion } from "framer-motion";
import type { ShoutEvent } from "../shouts";

interface SaintOverlayProps {
  item: (ShoutEvent & { key: string }) | null;
  onDismiss?: () => void;
}

/** Tin Saint — phủ toàn màn; chạm màn hình để tắt liền. */
export function SaintOverlay({ item, onDismiss }: SaintOverlayProps) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.key}
          role="button"
          tabIndex={0}
          aria-label="Đóng tin Saint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] flex cursor-pointer items-center justify-center px-4"
          onClick={onDismiss}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onDismiss?.();
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[var(--night)]/78 backdrop-blur-[2px]" />
          <motion.div
            initial={{ scale: 0.82, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="pointer-events-none relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-[#2a6b5e] via-[#163832] to-[#0a1c18] px-6 py-8 text-center shadow-2xl shadow-[0_0_48px_rgba(61,184,160,0.4)] ring-2 ring-[var(--jade-soft)]/65"
          >
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--jade-soft)]/90">
              Saint
            </p>
            <p className="mb-2 text-[10px] text-white/45">Chạm để tắt</p>
            <img
              src={item.avatar || "/assets/ui/avatar-default.png"}
              alt=""
              className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-[var(--jade)]/80 shadow-lg"
            />
            <p className="mt-3 font-play text-lg font-bold text-[var(--cream)]">
              {item.name}
            </p>
            <p className="mt-3 text-base font-semibold leading-snug text-[var(--jade-soft)]">
              {item.text}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
