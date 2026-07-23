/** Badge hạng BXH — vàng / bạc / đồng cho top 3, cùng style mọi bảng. */
export function rankBadgeClass(rank: number): string {
  if (rank === 1) return "rank-badge rank-badge--1";
  if (rank === 2) return "rank-badge rank-badge--2";
  if (rank === 3) return "rank-badge rank-badge--3";
  return "rank-badge rank-badge--n";
}

export function sheetRowClass(rank: number, isYou?: boolean): string {
  const base = "lb-sheet-row";
  const you = isYou ? " lb-sheet-row--you" : "";
  if (rank === 1) return `${base} lb-sheet-row--1${you}`;
  if (rank === 2) return `${base} lb-sheet-row--2${you}`;
  if (rank === 3) return `${base} lb-sheet-row--3${you}`;
  return `${base}${you}`;
}

export function zoneRowClass(rank: number, isYou?: boolean): string {
  const base = "rank-row";
  const you = isYou ? " rank-row--you" : "";
  if (rank === 1) return `${base} rank-row--1${you}`;
  if (rank === 2) return `${base} rank-row--2${you}`;
  if (rank === 3) return `${base} rank-row--3${you}`;
  return `${base}${you}`;
}

interface RankBadgeProps {
  rank: number;
  size?: "sm" | "md";
}

export function RankBadge({ rank, size = "md" }: RankBadgeProps) {
  return (
    <span
      className={`${rankBadgeClass(rank)} ${
        size === "sm" ? "rank-badge--sm" : ""
      }`}
    >
      {rank}
    </span>
  );
}
