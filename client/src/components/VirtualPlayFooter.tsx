import { Link } from "react-router-dom";
import { VIRTUAL_PLAY_TAGLINE } from "../complianceCopy";

/** Footer nhỏ — gắn lobby / bàn chơi để giữ copy compliance nhất quán. */
export function VirtualPlayFooter({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <p
      className={`text-center text-[10px] leading-relaxed text-[var(--play-muted)] ${className}`}
    >
      {VIRTUAL_PLAY_TAGLINE}
      {!compact ? (
        <>
          {" · "}
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Điều khoản
          </Link>
          {" · "}
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            Bảo mật
          </Link>
          {" · "}
          <Link
            to="/responsible"
            className="underline-offset-2 hover:underline"
          >
            Chơi có trách nhiệm
          </Link>
        </>
      ) : null}
    </p>
  );
}
