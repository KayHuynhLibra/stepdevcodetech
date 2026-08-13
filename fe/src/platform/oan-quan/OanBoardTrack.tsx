/**
 * Viền rãnh truyền thống — vòng khắc nối 12 ô (ngược chiều kim đồng hồ).
 * Bàn dọc: quan trên/dưới, hai cột dân trái/phải.
 * Thứ tự CCW: 0 → 1..5 → 6 → 11..7
 */
export function OanBoardTrack() {
  return (
    <svg
      className="oan-board-track"
      viewBox="0 0 100 168"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="94"
        height="162"
        rx="14"
        ry="14"
        className="oan-board-track__outer"
      />
      <rect
        x="8"
        y="8"
        width="84"
        height="152"
        rx="10"
        ry="10"
        className="oan-board-track__inner"
      />
      {/* Rãnh vòng CCW: quan trên → cột phải → quan dưới → cột trái */}
      <path
        className="oan-board-track__groove"
        d="
          M 50 14
          L 78 14
          L 78 28
          L 78 140
          L 78 154
          L 50 154
          L 22 154
          L 22 140
          L 22 28
          L 22 14
          L 50 14
        "
        fill="none"
      />
      <ellipse cx="50" cy="16" rx="38" ry="10" className="oan-board-track__quan-rim" />
      <ellipse cx="50" cy="152" rx="38" ry="10" className="oan-board-track__quan-rim" />
    </svg>
  );
}
