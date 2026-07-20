import { useEffect, useRef, useState } from "react";

/** Đếm ngược phase theo server — tick 1s, không làm parent re-render mỗi 200ms. */
export function usePhaseRemaining(phaseEndsAt: number, serverTime: number) {
  const offsetRef = useRef(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    offsetRef.current = serverTime - Date.now();
  }, [serverTime]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offsetRef.current;
      setRemaining(Math.max(0, Math.ceil((phaseEndsAt - now) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  return remaining;
}
