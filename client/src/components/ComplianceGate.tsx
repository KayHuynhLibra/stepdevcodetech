import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, getToken } from "../auth";
import { setPlayComplianceAck } from "../compliance";
import { COMPLIANCE_GATE_BODY } from "../complianceCopy";

/**
 * Chặn vào chơi / đăng ký đến khi xác nhận 18+ và Terms.
 * Nếu đã login: đồng bộ `termsAcceptedAt` lên server (best-effort).
 */
export function ComplianceGate({
  title = "Xác nhận trước khi tiếp tục",
  onAccepted,
}: {
  title?: string;
  onAccepted: () => void;
}) {
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!age || !terms) {
      setErr("Cần xác nhận đủ 18 tuổi và đồng ý Điều khoản.");
      return;
    }
    setBusy(true);
    setErr("");
    setPlayComplianceAck();
    if (getToken()) {
      try {
        await api("/api/auth/accept-terms", { method: "POST", body: "{}" });
      } catch {
        /* local ack vẫn đủ để vào lobby; server sync lần sau */
      }
    }
    setBusy(false);
    onAccepted();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-2xl bg-[var(--cream)] p-4 shadow-xl ring-1 ring-[var(--wood-deep)]/15 sm:p-5"
      >
        <p className="play-heading text-base text-[var(--play-ink)]">{title}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--play-muted)]">
          {COMPLIANCE_GATE_BODY}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-[var(--play-ink)]">
          <input
            type="checkbox"
            checked={age}
            onChange={(e) => setAge(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Tôi xác nhận đã đủ 18 tuổi (hoặc tuổi trưởng thành tại nơi tôi sống)
            và việc sử dụng là hợp pháp nơi tôi đang ở.
          </span>
        </label>

        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-[var(--play-ink)]">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Tôi đồng ý{" "}
            <Link to="/terms" className="font-bold text-[var(--wood-deep)] underline">
              Điều khoản
            </Link>{" "}
            (Hoa Kỳ · xu không đổi tiền · trọng tài cá nhân) và{" "}
            <Link
              to="/privacy"
              className="font-bold text-[var(--wood-deep)] underline"
            >
              Chính sách bảo mật
            </Link>
            . Xem thêm{" "}
            <Link
              to="/responsible"
              className="font-bold text-[var(--wood-deep)] underline"
            >
              Chơi có trách nhiệm
            </Link>
            .
          </span>
        </label>

        {err && (
          <p className="mt-2 text-center text-[11px] font-medium text-red-600">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="app-btn-primary mt-4 w-full text-sm"
        >
          {busy ? "Đang lưu…" : "Tiếp tục"}
        </button>
      </form>
    </div>
  );
}
