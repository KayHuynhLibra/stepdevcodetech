import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../auth";
import {
  NAME_COLOR_PRESETS,
  NAME_EFFECT_PRESETS,
  normalizeNameColor,
  normalizeNameEffect,
  type NameColorId,
  type NameEffectId,
} from "../nameColors";
import {
  AVATAR_FRAME_PRESETS,
  ID_FRAME_PRESETS,
  NAME_FRAME_PRESETS,
  PROFILE_THEME_PRESETS,
  normalizeAvatarFrame,
  normalizeIdFrame,
  normalizeNameFrame,
  normalizeProfileTheme,
  type AvatarFrameId,
  type IdFrameId,
  type NameFrameId,
  type ProfileThemeId,
} from "../profileStyles";
import {
  DISPLAY_BADGE_MAX,
  DISPLAY_BADGE_PRESETS,
  displayBadgeDef,
  normalizeDisplayBadges,
  type DisplayBadgeId,
} from "../displayBadges";
import {
  DEFAULT_ROLE_DISPLAY,
  DEFAULT_ROLE_LABELS,
  ROLE_BG_PRESETS,
  ROLE_COLOR_PRESETS,
  ROLE_DISPLAY_FRAMES,
  ROLE_DISPLAY_FRAME_LABELS,
  ROLE_DISPLAY_SIZES,
  ROLE_DISPLAY_SIZE_LABELS,
  ROLE_DISPLAY_SLOTS,
  ROLE_DISPLAY_SLOT_LABELS,
  ROLE_DISPLAY_TEXT_STYLES,
  ROLE_DISPLAY_TEXT_LABELS,
  ROLE_LABEL_KEYS,
  ROLE_LABEL_UI_LABELS,
  normalizeRoleDisplay,
  resolveRoleColorStyle,
  resolveRoleLabel,
  type RoleColorOverride,
  type RoleDisplayPublic,
  type RoleDisplaySlot,
  type RoleLabelKey,
} from "../roleDisplay";
import { BottomSheet } from "./BottomSheet";
import { IdentityBadge } from "./IdentityBadge";
import { CelestialProfilePreview } from "./CelestialProfilePreview";

type CosmeticsTab =
  | "color"
  | "effect"
  | "avatar"
  | "theme"
  | "nameFrame"
  | "idFrame"
  | "badges"
  | "role";

const BASE_TABS: { id: CosmeticsTab; label: string }[] = [
  { id: "color", label: "Màu chữ" },
  { id: "effect", label: "FX" },
  { id: "avatar", label: "Khung AV" },
  { id: "theme", label: "Nền" },
  { id: "nameFrame", label: "Tên" },
  { id: "idFrame", label: "ID" },
  { id: "badges", label: "Huy hiệu" },
];

export interface CosmeticsPatch {
  color?: NameColorId;
  effect?: NameEffectId;
  avatarFrame?: AvatarFrameId;
  profileTheme?: ProfileThemeId;
  nameFrame?: NameFrameId;
  idFrame?: IdFrameId;
  displayBadges?: DisplayBadgeId[];
}

interface CosmeticsEditSheetProps {
  open: boolean;
  user: AuthUser | null;
  roleDisplay?: RoleDisplayPublic | null;
  initialTab?: CosmeticsTab;
  /** Seed rail khi mở (mainadmin) — chỉnh local, chỉ đẩy lên khi Lưu */
  roleDisplayDraft?: RoleDisplayPublic | null;
  onSaveRoleDisplay?: (cfg: RoleDisplayPublic) => void | Promise<void>;
  roleDisplayBusy?: boolean;
  onClose: () => void;
  /** Lưu cosmetics user (nên patch nhẹ, không reload cả dashboard) */
  onApply: (userId: string, patch: CosmeticsPatch) => void | Promise<void>;
}

function chipClass(
  active: boolean,
  activeTone = "bg-[var(--wood-deep)] text-white ring-[var(--wood-deep)]",
) {
  return `rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${
    active
      ? activeTone
      : "bg-white text-[var(--play-ink)] ring-[var(--wood-deep)]/20"
  }`;
}

function moveSlot(
  order: RoleDisplaySlot[],
  slot: RoleDisplaySlot,
  dir: -1 | 1,
): RoleDisplaySlot[] {
  const i = order.indexOf(slot);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function cloneRole(cfg: RoleDisplayPublic | null | undefined): RoleDisplayPublic {
  const n = normalizeRoleDisplay(cfg ?? DEFAULT_ROLE_DISPLAY);
  return {
    ...n,
    order: [...n.order],
    roleLabels: { ...n.roleLabels },
    roleColors: Object.fromEntries(
      Object.entries(n.roleColors).map(([k, v]) => [k, { ...v }]),
    ) as RoleDisplayPublic["roleColors"],
  };
}

type UserCosmeticsDraft = {
  nameColor: NameColorId;
  nameEffect: NameEffectId;
  avatarFrame: AvatarFrameId;
  profileTheme: ProfileThemeId;
  nameFrame: NameFrameId;
  idFrame: IdFrameId;
  displayBadges: DisplayBadgeId[];
};

function draftFromUser(user: AuthUser): UserCosmeticsDraft {
  return {
    nameColor: normalizeNameColor(user.nameColor),
    nameEffect: normalizeNameEffect(user.nameEffect),
    avatarFrame: normalizeAvatarFrame(user.avatarFrame),
    profileTheme: normalizeProfileTheme(user.profileTheme),
    nameFrame: normalizeNameFrame(user.nameFrame),
    idFrame: normalizeIdFrame(user.idFrame),
    displayBadges: normalizeDisplayBadges(user.displayBadges),
  };
}

/**
 * Popup cosmetics — draft local + debounce API + preview nhẹ.
 * Chi tiết role: chọn 1 role để chỉnh (không render 16 hàng color cùng lúc).
 */
export function CosmeticsEditSheet({
  open,
  user,
  roleDisplay,
  initialTab = "color",
  roleDisplayDraft,
  onSaveRoleDisplay,
  roleDisplayBusy = false,
  onClose,
  onApply,
}: CosmeticsEditSheetProps) {
  const canEditRole = !!(roleDisplayDraft && onSaveRoleDisplay);
  const tabs = canEditRole
    ? [...BASE_TABS, { id: "role" as const, label: "Role" }]
    : BASE_TABS;

  const [tab, setTab] = useState<CosmeticsTab>(initialTab);
  const [draft, setDraft] = useState<UserCosmeticsDraft | null>(null);
  const [roleLocal, setRoleLocal] = useState<RoleDisplayPublic | null>(null);
  const [editRoleKey, setEditRoleKey] = useState<RoleLabelKey>("mainadmin");
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<CosmeticsPatch>({});
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setTab(initialTab);
    setDraft(draftFromUser(user));
    setRoleLocal(
      canEditRole
        ? cloneRole(roleDisplayDraft)
        : cloneRole(roleDisplay ?? DEFAULT_ROLE_DISPLAY),
    );
    setEditRoleKey("mainadmin");
    setShowFullPreview(false);
    setSaveHint(null);
    userIdRef.current = user.id;
    pendingPatchRef.current = {};
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [open, user?.id, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  if (!open || !user || !draft) return null;

  const previewUser: AuthUser = {
    ...user,
    nameColor: draft.nameColor,
    nameEffect: draft.nameEffect,
    avatarFrame: draft.avatarFrame,
    profileTheme: draft.profileTheme,
    nameFrame: draft.nameFrame,
    idFrame: draft.idFrame,
    displayBadges: draft.displayBadges,
  };
  const rd = roleLocal ?? roleDisplay ?? DEFAULT_ROLE_DISPLAY;

  const flushPending = () => {
    const uid = userIdRef.current;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!uid || Object.keys(patch).length === 0) return;
    void onApply(uid, patch);
    setSaveHint("Đã lưu cosmetics");
    window.setTimeout(() => setSaveHint(null), 1200);
  };

  const queuePatch = (patch: CosmeticsPatch) => {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      flushPending();
    }, 380);
  };

  const applyLocal = (patch: CosmeticsPatch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(patch.color != null ? { nameColor: patch.color } : {}),
        ...(patch.effect != null ? { nameEffect: patch.effect } : {}),
        ...(patch.avatarFrame != null
          ? { avatarFrame: patch.avatarFrame }
          : {}),
        ...(patch.profileTheme != null
          ? { profileTheme: patch.profileTheme }
          : {}),
        ...(patch.nameFrame != null ? { nameFrame: patch.nameFrame } : {}),
        ...(patch.idFrame != null ? { idFrame: patch.idFrame } : {}),
        ...(patch.displayBadges != null
          ? { displayBadges: patch.displayBadges }
          : {}),
      };
    });
    queuePatch(patch);
  };

  const toggleBadge = (badgeId: DisplayBadgeId) => {
    const cur = draft.displayBadges;
    const next = cur.includes(badgeId)
      ? cur.filter((b) => b !== badgeId)
      : cur.length >= DISPLAY_BADGE_MAX
        ? cur
        : [...cur, badgeId];
    if (next.length === cur.length && !cur.includes(badgeId)) {
      setSaveHint(`Tối đa ${DISPLAY_BADGE_MAX} huy hiệu`);
      return;
    }
    applyLocal({ displayBadges: next });
  };

  const roleEntry = roleLocal?.roleColors[editRoleKey];
  const patchRoleColor = (patch: RoleColorOverride) => {
    if (!roleLocal) return;
    const cur = roleLocal.roleColors[editRoleKey] ?? {};
    const nextEntry: RoleColorOverride = { ...cur, ...patch };
    if (!nextEntry.text) delete nextEntry.text;
    if (!nextEntry.bg) delete nextEntry.bg;
    const nextColors = { ...roleLocal.roleColors };
    if (!nextEntry.text && !nextEntry.bg) delete nextColors[editRoleKey];
    else nextColors[editRoleKey] = nextEntry;
    setRoleLocal({ ...roleLocal, roleColors: nextColors });
  };

  const handleClose = () => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
      flushPending();
    }
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      title={`Cosmetics · ${user.displayName ?? user.username}`}
      onClose={handleClose}
      heightClass="max-h-[88vh]"
      backdropClass="bg-black/25"
      shellClass="sheet-shell-light !text-[var(--play-ink)]"
    >
      {/* Preview nhẹ — chỉ badge; hồ sơ đầy đủ ẩn (Celestial nặng) */}
      <div className="mb-2 overflow-hidden rounded-lg bg-[rgba(255,248,232,0.98)] ring-1 ring-[var(--wood-deep)]/15">
        <div className="flex items-center justify-between border-b border-[var(--wood-deep)]/10 px-2 py-1">
          <p className="text-[8px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
            Preview bàn
          </p>
          <button
            type="button"
            onClick={() => setShowFullPreview((v) => !v)}
            className="text-[9px] font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
          >
            {showFullPreview ? "Ẩn hồ sơ" : "Hồ sơ đầy đủ"}
          </button>
        </div>
        <div className="px-1.5 py-1.5">
          <IdentityBadge
            user={previewUser}
            compact
            showPath={false}
            roleDisplay={rd}
          />
        </div>
        {showFullPreview && (
          <div className="border-t border-[var(--wood-deep)]/10">
            <CelestialProfilePreview
              user={previewUser}
              roleDisplay={rd}
              compact
              className="!rounded-none !shadow-none"
            />
          </div>
        )}
      </div>

      <p className="mb-1.5 font-mono text-[9px] leading-tight text-[var(--play-muted)]">
        {draft.nameColor} · {draft.nameEffect} · {draft.avatarFrame} ·{" "}
        {draft.nameFrame} · {draft.idFrame} · {draft.profileTheme}
        {saveHint ? ` · ${saveHint}` : " · tự lưu sau khi chọn"}
      </p>

      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
              tab === t.id
                ? "bg-[var(--wood-deep)] text-white ring-[var(--wood-deep)]"
                : "bg-white text-[var(--play-ink)] ring-[var(--wood-deep)]/15"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "color" && (
        <section>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--play-ink)]">
            Màu chữ nick
          </p>
          <div className="flex flex-wrap gap-1">
            {NAME_COLOR_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => applyLocal({ color: c.id })}
                className={chipClass(draft.nameColor === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "effect" && (
        <section>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--play-ink)]">
            Hiệu ứng chữ
          </p>
          <div className="flex flex-wrap gap-1">
            {NAME_EFFECT_PRESETS.map((fx) => (
              <button
                key={fx.id}
                type="button"
                onClick={() => applyLocal({ effect: fx.id })}
                className={chipClass(
                  draft.nameEffect === fx.id,
                  "bg-indigo-800 text-white ring-indigo-800",
                )}
              >
                {fx.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "avatar" && (
        <section>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--play-ink)]">
            Khung avatar
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {AVATAR_FRAME_PRESETS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyLocal({ avatarFrame: f.id })}
                className={`${chipClass(
                  draft.avatarFrame === f.id,
                  "bg-amber-800 text-white ring-amber-800",
                )} w-full justify-center`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "theme" && (
        <section>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--play-ink)]">
            Nền hồ sơ
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {PROFILE_THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyLocal({ profileTheme: t.id })}
                className={`${chipClass(
                  draft.profileTheme === t.id,
                  "bg-violet-800 text-white ring-violet-800",
                )} w-full justify-center`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "nameFrame" && (
        <section>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--play-ink)]">
            Khung tên
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {NAME_FRAME_PRESETS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyLocal({ nameFrame: f.id })}
                className={`${chipClass(
                  draft.nameFrame === f.id,
                  "bg-rose-800 text-white ring-rose-800",
                )} w-full justify-center`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "idFrame" && (
        <section>
          <p className="mb-1.5 text-[11px] font-bold text-[var(--play-ink)]">
            Khung ID
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {ID_FRAME_PRESETS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyLocal({ idFrame: f.id })}
                className={`${chipClass(
                  draft.idFrame === f.id,
                  "bg-teal-800 text-white ring-teal-800",
                )} w-full justify-center`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "badges" && (
        <section>
          <p className="mb-1 text-[11px] font-bold text-[var(--play-ink)]">
            Huy hiệu · tối đa {DISPLAY_BADGE_MAX}
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {DISPLAY_BADGE_PRESETS.map((b) => {
              const on = draft.displayBadges.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBadge(b.id)}
                  className={`${chipClass(on)} w-full truncate`}
                  title={b.label}
                >
                  {b.glyph} {b.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === "role" && canEditRole && roleLocal && (
        <section className="space-y-2.5">
          <p className="text-[10px] text-[var(--play-muted)]">
            Rail toàn site — chỉnh local, bấm Lưu khi xong (không lag từng lần
            đổi màu).
          </p>

          <div>
            <p className="mb-1 text-[10px] font-bold text-[var(--play-ink)]">
              Thứ tự
            </p>
            <div className="flex flex-wrap gap-1">
              {roleLocal.order.map((slot, idx) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-[var(--wood-deep)]/15"
                >
                  <span className="font-mono text-[8px] text-[var(--play-muted)]">
                    {idx + 1}
                  </span>
                  {ROLE_DISPLAY_SLOT_LABELS[slot]}
                  <button
                    type="button"
                    disabled={idx === 0}
                    aria-label="Lên"
                    onClick={() =>
                      setRoleLocal({
                        ...roleLocal,
                        order: moveSlot(roleLocal.order, slot, -1),
                      })
                    }
                    className="rounded px-0.5 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx === roleLocal.order.length - 1}
                    aria-label="Xuống"
                    onClick={() =>
                      setRoleLocal({
                        ...roleLocal,
                        order: moveSlot(roleLocal.order, slot, 1),
                      })
                    }
                    className="rounded px-0.5 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              className="mt-1 text-[9px] font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
              onClick={() =>
                setRoleLocal({
                  ...roleLocal,
                  order: [...ROLE_DISPLAY_SLOTS],
                })
              }
            >
              Reset thứ tự
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-[10px] font-bold text-[var(--play-ink)]">
                Cỡ
              </p>
              <div className="flex flex-wrap gap-1">
                {ROLE_DISPLAY_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setRoleLocal({ ...roleLocal, size: sz })}
                    className={chipClass(roleLocal.size === sz)}
                  >
                    {ROLE_DISPLAY_SIZE_LABELS[sz]}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-[10px] font-bold text-[var(--play-ink)]">
                Style chữ
              </p>
              <div className="flex flex-wrap gap-1">
                {ROLE_DISPLAY_TEXT_STYLES.map((ts) => (
                  <button
                    key={ts}
                    type="button"
                    onClick={() =>
                      setRoleLocal({ ...roleLocal, textStyle: ts })
                    }
                    className={chipClass(roleLocal.textStyle === ts)}
                  >
                    {ROLE_DISPLAY_TEXT_LABELS[ts]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold text-[var(--play-ink)]">
              Khung
            </p>
            <div className="grid grid-cols-4 gap-1">
              {ROLE_DISPLAY_FRAMES.map((fr) => (
                <button
                  key={fr}
                  type="button"
                  onClick={() =>
                    setRoleLocal({ ...roleLocal, frameStyle: fr })
                  }
                  className={`${chipClass(roleLocal.frameStyle === fr)} w-full truncate`}
                >
                  {ROLE_DISPLAY_FRAME_LABELS[fr]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[10px] font-semibold text-[var(--play-ink)]">
            <input
              type="checkbox"
              checked={roleLocal.showGlyph}
              onChange={(e) =>
                setRoleLocal({
                  ...roleLocal,
                  showGlyph: e.target.checked,
                })
              }
            />
            Icon glyph trên pill
          </label>

          {/* Chi tiết 1 role — tránh 16 hàng color picker */}
          <div className="rounded-lg bg-white/80 p-2 ring-1 ring-[var(--wood-deep)]/12">
            <p className="mb-1 text-[10px] font-bold text-[var(--play-ink)]">
              Chi tiết từng role
            </p>
            <select
              value={editRoleKey}
              onChange={(e) =>
                setEditRoleKey(e.target.value as RoleLabelKey)
              }
              className="mb-2 w-full rounded-md border border-[var(--wood-deep)]/20 bg-white px-2 py-1.5 text-[12px] font-semibold"
            >
              {ROLE_LABEL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {ROLE_LABEL_UI_LABELS[key]}
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={24}
              placeholder={DEFAULT_ROLE_LABELS[editRoleKey]}
              value={roleLocal.roleLabels[editRoleKey] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const next = { ...roleLocal.roleLabels };
                if (!v.trim()) delete next[editRoleKey];
                else next[editRoleKey] = v;
                setRoleLocal({ ...roleLocal, roleLabels: next });
              }}
              className="mb-2 w-full rounded border border-[var(--wood-deep)]/20 bg-white px-2 py-1 text-[12px] font-semibold outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--play-muted)]">
                Chữ
                <input
                  type="color"
                  value={roleEntry?.text ?? "#E3D8C4"}
                  onChange={(e) =>
                    patchRoleColor({ text: e.target.value.toUpperCase() })
                  }
                  className="h-7 w-8 cursor-pointer rounded border border-[var(--wood-deep)]/25 bg-transparent p-0"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--play-muted)]">
                Nền
                <input
                  type="color"
                  value={roleEntry?.bg ?? "#1A2638"}
                  onChange={(e) =>
                    patchRoleColor({ bg: e.target.value.toUpperCase() })
                  }
                  className="h-7 w-8 cursor-pointer rounded border border-[var(--wood-deep)]/25 bg-transparent p-0"
                />
              </label>
              <span
                className="role-pill role-pill--player px-2 py-0.5 text-[10px]"
                style={resolveRoleColorStyle(editRoleKey, roleLocal.roleColors)}
              >
                {resolveRoleLabel(editRoleKey, roleLocal.roleLabels)}
              </span>
              <button
                type="button"
                className="text-[9px] font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
                onClick={() => {
                  const next = { ...roleLocal.roleColors };
                  delete next[editRoleKey];
                  setRoleLocal({ ...roleLocal, roleColors: next });
                }}
              >
                Xóa màu role này
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {ROLE_COLOR_PRESETS.slice(0, 6).map((p) => (
                <button
                  key={`t-${p.id}`}
                  type="button"
                  onClick={() => patchRoleColor({ text: p.hex })}
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                  style={{ color: p.hex }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {ROLE_BG_PRESETS.slice(0, 6).map((p) => (
                <button
                  key={`b-${p.id}`}
                  type="button"
                  onClick={() => patchRoleColor({ bg: p.hex })}
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white ring-1 ring-white/20"
                  style={{ background: p.hex }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`rounded-lg bg-[#121d2d] p-2 ring-1 ring-white/10 role-rail--size-${roleLocal.size} role-rail--frame-${roleLocal.frameStyle} role-rail--text-${roleLocal.textStyle} ${
              roleLocal.showGlyph ? "role-rail--glyph" : "role-rail--no-glyph"
            }`}
          >
            <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-white/45">
              Preview rail
            </p>
            <div className="role-rail__pills !justify-start">
              {roleLocal.order
                .filter((s) => s !== "id" && s !== "level")
                .flatMap((slot) => {
                  if (slot === "badges") {
                    const badges = draft.displayBadges;
                    if (badges.length === 0) {
                      return [
                        <span
                          key="badges-empty"
                          className="role-pill role-pill--badge opacity-50"
                        >
                          <span className="role-pill__glyph" aria-hidden>
                            ★
                          </span>
                          <span className="role-pill__text">Huy hiệu</span>
                        </span>,
                      ];
                    }
                    return badges.map((bid) => {
                      const def = displayBadgeDef(bid);
                      if (!def) return null;
                      return (
                        <span
                          key={def.id}
                          className={`role-pill role-pill--badge role-pill--badge-${def.tone}`}
                        >
                          <span className="role-pill__glyph" aria-hidden>
                            {def.glyph}
                          </span>
                          <span className="role-pill__text">{def.label}</span>
                        </span>
                      );
                    });
                  }
                  const labelKey: RoleLabelKey =
                    slot === "couple"
                      ? "couple"
                      : slot === "vip"
                        ? "vip"
                        : slot === "role"
                          ? user.role === "user"
                            ? "user"
                            : (user.role as RoleLabelKey)
                          : slot === "cult"
                            ? "tutien"
                            : "player";
                  return [
                    <span
                      key={slot}
                      className={`role-pill role-pill--${
                        slot === "role"
                          ? user.role === "user"
                            ? "player"
                            : user.role
                          : slot
                      }`}
                      style={resolveRoleColorStyle(
                        labelKey,
                        roleLocal.roleColors,
                      )}
                    >
                      <span className="role-pill__glyph" aria-hidden>
                        {slot === "couple"
                          ? "♥"
                          : slot === "vip"
                            ? "★"
                            : slot === "cult"
                              ? "ᚱ"
                              : "👤"}
                      </span>
                      <span className="role-pill__text">
                        {resolveRoleLabel(labelKey, roleLocal.roleLabels)}
                      </span>
                    </span>,
                  ];
                })}
            </div>
          </div>

          <button
            type="button"
            disabled={roleDisplayBusy}
            onClick={() => void onSaveRoleDisplay?.(roleLocal)}
            className="app-btn-primary !w-auto !px-3 !py-1.5 !text-[11px] disabled:opacity-50"
          >
            {roleDisplayBusy ? "…" : "Lưu hiển thị role"}
          </button>
        </section>
      )}
    </BottomSheet>
  );
}
