import { AnimatePresence, motion } from "framer-motion";
import type { ShoutEvent } from "../shouts";

interface SaintOverlayProps {
  item: (ShoutEvent & { key: string }) | null;
}

/** Tin Saint — phủ toàn màn vài giây (broadcast từ server). */
export function SaintOverlay({ item }: SaintOverlayProps) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-[#041018]/72 backdrop-blur-[2px]" />
          <motion.div
            initial={{ scale: 0.82, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f3d6e] via-[#123a66] to-[#0a2440] px-6 py-8 text-center shadow-2xl ring-2 ring-[#1a8fd4]/50"
          >
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#d6f0ff]/80">
              Saint
            </p>
            <img
              src={item.avatar || "/assets/ui/avatar-default.png"}
              alt=""
              className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-[#1a8fd4]/70 shadow-lg"
            />
            <p className="mt-3 font-play text-lg font-bold text-white">
              {item.name}
            </p>
            <p className="mt-3 text-base font-semibold leading-snug text-[#d6f0ff]">
              {item.text}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
