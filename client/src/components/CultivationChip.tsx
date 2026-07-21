import { useEffect, useState } from "react";
import {
  cultivationLabel,
  ensureCultivationColors,
  getCultivationColor,
  isCultivationRank,
  type CultivationColor,
  type CultivationRank,
} from "../cultivation";

interface CultivationChipProps {
  rank: CultivationRank | string | null | undefined;
  /** Override màu (vd. preview khi chỉnh trong admin) */
  colors?: CultivationColor | null;
  className?: string;
}

/** Chip cảnh giới — màu từ bảng màu server (cache client). */
export function CultivationChip({
  rank,
  colors,
  className = "",
}: CultivationChipProps) {
  const [, setReady] = useState(0);
  useEffect(() => {
    if (colors) return;
    void ensureCultivationColors().then(() => setReady((n) => n + 1));
  }, [colors, rank]);

  if (!isCultivationRank(rank)) return null;
  const color = colors ?? getCultivationColor(rank);
  const label = cultivationLabel(rank);
  if (!color || !label) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide ring-1 ${className}`}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border,
        boxShadow: `inset 0 0 0 1px ${color.border}`,
      }}
      title={label}
    >
      {label}
    </span>
  );
}
