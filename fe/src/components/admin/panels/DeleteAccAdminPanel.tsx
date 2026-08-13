import { useState } from "react";
import { api } from "../../../auth";

type AdminUser = {
  id: string;
  username: string;
  code: string;
  role: string;
  banned?: boolean;
};

export function DeleteAccAdminPanel({
  users,
  onMsg,
  onDeleted,
}: {
  users: AdminUser[];
  onMsg: (s: string) => void;
  onDeleted?: () => void | Promise<void>;
}) {
  const [targetId, setTargetId] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const target = users.find((u) => u.id === targetId);

  const runDelete = async () => {
    if (!targetId || !confirmName.trim()) {
      onMsg("Chọn user và gõ đúng username để xác nhận");
      return;
    }
    if (!target) {
      onMsg("Không tìm thấy user");
      return;
    }
    if (
      !window.confirm(
        `XÓA VĨNH VIỄN «${target.username}» (ID ${target.code})?\nKhông hoàn tác được.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api("/api/mainadmin/user-delete", {
        method: "POST",
        body: JSON.stringify({
          userId: targetId,
          confirmUsername: confirmName.trim(),
        }),
      });
      onMsg(`Đã xóa tài khoản ${target.username}`);
      setTargetId("");
      setConfirmName("");
      await onDeleted?.();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi xóa");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel mt-4 space-y-3 p-3 ring-2 ring-rose-500/40">
      <div>
        <p className="play-heading text-sm text-rose-800">
          Xóa tài khoản (không hoàn tác)
        </p>
        <p className="mt-1 text-[11px] text-[var(--play-muted)]">
          Tab riêng để tránh xóa nhầm. Khóa/mở khóa vẫn ở «User &amp; Bot».
          Không xóa được mainadmin. Phải gõ đúng username để xác nhận.
        </p>
      </div>
      <label className="block text-[11px] font-semibold text-[var(--play-muted)]">
        Chọn tài khoản
        <select
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            setConfirmName("");
          }}
          className="app-input mt-1"
        >
          <option value="">— Chọn user —</option>
          {users
            .filter((u) => u.role !== "mainadmin")
            .slice()
            .sort((a, b) => a.username.localeCompare(b.username, "vi"))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} · ID {u.code || "—"} · {u.role}
                {u.banned ? " · ĐÃ KHÓA" : ""}
              </option>
            ))}
        </select>
      </label>
      {targetId && target ? (
        <>
          <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-900 ring-1 ring-rose-200">
            Đang chọn:{" "}
            <span className="font-mono">{target.username}</span>
            {" · "}
            Gõ đúng username bên dưới rồi bấm Xóa.
          </p>
          <label className="block text-[11px] font-semibold text-[var(--play-muted)]">
            Gõ username để xác nhận
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="username chính xác"
              className="app-input mt-1 font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !confirmName.trim() ||
              confirmName.trim().toLowerCase() !==
                target.username.toLowerCase()
            }
            onClick={() => void runDelete()}
            className="w-full rounded-xl bg-rose-700 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {busy ? "Đang xóa…" : "Xóa vĩnh viễn tài khoản"}
          </button>
        </>
      ) : null}
    </section>
  );
}
