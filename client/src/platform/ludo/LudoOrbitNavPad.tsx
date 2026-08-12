import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import {
  captureOrbitPose,
  nudgeOrbit,
  type LudoOrbitNudge,
} from "./ludoOrbitNavBus";
import {
  readOrbitLock,
  writeOrbitLock,
  type LudoOrbitPose,
} from "./ludoOrbitLock";

const YAW = 0.22;
const PITCH = 0.14;
/** Zoom step per tick — nhỏ để +/- phóng từ từ khi giữ. */
const ZOOM = 0.028;
const HOLD_MS = 85;

type Props = {
  locked: boolean;
  onLockChange: (next: { locked: boolean; pose: LudoOrbitPose | null }) => void;
  /** sheet = inside XOAY popup */
  variant?: "sheet" | "board";
};

export function LudoOrbitNavPad({
  locked,
  onLockChange,
  variant = "sheet",
}: Props) {
  const holdRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (holdRef.current != null) window.clearInterval(holdRef.current);
    },
    [],
  );

  const afterNudge = useCallback(
    (pose: LudoOrbitPose | null) => {
      if (!pose) return;
      if (locked) {
        const next = { locked: true, pose };
        writeOrbitLock(next);
        onLockChange(next);
      } else {
        onLockChange({ locked: false, pose });
      }
    },
    [locked, onLockChange],
  );

  const nudgeOnce = useCallback(
    (delta: LudoOrbitNudge) => {
      afterNudge(nudgeOrbit(delta));
    },
    [afterNudge],
  );

  const startHold = useCallback(
    (delta: LudoOrbitNudge) => {
      nudgeOnce(delta);
      if (holdRef.current != null) window.clearInterval(holdRef.current);
      holdRef.current = window.setInterval(() => nudgeOnce(delta), HOLD_MS);
    },
    [nudgeOnce],
  );

  const stopHold = useCallback(() => {
    if (holdRef.current != null) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const toggleLock = useCallback(() => {
    if (locked) {
      const cur = readOrbitLock();
      const next = { locked: false, pose: cur.pose };
      writeOrbitLock(next);
      onLockChange(next);
      return;
    }
    const pose = captureOrbitPose() ?? readOrbitLock().pose;
    if (!pose) return;
    const next = { locked: true, pose };
    writeOrbitLock(next);
    onLockChange(next);
  }, [locked, onLockChange]);

  const holdProps = (delta: LudoOrbitNudge) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      startHold(delta);
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
  });

  return (
    <div
      className={`ludo-orbit-nav ludo-orbit-nav--${variant} ${
        locked ? "is-locked" : ""
      }`}
      role="group"
      aria-label="Điều hướng góc nhìn"
    >
      <button
        type="button"
        className="ludo-orbit-nav__btn ludo-orbit-nav__btn--up"
        aria-label="Ngẩng lên"
        {...holdProps({ pitch: -PITCH })}
      >
        ▲
      </button>
      <button
        type="button"
        className="ludo-orbit-nav__btn ludo-orbit-nav__btn--left"
        aria-label="Xoay trái"
        {...holdProps({ yaw: -YAW })}
      >
        ◀
      </button>
      <button
        type="button"
        className={`ludo-orbit-nav__btn ludo-orbit-nav__btn--lock ${
          locked ? "is-on" : ""
        }`}
        aria-label={locked ? "Mở khóa góc" : "Khóa góc"}
        aria-pressed={locked}
        title={
          locked
            ? "Mở khóa — kéo tay trên bàn được"
            : "Khóa góc · D-pad vẫn xoay được"
        }
        onClick={toggleLock}
      >
        {locked ? "🔒" : "◎"}
      </button>
      <button
        type="button"
        className="ludo-orbit-nav__btn ludo-orbit-nav__btn--right"
        aria-label="Xoay phải"
        {...holdProps({ yaw: YAW })}
      >
        ▶
      </button>
      <button
        type="button"
        className="ludo-orbit-nav__btn ludo-orbit-nav__btn--down"
        aria-label="Cúi xuống"
        {...holdProps({ pitch: PITCH })}
      >
        ▼
      </button>
      <div className="ludo-orbit-nav__zoom">
        <button
          type="button"
          className="ludo-orbit-nav__btn ludo-orbit-nav__btn--zoom"
          aria-label="Phóng to"
          {...holdProps({ zoom: -ZOOM })}
        >
          +
        </button>
        <button
          type="button"
          className="ludo-orbit-nav__btn ludo-orbit-nav__btn--zoom"
          aria-label="Thu nhỏ"
          {...holdProps({ zoom: ZOOM })}
        >
          −
        </button>
      </div>
    </div>
  );
}
