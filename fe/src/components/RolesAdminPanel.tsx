import {
  ASSIGNABLE_STAFF_ROLES,
  CAP_LABELS,
  capsForPrimaryRole,
  GRANT_LEVEL_LABELS,
  roleDefaultLevel,
  type GrantCapability,
  type UserRoleForGrant,
} from "../grants";
import {
  DEFAULT_ROLE_LABELS,
  resolveRoleGlyph,
  resolveRoleLabel,
  type RoleLabelKey,
} from "../roleDisplay";
import { IdentityBadge } from "./IdentityBadge";
import type { AuthUser } from "../auth";

const SHOWCASE_ROLES: UserRoleForGrant[] = [
  "mainadmin",
  "admin",
  "eco",
  "audit",
  "sgift",
  "ring",
  "pm",
  "tarot78",
  "book78",
  "onl",
  "deal",
  "mod",
  "tutien",
  "user",
];

const MATRIX_CAPS: GrantCapability[] = [
  "staff_dashboard",
  "vault_ops",
  "coupon_ops",
  "games_registry",
  "oracle_cards",
  "oracle_library",
  "pm_assets",
  "gift_manage",
  "ring_manage",
  "see_online",
  "tools_lookup",
  "inter_control",
];

const ROLE_HOME: Partial<Record<UserRoleForGrant, string>> = {
  mainadmin: "/mainadmin/:code",
  admin: "/admin/:code",
  eco: "/eco/:code",
  audit: "/audit/:code",
  sgift: "/sgift/:code",
  ring: "/ring/:code",
  pm: "/pm/:code",
  tarot78: "/tarot78/:code",
  book78: "/book78/:code",
  onl: "/onl/:code",
  deal: "/deal/:code",
  mod: "/mod/:code",
  tutien: "/tutien/:code",
  user: "/player/:code",
};

/** Show-off + quản lý role — mainadmin. */
export function RolesAdminPanel({
  users,
  onAssignPrimary,
  onToggleExtra,
  busy = false,
}: {
  users: AuthUser[];
  onAssignPrimary: (userId: string, role: UserRoleForGrant) => void;
  onToggleExtra: (user: AuthUser, role: UserRoleForGrant) => void;
  busy?: boolean;
}) {
  const staffish = users.filter((u) => u.role !== "user" || (u.extraRoles?.length ?? 0) > 0);

  return (
    <section className="mt-4 space-y-4">
      <div className="app-panel p-3 sm:p-4">
        <p className="play-heading text-sm">Role showcase</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Badge + home + bậc L mặc định — mirror RoleAD labels.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_ROLES.map((role) => {
            const fake: AuthUser = {
              id: `showcase-${role}`,
              code: "SHOW",
              username: role,
              role: role as AuthUser["role"],
              avatar: "/assets/avatars/ludo-p1.svg",
              balance: 0,
              winToday: 0,
              guessesToday: 0,
            };
            const L = roleDefaultLevel(role);
            return (
              <li
                key={role}
                className="rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    {resolveRoleGlyph(role as RoleLabelKey)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--play-ink)]">
                      {resolveRoleLabel(
                        role as RoleLabelKey,
                        DEFAULT_ROLE_LABELS,
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--play-muted)]">
                      {role} · {GRANT_LEVEL_LABELS[L] ?? `L${L}`}
                    </p>
                    <p className="truncate text-[10px] text-[var(--play-muted)]">
                      {ROLE_HOME[role] ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 overflow-hidden rounded-lg bg-[var(--cream)]/80 p-1.5">
                  <IdentityBadge user={fake} compact showPath={false} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="app-panel overflow-x-auto p-3 sm:p-4">
        <p className="play-heading text-sm">Ma trận capability</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Primary role → caps (extras cộng dồn khi gán).
        </p>
        <table className="mt-3 min-w-[640px] w-full border-collapse text-[10px]">
          <thead>
            <tr className="text-left text-[var(--play-muted)]">
              <th className="sticky left-0 bg-[var(--cream)] py-1 pr-2 font-bold">
                Role
              </th>
              {MATRIX_CAPS.map((c) => (
                <th key={c} className="px-1 py-1 font-semibold" title={c}>
                  {CAP_LABELS[c].split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHOWCASE_ROLES.map((role) => {
              const caps = new Set(capsForPrimaryRole(role));
              return (
                <tr
                  key={role}
                  className="border-t border-[var(--wood-deep)]/10"
                >
                  <td className="sticky left-0 bg-[var(--cream)] py-1.5 pr-2 font-bold text-[var(--play-ink)]">
                    {role}
                  </td>
                  {MATRIX_CAPS.map((c) => (
                    <td key={c} className="px-1 py-1.5 text-center">
                      {caps.has(c) ? (
                        <span className="font-bold text-emerald-800">●</span>
                      ) : (
                        <span className="text-[var(--play-muted)]/40">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="app-panel p-3 sm:p-4">
        <p className="play-heading text-sm">Gán role nhanh</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Primary + extras — cùng API RoleAD / User & Bot.
        </p>
        {staffish.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--play-muted)]">
            Chưa có staff ngoài user thường.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {staffish.slice(0, 40).map((u) => (
              <li
                key={u.id}
                className="rounded-xl bg-white/70 px-3 py-2.5 text-xs ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-[var(--play-ink)]">
                      {u.username}{" "}
                      <span className="font-mono font-normal text-[var(--play-muted)]">
                        {u.code}
                      </span>
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      primary={u.role}
                      {(u.extraRoles?.length ?? 0) > 0
                        ? ` · extras=${u.extraRoles!.join(",")}`
                        : ""}
                    </p>
                  </div>
                </div>
                {u.role !== "mainadmin" ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ASSIGNABLE_STAFF_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        disabled={busy || u.role === role}
                        onClick={() => onAssignPrimary(u.id, role)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold disabled:opacity-40 ${
                          u.role === role
                            ? "bg-[var(--wood-deep)] text-[var(--gold-soft)]"
                            : "bg-white ring-1 ring-[var(--wood-deep)]/15"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                ) : null}
                {u.role !== "mainadmin" ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="w-full text-[9px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
                      Extras
                    </span>
                    {ASSIGNABLE_STAFF_ROLES.filter((r) => r !== "user").map(
                      (role) => {
                        const active = (u.extraRoles ?? []).includes(
                          role as AuthUser["role"],
                        );
                        return (
                          <button
                            key={`ex-${role}`}
                            type="button"
                            disabled={busy || u.role === role}
                            onClick={() => onToggleExtra(u, role)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold disabled:opacity-35 ${
                              active
                                ? "bg-violet-800 text-violet-50"
                                : "bg-white ring-1 ring-dashed ring-[var(--wood-deep)]/25"
                            }`}
                          >
                            {role}
                          </button>
                        );
                      },
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
