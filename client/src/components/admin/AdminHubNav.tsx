import { useState } from "react";
import {
  ADMIN_HUBS,
  type AdminHubId,
  type AdminTabId,
  TAB_LABELS,
  hubForTab,
} from "./adminHubs";
import { AdminModal } from "./AdminModal";
import {
  AdminPickGrid,
  AdminPickTrigger,
  AdminTabBar,
} from "./AdminTabBar";

/** Hub cấp 1 + tab con — chọn qua popup, không tràn hàng. */
export function AdminHubNav({
  activeTab,
  onSelectTab,
  visibleTabs,
  tabLabelOverrides,
}: {
  activeTab: AdminTabId;
  onSelectTab: (id: AdminTabId) => void;
  visibleTabs: { id: AdminTabId; label: string; show: boolean }[];
  /** Vault label đổi theo game quản lý */
  tabLabelOverrides?: Partial<Record<AdminTabId, string>>;
}) {
  const [hubOpen, setHubOpen] = useState(false);
  const activeHub = hubForTab(activeTab);
  const visibleIds = new Set(
    visibleTabs.filter((t) => t.show).map((t) => t.id),
  );

  const hubs = ADMIN_HUBS.filter((h) =>
    h.tabs.some((t) => visibleIds.has(t)),
  );

  const subTabs = visibleTabs.filter(
    (t) => t.show && hubForTab(t.id) === activeHub,
  );

  const labelFor = (id: AdminTabId, fallback: string) =>
    tabLabelOverrides?.[id] ?? TAB_LABELS[id] ?? fallback;

  const activeHubLabel =
    hubs.find((h) => h.id === activeHub)?.label ?? "Hub";
  const activeSubLabel =
    subTabs.find((t) => t.id === activeTab)?.label ??
    labelFor(activeTab, activeTab);

  const pickHub = (hubId: AdminHubId) => {
    setHubOpen(false);
    if (hubId === activeHub) return;
    const hub = ADMIN_HUBS.find((h) => h.id === hubId);
    const first = hub?.tabs.find((t) => visibleIds.has(t));
    if (first) onSelectTab(first);
  };

  return (
    <div className="admin-hub-nav">
      <div className="admin-hub-nav__picks">
        <AdminPickTrigger
          label="Hub"
          value={activeHubLabel}
          ariaLabel={`Hub: ${activeHubLabel}`}
          onClick={() => setHubOpen(true)}
        />
        {subTabs.length > 1 ? (
          <AdminTabBar
            tabs={subTabs.map((t) => ({
              ...t,
              label: labelFor(t.id, t.label),
            }))}
            active={activeTab}
            onSelect={onSelectTab}
            activeLabel={activeSubLabel}
            pickLabel="Mục"
            pickTitle={`Mục · ${activeHubLabel}`}
            pickSubtitle="Chọn mục trong hub — danh sách đầy đủ, không bị cắt"
          />
        ) : (
          <p
            className="admin-tabs__active admin-hub-nav__solo"
            aria-live="polite"
          >
            <span className="admin-tabs__active-dot" aria-hidden />
            {activeSubLabel}
          </p>
        )}
      </div>

      <AdminModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        title="Chọn hub"
        subtitle="Tổng quan · Người dùng · Kinh tế · Nội dung · Vận hành · Inbox"
      >
        <AdminPickGrid
          options={hubs.map((h) => ({ id: h.id, label: h.label }))}
          active={activeHub}
          onSelect={pickHub}
        />
      </AdminModal>
    </div>
  );
}
