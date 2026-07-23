import { useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_ROLE_DISPLAY,
  fetchRoleDisplay,
  getRoleDisplayCache,
  normalizeRoleDisplay,
  subscribeRoleDisplay,
  type RoleDisplayPublic,
  type RoleDisplaySlot,
} from "../roleDisplay";

export type RoleRailSlots = Partial<Record<RoleDisplaySlot, ReactNode>>;

interface RoleRailProps {
  slots: RoleRailSlots;
  /** Override từ socket/state nếu có */
  config?: RoleDisplayPublic | null;
  className?: string;
  "aria-label"?: string;
}

export function useRoleDisplay(override?: RoleDisplayPublic | null): RoleDisplayPublic {
  const [cfg, setCfg] = useState<RoleDisplayPublic>(() =>
    normalizeRoleDisplay(override ?? getRoleDisplayCache() ?? DEFAULT_ROLE_DISPLAY),
  );

  useEffect(() => {
    if (override) {
      setCfg(normalizeRoleDisplay(override));
      return;
    }
    let alive = true;
    void fetchRoleDisplay().then((c) => {
      if (alive) setCfg(normalizeRoleDisplay(c));
    });
    const unsub = subscribeRoleDisplay((c) => {
      if (alive) setCfg(normalizeRoleDisplay(c));
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [override]);

  return cfg;
}

/** Rail hiển thị theo thứ tự / size / frame từ mainadmin (chỉ UI). */
export function RoleRail({
  slots,
  config: configOverride,
  className = "",
  "aria-label": ariaLabel = "Vai trò",
}: RoleRailProps) {
  const cfg = useRoleDisplay(configOverride);
  const pills: ReactNode[] = [];
  let idNode: ReactNode = null;

  for (const slot of cfg.order) {
    const node = slots[slot];
    if (!node) continue;
    if (slot === "id") {
      idNode = node;
      continue;
    }
    pills.push(
      <span key={slot} className="role-rail__slot" data-slot={slot}>
        {node}
      </span>,
    );
  }

  const railClass = [
    "role-rail",
    `role-rail--size-${cfg.size}`,
    `role-rail--frame-${cfg.frameStyle}`,
    `role-rail--text-${cfg.textStyle ?? "normal"}`,
    cfg.showGlyph ? "role-rail--glyph" : "role-rail--no-glyph",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={railClass} aria-label={ariaLabel}>
      {pills.length > 0 && <div className="role-rail__pills">{pills}</div>}
      {idNode && <div className="role-rail__id">{idNode}</div>}
    </div>
  );
}
