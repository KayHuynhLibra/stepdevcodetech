import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AUTH_LOGIN } from "../auth";

type Doc = "terms" | "privacy";

const TERMS_VI = {
  title: "Điều khoản sử dụng",
  updated: "Cập nhật: 22/07/2026",
  sections: [
    {
      h: "1. Bản chất dịch vụ",
      p: [
        "Đây là demo giải trí web (tarot / bánh xe). Số dư trong game gọi là «xu» — điểm ảo, không phải tiền, không có giá trị quy đổi tiền mặt / crypto / hàng hóa tiền thật qua dịch vụ này.",
        "Không phải dịch vụ cá cược tiền thật có giấy phép. Không có cổng thanh toán nạp/rút tiền thật trong mã nguồn công bố.",
      ],
    },
    {
      h: "2. Độ tuổi (18+)",
      p: [
        "Bạn phải đủ 18 tuổi (hoặc đủ tuổi trưởng thành tại nơi bạn sống, nếu cao hơn) để đăng ký hoặc chơi khách.",
        "Dịch vụ không dành cho trẻ em dưới 13 tuổi.",
      ],
    },
    {
      h: "3. Tài khoản & khách",
      p: [
        "Bạn chịu trách nhiệm bảo mật mật khẩu và mã khôi phục. Phiên khách có giới hạn và có thể bị ràng buộc chống lạm dụng (ví dụ IP).",
        "Ban điều hành có thể khóa / mute tài khoản khi vi phạm.",
      ],
    },
    {
      h: "4. Xu & bảng xếp hạng",
      p: [
        "Xu và vật phẩm ảo chỉ dùng trong dịch vụ. Bảng «Đại gia» / cao thủ là xếp hạng điểm ảo mang tính giải trí, không phải báo cáo tài chính.",
      ],
    },
    {
      h: "5. Miễn trừ",
      p: [
        "Dịch vụ cung cấp «nguyên trạng». Không dùng dịch vụ nếu pháp luật nơi bạn sống cấm loại hình giải trí này.",
        "Văn bản này không thay thế tư vấn pháp lý. Bản tiếng Anh đầy đủ: file TERMS.md trên repository.",
      ],
    },
  ],
};

const PRIVACY_VI = {
  title: "Chính sách bảo mật",
  updated: "Cập nhật: 22/07/2026",
  sections: [
    {
      h: "1. Dữ liệu xử lý",
      p: [
        "Tài khoản: username, hash mật khẩu, nickname/avatar, role.",
        "Phiên: token đăng nhập, mã thiết bị/phiên.",
        "Gameplay: lịch sử ván/quay, số dư xu, chat.",
        "Chống lạm dụng: địa chỉ IP, tra cứu địa lý thô (công cụ staff), gắn khách–IP.",
      ],
    },
    {
      h: "2. Mục đích",
      p: [
        "Vận hành game, xác thực, chống gian lận / đa tài khoản, kiểm duyệt, hỗ trợ vận hành.",
        "Không bán dữ liệu cá nhân. Không cố ý thu thập thẻ ngân hàng hay ví crypto trong demo này.",
      ],
    },
    {
      h: "3. Trẻ em",
      p: [
        "Dành cho người 18+. Không hướng tới trẻ dưới 13. Nếu nghi ngờ trẻ đăng ký, liên hệ vận hành để xóa.",
      ],
    },
    {
      h: "4. Lưu trữ & quyền",
      p: [
        "Dữ liệu nằm trên máy chủ / volume của bên triển khai (không commit vào Git).",
        "Bạn có thể yêu cầu đóng tài khoản qua kênh hỗ trợ của operator. Chi tiết tiếng Anh: PRIVACY.md.",
      ],
    },
  ],
};

export default function LegalPage({ doc }: { doc: Doc }) {
  const body = doc === "terms" ? TERMS_VI : PRIVACY_VI;
  return (
    <AppShell maxWidth="md">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="play-heading text-lg">{body.title}</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            {body.updated}
          </p>
        </div>
        <Link to={AUTH_LOGIN} className="app-btn-ghost shrink-0 text-xs">
          Đăng nhập
        </Link>
      </header>

      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
        Xu trong game là <strong>điểm ảo giải trí</strong> — không nạp/rút tiền
        thật. Đây không phải tư vấn pháp lý.
      </p>

      <div className="mt-4 space-y-4">
        {body.sections.map((s) => (
          <section key={s.h} className="app-panel p-3 sm:p-4">
            <h2 className="play-heading text-sm">{s.h}</h2>
            {s.p.map((para) => (
              <p
                key={para.slice(0, 24)}
                className="mt-2 text-xs leading-relaxed text-[var(--play-ink)]/90"
              >
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>

      <nav className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[var(--wood-deep)]">
        <Link to="/terms" className="underline-offset-2 hover:underline">
          Điều khoản
        </Link>
        <Link to="/privacy" className="underline-offset-2 hover:underline">
          Bảo mật
        </Link>
        <a
          href="https://github.com/KayHuynhLibra/stepdevcodetech"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Mã nguồn (GitHub)
        </a>
      </nav>
    </AppShell>
  );
}
