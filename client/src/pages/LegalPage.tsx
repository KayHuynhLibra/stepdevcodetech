import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AUTH_LOGIN } from "../auth";

type Doc = "terms" | "privacy";

const TERMS_VI = {
  title: "Điều khoản sử dụng",
  updated: "Cập nhật: 28/07/2026 · Luật điều chỉnh mặc định: Iowa, Hoa Kỳ",
  sections: [
    {
      h: "0. Mục đích học tập & nghiên cứu (GitHub / demo công khai)",
      p: [
        "Dự án này được xây dựng và công bố chủ yếu để học tập, nghiên cứu và thực hành kỹ thuật (full-stack, realtime, công cụ admin, mẫu điều khoản) — không phải sản phẩm đánh bạc thương mại.",
        "Tên gọi, bảng xếp hạng, «xu», chủ đề tarot/bói bài là mô phỏng giải trí hư cấu. Mã nguồn và tài liệu trên GitHub (README, TERMS, PRIVACY, LEGAL, NOTICE) để người học / người review xem, học và góp ý kỹ thuật.",
        "Dùng cho bài tập, tự học, portfolio là đúng mục đích. Dùng để vận hành hoặc quảng cáo cược tiền thật là trái Điều khoản. Không commit dữ liệu người chơi (server/data, .env, token) lên GitHub.",
        "Cấm ăn cắp / chiếm đoạt mã nguồn từ GitHub: không được sao chép rồi gỡ thông báo bản quyền/NOTICE/TERMS, không được dùng mã này (hoặc bản phái sinh) để triển khai dịch vụ bất hợp pháp, lừa đảo, phishing, giả mạo dự án, hay đánh bạc tiền thật không phép. Công khai trên GitHub không đồng nghĩa cho phép lấy cắp để làm việc xấu.",
      ],
    },
    {
      h: "1. Bản chất dịch vụ (không phải cược tiền thật)",
      p: [
        "Đây là demo web giải trí / nghiên cứu (tarot / bánh xe / bói bài). Số dư «xu» và vật phẩm ảo chỉ là điểm / giấy phép dùng trong dịch vụ — không phải tiền, không có giá trị quy đổi tiền mặt, crypto, thẻ quà hay hàng hóa tiền thật qua dịch vụ này.",
        "Xu chơi (cược/bàn) và xu quà (tặng/MXH) có thể tách làn — mặc định không quy đổi lẫn nhau, không phải ví tiền mặt.",
        "Dịch vụ không nhận tiền (hay tài sản có giá trị) làm điều kiện để thắng tiền/tài sản. Không phải sòng bạc, nhà cái thể thao hay sản phẩm đánh bạc có giấy phép.",
        "Không có cổng thanh toán nạp/rút tiền thật trong mã nguồn công bố. Không tiếp thị «thắng tiền thật» hay đổi xu ra tiền.",
        "Ghi chú liên bang Mỹ (UIGEA): đạo luật về cờ bạc internet bất hợp pháp nhắm tới cược liên quan tiền/tín dụng. Dịch vụ này định vị là demo điểm ảo học tập/nghiên cứu, không nạp/rút tiền. Ghi chú Iowa: đánh bạc tiền thật không có giấy phép là bất hợp pháp — chỉ dùng tính năng điểm ảo như mô tả.",
      ],
    },
    {
      h: "2. Độ tuổi (18+) & điều kiện tham gia",
      p: [
        "Bạn phải đủ 18 tuổi (hoặc tuổi trưởng thành tại nơi bạn sống, nếu cao hơn) để đăng ký hoặc chơi khách.",
        "Dịch vụ không dành cho trẻ em dưới 13 tuổi (xem Chính sách bảo mật / COPPA).",
        "Không dùng dịch vụ nếu bị cấm theo luật Mỹ, Iowa, luật địa phương, hoặc lệnh trừng phạt/OFAC áp dụng.",
      ],
    },
    {
      h: "3. Tài khoản & khách",
      p: [
        "Bạn chịu trách nhiệm bảo mật mật khẩu và mã khôi phục. Phiên khách có giới hạn và có thể bị ràng buộc chống lạm dụng (IP, thiết bị).",
        "Ban điều hành có thể khóa / mute / thu hồi điểm ảo khi vi phạm, gian lận hoặc lạm dụng.",
      ],
    },
    {
      h: "4. Xu, vật phẩm ảo & gameplay",
      p: [
        "Xu, ngoại hình, cấp bậc, nhẫn, lượt bói… chỉ là giấy phép dùng trong dịch vụ — không chuyển quyền sở hữu IP.",
        "Kết quả do logic máy chủ quyết định; có thể thay đổi luật chơi / tính năng. Bảng xếp hạng là xếp hạng điểm ảo giải trí, không phải báo cáo tài chính.",
        "Module bói bài / chiêm tinh chỉ mang tính giải trí, không phải tư vấn chuyên môn (y tế, pháp lý, tài chính…).",
      ],
    },
    {
      h: "5. Hành vi bị cấm (gồm lạm dụng mã nguồn GitHub)",
      p: [
        "Không tấn công hệ thống, thu thập dữ liệu trái phép, mạo danh, lợi dụng lỗi rồi từ chối khắc phục, dùng dịch vụ để rửa tiền / gian lận / tổ chức cược tiền thật, hoặc vi phạm luật áp dụng (gồm luật hình sự và bảo vệ người tiêu dùng Iowa / Mỹ).",
        "Đối với mã nguồn trên GitHub: cấm chiếm đoạt / «ăn cắp» code (gỡ NOTICE, TERMS, ghi nhận tác giả) để nhận là sản phẩm thương mại của riêng mình; cấm dùng bản sao để chạy đánh bạc bất hợp pháp, lừa đảo, phishing, malware, hoặc giả mạo thương hiệu/domain dự án gốc. Học tập, trích dẫn có ghi nguồn, fork học tập thiện chí vẫn được phép.",
      ],
    },
    {
      h: "6. Sở hữu trí tuệ, giấy phép học tập & DMCA",
      p: [
        "Thương hiệu và mã nguồn (trừ thư viện bên thứ ba) thuộc operator / tác giả / bên cấp phép. Đưa lên GitHub để học không có nghĩa từ bỏ bản quyền hay cho phép lấy cắp để làm việc xấu.",
        "Trừ khi file LICENSE trong repo cấp thêm quyền rõ ràng, bạn chỉ được xem/dùng mã cho học tập & nghiên cứu cá nhân đúng §0 và mục 5. Mọi sử dụng khác (thương mại hoặc triển khai bất hợp pháp) cần sự cho phép bằng văn bản của chủ quyền.",
        "Khiếu nại bản quyền theo DMCA (17 U.S.C. § 512): gửi thông báo đủ yếu tố luật định tới kênh liên hệ của operator. Tác giả cũng có thể báo cáo fork ăn cắp / lạm dụng.",
      ],
    },
    {
      h: "7. Miễn trừ & giới hạn trách nhiệm",
      p: [
        "Dịch vụ cung cấp «nguyên trạng» / «khi khả dụng». Trong phạm vi tối đa luật Iowa và Mỹ cho phép, operator không chịu thiệt hại gián tiếp, đặc biệt, hệ quả, hoặc mất điểm ảo / dữ liệu / lợi nhuận.",
        "Trần trách nhiệm tổng (trừ nghĩa vụ pháp luật không được loại trừ): tối đa 50 USD hoặc số tiền bạn đã trả operator trong 12 tháng gần nhất (nếu có) — lấy mức cao hơn. Xu ảo không có giá trị tiền mặt để tính thiệt hại.",
      ],
    },
    {
      h: "8. Bồi thường",
      p: [
        "Bạn đồng ý bồi thường cho operator trước khiếu nại phát sinh từ việc bạn lạm dụng dịch vụ, vi phạm Điều khoản, hoặc vi phạm pháp luật — trừ phần do cố ý sai trái của operator.",
      ],
    },
    {
      h: "9. Iowa / Mỹ — thông báo địa lý & người tiêu dùng",
      p: [
        "Không phải sản phẩm đánh bạc có giấy phép tại Iowa hay liên bang Mỹ. Cư dân Iowa (và các bang khác) chỉ dùng tính năng giải trí điểm ảo; không coi kết quả xu là thắng/thua tiền thật.",
        "Quảng cáo sai về đổi xu ra tiền có thể vi phạm khuôn khổ chống gian lận người tiêu dùng Iowa. Người dùng/đại lý không được đưa ra cam kết đó.",
        "Nếu luật nơi bạn sống cấm loại hình này, hãy ngừng sử dụng.",
      ],
    },
    {
      h: "10. Luật điều chỉnh, nơi giải quyết tranh chấp",
      p: [
        "Điều khoản này điều chỉnh bởi luật Bang Iowa, Hoa Kỳ (trừ xung đột pháp luật), trừ quyền người tiêu dùng bắt buộc không thể từ bỏ tại nơi bạn cư trú.",
        "Nơi giải quyết tranh chấp: tòa án bang hoặc liên bang tại Iowa (sau khi cố gắng giải quyết thân thiện trong 30 ngày qua kênh liên hệ operator).",
        "Trong phạm vi luật cho phép: tranh chấp chỉ theo tư cách cá nhân, không kiện tập thể (class action). Không giới hạn quyền mà luật Iowa/liên bang cấm từ bỏ.",
      ],
    },
    {
      h: "11. Thay đổi & liên hệ",
      p: [
        "Có thể cập nhật Điều khoản bằng cách đăng bản mới trên /terms. Tiếp tục sử dụng sau khi cập nhật đồng nghĩa chấp nhận trong phạm vi luật cho phép.",
        "Bản tiếng Anh đầy đủ: TERMS.md trên repository. Liên hệ operator / Feedback trong app. Không đăng mật khẩu hay mã khôi phục lên GitHub công khai.",
        "Văn bản này không thay thế tư vấn pháp lý.",
      ],
    },
  ],
};

const PRIVACY_VI = {
  title: "Chính sách bảo mật",
  updated: "Cập nhật: 28/07/2026 · Thông báo chính: Hoa Kỳ · Iowa",
  sections: [
    {
      h: "1. Ai vận hành & mục đích",
      p: [
        "Dịch vụ do bên triển khai ứng dụng vận hành (ví dụ host Railway / chủ domain). Repo công khai trên GitHub là mã demo phục vụ học tập & nghiên cứu; dữ liệu production nằm trên máy chủ/volume của operator, không commit vào Git.",
      ],
    },
    {
      h: "2. Dữ liệu xử lý",
      p: [
        "Tài khoản: username, hash mật khẩu, nickname/avatar, role.",
        "Phiên: token đăng nhập, mã thiết bị/phiên.",
        "Gameplay: lịch sử ván/quay/bói, số dư xu, chat, feedback.",
        "Chống lạm dụng: địa chỉ IP, tra cứu địa lý thô (công cụ staff), gắn khách–IP.",
        "Không cố ý thu thập CCCD/SSN, thẻ ngân hàng hay khóa ví crypto trong demo này.",
      ],
    },
    {
      h: "3. Cookie / local storage",
      p: [
        "Trình duyệt có thể lưu token, tùy chọn UI, mã khách, xác nhận 18+/điều khoản trong localStorage. Xóa dữ liệu site sẽ đăng xuất phiên.",
      ],
    },
    {
      h: "4. Trẻ em (COPPA)",
      p: [
        "Dành cho người 18+. Không hướng tới trẻ dưới 13 (COPPA, 15 U.S.C. §§ 6501–6506). Nếu nghi ngờ trẻ đăng ký, liên hệ operator để xóa tài khoản.",
      ],
    },
    {
      h: "5. Chia sẻ & bán dữ liệu",
      p: [
        "Không bán dữ liệu cá nhân. Nhà cung cấp hosting có thể xử lý dữ liệu để chạy dịch vụ. Staff (admin/audit) có thể xem IP và metadata để kiểm duyệt. Có thể tiết lộ khi luật/tòa án yêu cầu hoặc để bảo vệ an toàn.",
      ],
    },
    {
      h: "6. Quyền cư dân Mỹ / Iowa / California",
      p: [
        "Bạn có thể yêu cầu đóng/xóa tài khoản, cập nhật hồ sơ qua kênh hỗ trợ / Feedback.",
        "California (CCPA/CPRA): quyền biết/xóa/sửa; demo này không bán dữ liệu cá nhân và không chạy quảng cáo hành vi bên thứ ba trong mã gốc.",
        "Iowa (khung ICDPA): khi đạo luật áp dụng, người tiêu dùng Iowa có thể có quyền xác nhận xử lý, truy cập, sửa, xóa, nhận bản sao di động (khi khả thi), và opt-out quảng cáo nhắm mục tiêu / bán dữ liệu / một số profiling — demo này không bán dữ liệu và không chạy quảng cáo nhắm mục tiêu. Gửi yêu cầu «Iowa privacy request» qua kênh operator; phản hồi theo thời hạn luật định (thường tới 45 ngày, có thể gia hạn theo luật).",
      ],
    },
    {
      h: "7. Lưu trữ, bảo mật & quốc tế",
      p: [
        "Dữ liệu trên máy chủ/volume triển khai; token hết hạn theo cấu hình; có thể có backup khôi phục thảm họa.",
        "Mật khẩu băm (scrypt); production cần HTTPS.",
        "Máy chủ có thể nằm tại Mỹ hoặc nơi host vận hành. Người dùng EEA/UK: operator nên bổ sung phụ lục GDPR nếu phục vụ khu vực đó.",
      ],
    },
    {
      h: "8. Thay đổi & liên hệ",
      p: [
        "Có thể cập nhật chính sách tại /privacy. Chi tiết tiếng Anh: PRIVACY.md.",
        "Không dán mật khẩu, mã khôi phục hay log IP đầy đủ lên GitHub công khai. Đây không phải tư vấn pháp lý.",
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
        Dự án <strong>học tập &amp; nghiên cứu</strong> (educational / research
        demo trên GitHub). Xu là <strong>điểm ảo</strong> — không nạp/rút tiền
        thật, không phải đánh bạc có giấy phép tại Iowa/Mỹ. Đây không phải tư
        vấn pháp lý. Luật điều chỉnh mặc định: <strong>Iowa, Hoa Kỳ</strong>.
      </p>

      <div className="mt-4 space-y-4">
        {body.sections.map((s) => (
          <section key={s.h} className="app-panel p-3 sm:p-4">
            <h2 className="play-heading text-sm">{s.h}</h2>
            {s.p.map((para) => (
              <p
                key={para.slice(0, 48)}
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
