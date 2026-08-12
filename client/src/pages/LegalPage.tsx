import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AUTH_LOGIN } from "../auth";
import { LEGAL_BANNER } from "../complianceCopy";

type Doc = "terms" | "privacy" | "responsible";
type Lang = "vi" | "en";

type LegalSection = { id: string; h: string; p: string[] };

type LegalBody = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

function withIds(
  sections: { h: string; p: string[] }[],
): LegalSection[] {
  return sections.map((s, i) => ({
    ...s,
    id: `s-${i}`,
  }));
}

const LANG_KEY = "sofiaore_legal_lang_v1";

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "en" || v === "vi") return v;
  } catch {
    /* ignore */
  }
  return "vi";
}

function writeLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

const TERMS_VI: LegalBody = {
  title: "Điều khoản sử dụng",
  updated:
    "Cập nhật: 12/08/2026 · Luật: Hoa Kỳ · Nền tảng chồng lớp (legal shield)",
  sections: withIds([
    {
      h: "0. Hợp đồng điện tử & bằng chứng chấp nhận",
      p: [
        "Terms là thỏa thuận ràng buộc với Operator. Tạo tài khoản, chơi khách, tích chọn, bấm Đồng ý/Tiếp tục, hoặc tiếp tục dùng Service = chấp nhận Terms, Chính sách bảo mật và Chơi có trách nhiệm.",
        "Giao kết điện tử theo E-SIGN (Hoa Kỳ). Bản ghi xác nhận (localStorage / termsAcceptedAt trên server khi có) có thể lưu làm bằng chứng. Bạn đủ năng lực pháp lý; khai báo tuổi/địa bàn phải trung thực.",
        "Không có bên thứ ba thụ hưởng quyền theo Terms, trừ khi ghi rõ. Bản tiếng Việt trên app là bản tiện dụng; nếu lệch với bản tiếng Anh TERMS.md thì bản Anh ưu tiên (trừ quyền bắt buộc của nơi cư trú).",
      ],
    },
    {
      h: "1. Lớp sản phẩm — giải trí điểm ảo (không phải cược tiền thật)",
      p: [
        "Service là ứng dụng giải trí điểm ảo. Tên gọi, BXH, xu, tarot/bói bài là hư cấu giải trí — không phải sòng bạc, nhà cái, ngân hàng, tổ chức truyền tiền, chứng khoán, hay đánh bạc có giấy phép.",
        "Xu = điểm / giấy phép hạn chế — không tiền pháp định, không quy đổi tiền/crypto/thẻ quà/hàng tiền thật qua Service. Xu chơi / xu quà có thể tách làn. Không cash-in/cash-out. Số dư ảo không hoàn tiền trừ luật bắt buộc.",
        "UIGEA và luật đánh bạc liên bang/bang Hoa Kỳ nhắm cược tiền/tín dụng. Service định vị không cash-in/out. Tên file nội bộ, SFX, art theme không làm thay đổi bản chất điểm ảo.",
      ],
    },
    {
      h: "2. 18+, địa bàn & chống né kiểm soát",
      p: [
        "Phải đủ 18+ (hoặc tuổi trưởng thành nơi bạn sống nếu cao hơn). Không dành cho dưới 13 (COPPA). Không dùng nếu bị cấm theo luật Mỹ / OFAC.",
        "Operator có thể geo-block, rate-limit, từ chối phục vụ. Bạn tự chịu trách nhiệm tuân thủ luật nơi đang ở. Cấm dùng VPN/proxy/khai báo sai chỉ để né geo-block, lệnh trừng phạt hoặc cổng 18+.",
      ],
    },
    {
      h: "3. Tài khoản, khách & nhật ký bảo mật",
      p: [
        "Bạn chịu trách nhiệm mật khẩu, mã khôi phục và mọi hoạt động tài khoản/khách. Báo Feedback nếu nghi xâm nhập. Không đa tài khoản để né ban.",
        "Operator có thể xác thực lại, khóa tài khoản rủi ro, và lưu audit log sự kiện bảo mật để thực thi Terms / tuân thủ.",
      ],
    },
    {
      h: "4. Xu, rủi ro tự nguyện & không tư vấn chuyên môn",
      p: [
        "Xu/ngoại hình/cấp/nhẫn/bói = giấy phép hạn chế, có thể thu hồi — không quyền sở hữu IP, không quyền tài sản tuyệt đối với số dư. Logic máy chủ quyết định kết quả; có thể đổi luật/tính năng bất cứ lúc nào trong phạm vi luật.",
        "Bói bài / chiêm tinh chỉ giải trí — không tư vấn y tế/pháp lý/tài chính/tâm lý. Xem thêm /responsible.",
        "Bạn tự nguyện chấp nhận rủi ro mất xu ảo và thất vọng cảm xúc. Không dựa vào lời nói miệng trái Terms. Tính năng beta có thể lỗi hoặc bị gỡ mà không tạo nghĩa vụ tiền mặt.",
      ],
    },
    {
      h: "5. Hành vi bị cấm (chồng lớp bảo vệ)",
      p: [
        "Không tấn công/thăm dò/quá tải/né bảo mật; không thu thập dữ liệu trái phép (khung chống truy cập trái phép luật Mỹ, gồm chủ đề CFAA khi áp dụng).",
        "Không mạo danh; không nội dung bất hợp pháp/quấy rối; không lợi dụng lỗi; không rửa tiền/gian lận/phishing/malware; không tổ chức cược tiền thật.",
        "Không chiếm đoạt mã nguồn/thương hiệu; không quảng cáo xu đổi tiền hoặc «Service là đánh bạc có giấy phép / tạo thu nhập thật»; không vi phạm luật tiêu dùng / quyền riêng tư / IP Hoa Kỳ.",
      ],
    },
    {
      h: "6. Nội dung người dùng & công cụ nền tảng",
      p: [
        "Chat, nickname, avatar, feedback, voice (nếu bật)…: bạn giữ quyền của mình nhưng cấp Operator giấy phép toàn cầu, không độc quyền, miễn phí bản quyền để vận hành/bảo mật/kiểm duyệt/cải thiện.",
        "Operator có thể gỡ nội dung vi phạm. Định vị nền tảng hosting/moderation UGC; không mở rộng trách nhiệm cho nội dung do người khác tạo (khung CDA §230 khi áp dụng). Voice có thể được giám sát/log vì an toàn theo Privacy.",
      ],
    },
    {
      h: "7. IP, DMCA & gợi ý",
      p: [
        "Thương hiệu/UI/phần mềm thuộc Operator/licensor. Chỉ được dùng cá nhân hợp pháp theo Terms. Khiếu nại DMCA (17 U.S.C. § 512) qua Feedback. Feedback/ý tưởng bạn gửi có thể được dùng không bồi thường.",
      ],
    },
    {
      h: "8. Tạm khóa, kill-switch & chấm dứt",
      p: [
        "Operator có thể tạm khóa/hạn chế/chấm dứt (kể cả thu hồi xu) khi lạm dụng, gian lận, rủi ro pháp lý, sự cố, hoặc vi phạm Terms.",
        "Kill-switch: có thể tắt module/vùng/tính năng/toàn Service vì luật, ToS hosting, OFAC, hoặc rủi ro tuân thủ — không biến xu thành nghĩa vụ tiền mặt. Điều khoản sống còn (IP, miễn trừ, trần TN, bồi thường, tranh chấp…) vẫn hiệu lực sau chấm dứt.",
      ],
    },
    {
      h: "9. Miễn trừ, trần trách nhiệm & thời hạn khiếu nại",
      p: [
        "Service «NGUYÊN TRẠNG»/«KHI KHẢ DỤNG». Không bảo đảm liên tục/an toàn/không lỗi; không bảo đảm đây là đánh bạc có phép hay sản phẩm tài chính/tư vấn chuyên môn.",
        "Trần trách nhiệm: tối đa 50 USD hoặc số đã trả Operator trong 12 tháng (lấy cao hơn), trừ nghĩa vụ luật cấm loại trừ. Xu không có giá trị tiền mặt để tính thiệt hại.",
        "Trong phạm vi luật cho phép: khiếu nại phải nộp trong 1 năm kể từ khi phát sinh, nếu không bị hết hạn (trừ thời hạn dài hơn không thể từ bỏ).",
      ],
    },
    {
      h: "10. Bồi thường",
      p: [
        "Bạn bồi thường Operator trước khiếu nại từ: lạm dụng Service; User Content; vi phạm Terms/luật; né geo/tuổi/bảo mật — trừ cố ý sai trái của Operator.",
      ],
    },
    {
      h: "11. Người tiêu dùng Hoa Kỳ",
      p: [
        "Không phải sản phẩm đánh bạc có giấy phép tại Hoa Kỳ. Không coi xu là thắng/thua tiền thật. Quảng cáo sai «đổi xu ra tiền» có thể vi phạm FTC Act / luật tiểu bang tương tự. Link bên thứ ba có điều khoản riêng.",
      ],
    },
    {
      h: "12. Tranh chấp: hòa giải → trọng tài → từ bỏ kiện tập thể",
      p: [
        "30 ngày Feedback trước khi kiện/trọng tài. Luật điều chỉnh: liên bang Hoa Kỳ; lấp khoảng trống bang = nơi Operator đặt trụ sở hoặc Delaware (chỉ lấp khoảng trống).",
        "Trọng tài cá nhân FAA (AAA/JAMS). Ngoại lệ: tạm thời bảo vệ IP/bảo mật; small-claims. Từ bỏ class action trong phạm vi luật cho phép. Tòa không trọng tài hóa: tòa liên bang Mỹ. Từ bỏ bồi thẩm đoàn khi luật cho phép.",
      ],
    },
    {
      h: "13. OFAC, bất khả kháng, chồng lớp & thay đổi",
      p: [
        "Không thuộc danh sách OFAC/cấm xuất khẩu. Bất khả kháng: mạng, host, thiên tai, chiến tranh, dịch, chính phủ, bên thứ ba…",
        "Không tạo quan hệ đối tác/lao động. Có thể cập nhật Terms tại /terms; thay đổi trọng yếu có thể yêu cầu xác nhận lại (version ack mới). Điều khoản vô hiệu được sửa tối thiểu; các lớp bảo vệ độc lập vẫn còn. Notices qua in-app / đăng /terms.",
      ],
    },
    {
      h: "14. Liên hệ",
      p: [
        "Feedback / hỗ trợ trong app. Không gửi mật khẩu hay dữ liệu nhạy cảm kênh công khai. Đây là khung chồng lớp AI-assisted — không thay tư vấn luật sư Hoa Kỳ khi thương mại hóa / nhận tiền thật.",
      ],
    },
  ]),
};

const TERMS_EN: LegalBody = {
  title: "Terms of Service",
  updated:
    "Updated: 2026-08-12 · Governing law: United States · Multi-layer legal shield",
  sections: withIds([
    {
      h: "0. Binding agreement & electronic acceptance",
      p: [
        "These Terms are a binding agreement with the Operator. Creating an account, playing as a guest, checking acknowledgement boxes, clicking Accept/Continue, or continuing to use the Service means you accept the Terms, Privacy Policy, and Responsible Play notice.",
        "You consent to electronic contracting under U.S. E-SIGN. Acknowledgement records (localStorage / server termsAcceptedAt when stored) may be kept as evidence. You represent legal capacity and that age/location statements are accurate.",
        "No third-party beneficiaries except as expressly stated. In-app Vietnamese text is a convenience translation; if conflict, English TERMS.md controls except where mandatory local consumer law requires otherwise.",
      ],
    },
    {
      h: "1. Product layer — virtual-point entertainment (not real-money gambling)",
      p: [
        "The Service is a virtual-point entertainment application. Names, rankings, xu, tarot/oracle themes are entertainment fiction — not a casino, bookmaker, bank, money transmitter, security, or licensed gambling product.",
        "Xu = points / limited licenses only — not legal tender; not redeemable for money/crypto/gift cards/cash-value goods through the Service. Play xu and social xu may be separate lanes. No cash-in/cash-out. Virtual balances are non-refundable except where mandatory law requires.",
        "UIGEA and U.S. federal/state gambling laws address money/credit wagers. This Service is positioned without cash-in/out. Internal filenames, SFX, or art themes do not change the virtual-point nature.",
      ],
    },
    {
      h: "2. 18+, location & anti-circumvention",
      p: [
        "You must be 18+ (or age of majority where you live, if higher). Not directed to children under 13 (COPPA). Do not use if prohibited under U.S. law / OFAC.",
        "The Operator may geo-block, rate-limit, or refuse service. You are responsible for complying with local law. Do not use VPN/proxy/misrepresentation solely to evade geo-blocks, sanctions filters, or the 18+ gate.",
      ],
    },
    {
      h: "3. Accounts, guests & security logs",
      p: [
        "You are responsible for passwords, recovery codes, and all activity under your account/guest session. Report suspected compromise via Feedback. Do not multi-account to evade bans.",
        "The Operator may require re-authentication, lock risky accounts, and retain security audit logs to enforce Terms / compliance.",
      ],
    },
    {
      h: "4. Xu, assumption of risk & no professional advice",
      p: [
        "Xu/cosmetics/ranks/rings/oracle draws are limited, revocable licenses — no IP ownership and no absolute property right in balances. Server logic decides outcomes; rules/features may change at any time within the law.",
        "Fortune-telling / astrology modules are entertainment only — not medical, legal, financial, or psychological advice. See /responsible.",
        "You voluntarily assume the risk of losing virtual xu and emotional disappointment. Do not rely on oral statements that contradict these Terms. Beta features may fail or be removed without creating a cash obligation.",
      ],
    },
    {
      h: "5. Prohibited conduct (overlapping protections)",
      p: [
        "No unauthorized attack/probe/overload/security bypass; no unlawful data harvesting (U.S. unauthorized-access themes, including CFAA where applicable).",
        "No impersonation; no unlawful/harassing content; no bug exploitation for unfair advantage; no money laundering/fraud/phishing/malware; no real-money gambling schemes.",
        "No misappropriation of source/branding; no marketing xu-for-cash or claiming licensed gambling / real income; no U.S. consumer, privacy, or IP law violations.",
      ],
    },
    {
      h: "6. User content & platform tools",
      p: [
        "Chat, nicknames, avatars, feedback, voice (if enabled): you retain your rights but grant the Operator a worldwide, non-exclusive, royalty-free license to operate, secure, moderate, and improve the Service.",
        "The Operator may remove violating content. Platform hosting/moderation positioning; no expanded liability for third-party User Content (CDA §230 themes where applicable). Voice may be monitored/logged for safety per Privacy.",
      ],
    },
    {
      h: "7. IP, DMCA & suggestions",
      p: [
        "Brand/UI/software belong to the Operator/licensors. Personal lawful use only under these Terms. DMCA notices (17 U.S.C. § 512) via Feedback. Feedback/ideas you submit may be used without compensation.",
      ],
    },
    {
      h: "8. Suspension, kill-switch & termination",
      p: [
        "The Operator may suspend/restrict/terminate (including seizing xu) for abuse, fraud, legal risk, incidents, or Terms violations.",
        "Kill-switch: modules/regions/features/entire Service may be disabled for law, hosting ToS, OFAC, or compliance risk — without converting xu into a cash obligation. Surviving clauses (IP, disclaimers, liability caps, indemnity, disputes…) remain after termination.",
      ],
    },
    {
      h: "9. Disclaimers, liability cap & claim period",
      p: [
        "Service is provided “AS IS” / “AS AVAILABLE.” No warranty of continuous/secure/error-free operation; no warranty that this is licensed gambling or a financial/professional-advice product.",
        "Liability cap: the greater of USD 50 or amounts you paid the Operator in the prior 12 months, except where law forbids exclusion. Xu have no cash value for damages.",
        "To the extent permitted: claims must be filed within 1 year of accrual or are time-barred (except longer non-waivable periods).",
      ],
    },
    {
      h: "10. Indemnity",
      p: [
        "You indemnify the Operator against claims arising from: Service misuse; User Content; Terms/law violations; geo/age/security circumvention — except Operator willful misconduct.",
      ],
    },
    {
      h: "11. U.S. consumers",
      p: [
        "Not a licensed U.S. gambling product. Do not treat xu wins/losses as real money. False “xu for cash” advertising may violate the FTC Act / similar state laws. Third-party links have their own terms.",
      ],
    },
    {
      h: "12. Disputes: informal → arbitration → class waiver",
      p: [
        "30 days Feedback before suit/arbitration. Governing law: U.S. federal; state gap-fill = Operator domicile or Delaware (gap-fill only).",
        "Individual FAA arbitration (AAA/JAMS). Exceptions: temporary IP/security relief; small-claims. Class-action waiver to the extent permitted. Non-arbitrable claims: U.S. federal courts. Jury waiver where permitted.",
      ],
    },
    {
      h: "13. OFAC, force majeure, layering & changes",
      p: [
        "Not for OFAC/export-prohibited parties. Force majeure: network, host, disaster, war, epidemic, government, third parties…",
        "No partnership/employment relationship. Terms may update at /terms; material changes may require re-acknowledgement (new ack version). Severability with independent protective layers. Notices via in-app / posting /terms.",
      ],
    },
    {
      h: "14. Contact",
      p: [
        "In-app Feedback / support. Do not send passwords or sensitive data on public channels. This is an AI-assisted multi-layer scaffold — not a substitute for U.S. counsel before monetization / real-money features.",
      ],
    },
  ]),
};

const PRIVACY_VI: LegalBody = {
  title: "Chính sách bảo mật",
  updated:
    "Cập nhật: 12/08/2026 · Hoa Kỳ · Chồng lớp với Terms (L2/L5/L7)",
  sections: withIds([
    {
      h: "1. Ai vận hành & ngôn ngữ",
      p: [
        "Operator vận hành Service. Yêu cầu quyền riêng tư qua Feedback (có thể xác minh danh tính). Bản Việt là tiện dụng; bản Anh PRIVACY.md ưu tiên trừ luật bắt buộc khác.",
      ],
    },
    {
      h: "2. Loại dữ liệu",
      p: [
        "Tài khoản: username, hash mật khẩu, nickname/avatar, role.",
        "Phiên/thiết bị: token, mã thiết bị/phiên.",
        "Gameplay/xã hội: lịch sử ván/quay/bói, xu, chat, metadata quà.",
        "Chống lạm dụng: IP, geo thô, gắn khách–IP.",
        "Tuân thủ: cờ 18+/Terms, termsAcceptedAt (khi có); voice metadata/log kiểm duyệt nếu bật voice.",
        "Không cố ý thu CCCD/SSN/thẻ/khóa ví. Không gửi sức khỏe, GPS chính xác, sinh trắc học.",
      ],
    },
    {
      h: "3. Mục đích & xử lý tự động",
      p: [
        "Vận hành, bảo mật, chống gian lận/đa nick, kiểm duyệt, tuân thủ, sao lưu. Không bán dữ liệu; không quảng cáo hành vi bên thứ ba trong bản gốc.",
        "Có thể dùng quy tắc/điểm tự động cho rate-limit, spam, đa tài khoản — không phải quyết định tín dụng/việc làm/nhà ở. Khi luật bang yêu cầu, có thể xin người xem lại quyết định khóa tài khoản qua Feedback.",
      ],
    },
    {
      h: "4. Cookie / DNT",
      p: [
        "localStorage: token, UI, mã khách, ack 18+/Terms. DNT: chưa có chuẩn thống nhất; không phản hồi khác biệt ngoài Policy này.",
      ],
    },
    {
      h: "5. COPPA / 18+",
      p: [
        "18+. Không hướng tới dưới 13. Phát hiện trẻ: Feedback để xóa. 13–17 không được tham gia theo Terms.",
      ],
    },
    {
      h: "6. Chia sẻ",
      p: [
        "Không bán PI. Có thể chia sẻ: nhà cung cấp hạ tầng; staff cần biết; khi luật/an toàn yêu cầu; bên kế nhiệm sáp nhập (bảo vệ tương đương).",
      ],
    },
    {
      h: "7. Lưu trữ, ẩn danh & sự cố",
      p: [
        "Lưu đến khi xóa/ẩn danh hoặc ngừng Service; backup thảm họa có hạn. Có thể giữ thống kê đã ẩn danh/tổng hợp. Mật khẩu băm; HTTPS. Sự cố: bước hợp lý theo luật Mỹ, có thể thông báo khi bắt buộc.",
      ],
    },
    {
      h: "8. Quyền cư dân Hoa Kỳ",
      p: [
        "CCPA/CPRA (California): biết/xóa/sửa; không bán/không ad sharing trong bản gốc; không phân biệt đối xử. Shine the Light: không tiết lộ cho marketing trực tiếp bên thứ ba kiểu §1798.83 trong bản gốc.",
        "Bang khác (VA/CO/CT/UT/TX/OR… khi áp dụng): xác nhận, truy cập, sửa, xóa, portable, opt-out quảng cáo/bán/profiling.",
        "Gửi «U.S. privacy request» + bang + xác minh qua Feedback; thường ≤45 ngày. Kháng cáo qua cùng kênh khi luật cho phép.",
      ],
    },
    {
      h: "9. Quốc tế & khóa feature-creep thanh toán",
      p: [
        "Máy chủ có thể tại Mỹ/nơi host. EEA/UK/CH: cần phụ lục GDPR trước khi cố ý nhắm khu vực đó.",
        "Xu ảo → không xử lý thẻ/ngân hàng cho gameplay. Muốn thêm thanh toán: phải cập nhật Privacy + Terms trước; fork thu thẻ khi chưa cập nhật là ngoài phạm vi Policy này.",
      ],
    },
  ]),
};

const PRIVACY_EN: LegalBody = {
  title: "Privacy Policy",
  updated:
    "Updated: 2026-08-12 · United States · Overlaps Terms layers L2/L5/L7",
  sections: withIds([
    {
      h: "1. Who operates & language",
      p: [
        "The Operator runs the Service. Privacy requests go through Feedback (identity verification may be required). Vietnamese text is convenience-only; English PRIVACY.md controls except where mandatory law requires otherwise.",
      ],
    },
    {
      h: "2. Data categories",
      p: [
        "Account: username, password hash, nickname/avatar, role.",
        "Session/device: tokens, device/session ids.",
        "Gameplay/social: round/spin/oracle history, xu, chat, gift metadata.",
        "Anti-abuse: IP, coarse geo, guest–IP binding.",
        "Compliance: 18+/Terms flags, termsAcceptedAt (when stored); voice moderation metadata/logs if voice is enabled.",
        "We do not intentionally collect government ID/SSN/payment cards/wallet keys. Do not submit health data, precise GPS, or biometrics.",
      ],
    },
    {
      h: "3. Purposes & automated processing",
      p: [
        "Operate, secure, prevent fraud/multi-accounting, moderate, comply, and back up. No sale of personal information; no third-party behavioral ads in the base product.",
        "Automated rules/scoring may support rate limits, spam, and multi-account detection — not credit/employment/housing decisions. Where state law requires, you may request human review of account lockouts via Feedback.",
      ],
    },
    {
      h: "4. Cookies / DNT",
      p: [
        "localStorage: tokens, UI prefs, guest codes, 18+/Terms acknowledgements. DNT: no uniform industry standard; no differentiated response beyond this Policy.",
      ],
    },
    {
      h: "5. COPPA / 18+",
      p: [
        "18+. Not directed to children under 13. If a child is discovered: Feedback for deletion. Ages 13–17 are not permitted under the Terms.",
      ],
    },
    {
      h: "6. Sharing",
      p: [
        "No sale of PI. May share with: infrastructure providers; staff with need-to-know; when law/safety requires; successors in a merger (equivalent protections).",
      ],
    },
    {
      h: "7. Retention, anonymization & incidents",
      p: [
        "Retain until deletion/anonymization or Service end; disaster backups are time-limited. Aggregated/anonymous stats may be kept. Passwords hashed; HTTPS. Incidents: reasonable U.S.-law steps, notices when required.",
      ],
    },
    {
      h: "8. U.S. resident rights",
      p: [
        "CCPA/CPRA (California): know/delete/correct; no sale / no ad sharing in the base product; no discrimination. Shine the Light: no §1798.83-style third-party direct-marketing disclosures in the base product.",
        "Other states (VA/CO/CT/UT/TX/OR… where applicable): confirm, access, correct, delete, portability, opt-out of ads/sale/profiling.",
        "Send a “U.S. privacy request” + state + verification via Feedback; typically ≤45 days. Appeals via the same channel when law allows.",
      ],
    },
    {
      h: "9. International & payment feature lock",
      p: [
        "Servers may be in the U.S./hosting region. EEA/UK/CH: GDPR addendum needed before intentionally targeting those regions.",
        "Virtual xu → no card/bank processing for gameplay. Adding payments requires Privacy + Terms updates first; forks that collect cards without updates are outside this Policy.",
      ],
    },
  ]),
};

const RESPONSIBLE_VI: LegalBody = {
  title: "Chơi có trách nhiệm",
  updated: "Cập nhật: 12/08/2026 · Lớp bổ trợ Terms — không phải tư vấn pháp lý",
  sections: withIds([
    {
      h: "1. Xu chỉ là điểm giải trí",
      p: [
        "Xu là điểm ảo để chơi minigame, quà xã hội và nội dung giải trí — không quy đổi tiền mặt, không nạp/rút qua Service.",
        "Thắng/thua xu không phải thu nhập, lỗ đầu tư hay kết quả tài chính thật.",
      ],
    },
    {
      h: "2. Thời gian & cảm xúc",
      p: [
        "Nghỉ giữa phiên. Nếu gây căng thẳng, mất ngủ, ảnh hưởng việc/học — dừng và đăng xuất. Không thay thế tư vấn y tế/tâm lý/pháp lý/tài chính.",
      ],
    },
    {
      h: "3. Bói bài & chiêm tinh",
      p: [
        "Chỉ giải trí. Đừng quyết định lớn chỉ dựa trên kết quả bài.",
      ],
    },
    {
      h: "4. Trẻ vị thành niên",
      p: [
        "18+. Không cho trẻ dùng tài khoản của bạn. Phát hiện tài khoản trẻ: Feedback để xóa.",
      ],
    },
    {
      h: "5. Hỗ trợ",
      p: [
        "Vấn đề cược tiền thật (không liên quan xu ảo) tại Mỹ: National Problem Gambling Helpline 1-800-522-4700 · ncpgambling.org.",
        "Lạm dụng/quấy rối trong app: Feedback / báo cáo.",
      ],
    },
  ]),
};

const RESPONSIBLE_EN: LegalBody = {
  title: "Responsible Play",
  updated:
    "Updated: 2026-08-12 · Companion to the Terms — not legal advice",
  sections: withIds([
    {
      h: "1. Xu are entertainment points only",
      p: [
        "Xu are virtual points for minigames, social gifts, and entertainment — not redeemable for cash; no deposit/withdraw through the Service.",
        "Xu wins/losses are not income, investment loss, or real financial outcomes.",
      ],
    },
    {
      h: "2. Time & wellbeing",
      p: [
        "Take breaks. If play causes stress, sleep loss, or interferes with work/study, stop and sign out. Not a substitute for medical, psychological, legal, or financial help.",
      ],
    },
    {
      h: "3. Fortune-telling & astrology",
      p: [
        "Entertainment only. Do not make major life decisions based solely on draws.",
      ],
    },
    {
      h: "4. Minors",
      p: [
        "18+. Do not let children use your account. If a minor account is found: Feedback for deletion.",
      ],
    },
    {
      h: "5. Help",
      p: [
        "For real-money gambling problems (separate from virtual xu) in the U.S.: National Problem Gambling Helpline 1-800-522-4700 · ncpgambling.org.",
        "In-app abuse/harassment: Feedback / report tools.",
      ],
    },
  ]),
};

function pickBody(doc: Doc, lang: Lang): LegalBody {
  if (doc === "terms") return lang === "en" ? TERMS_EN : TERMS_VI;
  if (doc === "privacy") return lang === "en" ? PRIVACY_EN : PRIVACY_VI;
  return lang === "en" ? RESPONSIBLE_EN : RESPONSIBLE_VI;
}

function LanguagePopup({
  open,
  lang,
  onPick,
  onClose,
}: {
  open: boolean;
  lang: Lang;
  onPick: (l: Lang) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-lang-title"
        className="relative w-full max-w-sm rounded-2xl bg-[var(--cream)] p-4 shadow-xl ring-1 ring-[var(--wood-deep)]/15 sm:p-5"
      >
        <p
          id="legal-lang-title"
          className="play-heading text-base text-[var(--play-ink)]"
        >
          {lang === "en" ? "Language" : "Ngôn ngữ"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--play-muted)]">
          {lang === "en"
            ? "Vietnamese is a convenience translation. English controls if there is a conflict (except mandatory local rights)."
            : "Bản tiếng Việt là bản tiện dụng. Nếu lệch, bản tiếng Anh ưu tiên (trừ quyền bắt buộc nơi cư trú)."}
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition ${
              lang === "vi"
                ? "bg-[var(--wood-deep)] text-[var(--cream)] ring-[var(--wood-deep)]"
                : "bg-white/70 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
            }`}
            onClick={() => onPick("vi")}
          >
            Tiếng Việt
            <span className="mt-0.5 block text-[11px] font-normal opacity-80">
              Điều khoản · Bảo mật · Chơi có trách nhiệm
            </span>
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition ${
              lang === "en"
                ? "bg-[var(--wood-deep)] text-[var(--cream)] ring-[var(--wood-deep)]"
                : "bg-white/70 text-[var(--play-ink)] ring-[var(--wood-deep)]/15 hover:bg-white"
            }`}
            onClick={() => onPick("en")}
          >
            English
            <span className="mt-0.5 block text-[11px] font-normal opacity-80">
              Terms · Privacy · Responsible Play
            </span>
          </button>
        </div>
        <button
          type="button"
          className="app-btn-ghost mt-3 w-full text-xs"
          onClick={onClose}
        >
          {lang === "en" ? "Close" : "Đóng"}
        </button>
      </div>
    </div>
  );
}

function LegalToc({
  sections,
  lang,
  open,
  onToggle,
}: {
  sections: LegalSection[];
  lang: Lang;
  open: boolean;
  onToggle: () => void;
}) {
  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label={lang === "en" ? "Table of contents" : "Mục lục"}
      className="legal-toc mt-4 overflow-hidden rounded-2xl bg-[var(--cream)] ring-1 ring-[var(--wood-deep)]/12"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left sm:px-4"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          <span className="play-heading block text-sm text-[var(--play-ink)]">
            {lang === "en" ? "Contents" : "Mục lục"}
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--play-muted)]">
            {lang === "en"
              ? `${sections.length} sections · tap to jump`
              : `${sections.length} mục · chạm để nhảy tới`}
          </span>
        </span>
        <span
          className={`grid h-8 w-8 place-items-center rounded-full bg-[var(--wood-deep)]/8 text-xs font-bold text-[var(--wood-deep)] transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <ol className="grid gap-1 border-t border-[var(--wood-deep)]/10 px-2 pb-3 pt-2 sm:grid-cols-2 sm:px-3">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className="group flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--wood-deep)]/6"
                onClick={() => jump(s.id)}
              >
                <span className="mt-0.5 grid h-5 min-w-5 place-items-center rounded-md bg-[var(--wood-deep)]/10 px-1 text-[10px] font-bold tabular-nums text-[var(--wood-deep)]">
                  {String(i).padStart(2, "0")}
                </span>
                <span className="text-[11px] font-semibold leading-snug text-[var(--play-ink)] group-hover:text-[var(--wood-deep)] sm:text-xs">
                  {s.h}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

export default function LegalPage({ doc }: { doc: Doc }) {
  const [lang, setLang] = useState<Lang>(() => readLang());
  const [langOpen, setLangOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const body = pickBody(doc, lang);

  const pick = (next: Lang) => {
    setLang(next);
    writeLang(next);
    setLangOpen(false);
  };

  return (
    <AppShell maxWidth="md">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="play-heading text-lg">{body.title}</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            {body.updated}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="app-btn-ghost text-xs"
            onClick={() => setLangOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={langOpen}
          >
            {lang === "en" ? "EN · VI" : "VI · EN"}
          </button>
          <Link to={AUTH_LOGIN} className="app-btn-ghost text-xs">
            {lang === "en" ? "Log in" : "Đăng nhập"}
          </Link>
        </div>
      </header>

      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
        {lang === "en"
          ? `${LEGAL_BANNER} Multi-layer protections (product · contract · privacy · IP · disputes). Individual arbitration / class waiver per Terms (except non-waivable rights). Not legal advice.`
          : `${LEGAL_BANNER} Khung chồng lớp bảo vệ (sản phẩm · hợp đồng · riêng tư · IP · tranh chấp). Trọng tài cá nhân / từ bỏ kiện tập thể theo Điều khoản (trừ quyền luật cấm từ bỏ). Không thay tư vấn luật sư.`}
      </p>

      <p className="mt-2 text-[10px] leading-relaxed text-[var(--play-muted)]">
        {lang === "en"
          ? "In-app pages are a bilingual convenience summary. The canonical English Terms / Privacy / Responsible Play live as separate Markdown files in the public repository (TERMS.md · PRIVACY.md · RESPONSIBLE.md)."
          : "Trang trong app là bản tóm tắt song ngữ tiện dụng. Bản tiếng Anh đầy đủ nằm riêng trên kho công khai (TERMS.md · PRIVACY.md · RESPONSIBLE.md) — không phải cùng một file với UI."}
      </p>

      <LegalToc
        sections={body.sections}
        lang={lang}
        open={tocOpen}
        onToggle={() => setTocOpen((v) => !v)}
      />

      <div className="mt-4 space-y-4">
        {body.sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="app-panel scroll-mt-20 p-3 sm:p-4"
          >
            <h2 className="play-heading text-sm">{s.h}</h2>
            {s.p.map((para) => (
              <p
                key={para.slice(0, 48)}
                className="mt-2 text-xs leading-relaxed text-[var(--play-ink)]/90"
              >
                {para}
              </p>
            ))}
            <button
              type="button"
              className="mt-3 text-[10px] font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            >
              {lang === "en" ? "↑ Back to top" : "↑ Về mục lục"}
            </button>
          </section>
        ))}
      </div>

      <nav className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[var(--wood-deep)]">
        <Link to="/terms" className="underline-offset-2 hover:underline">
          {lang === "en" ? "Terms" : "Điều khoản"}
        </Link>
        <Link to="/privacy" className="underline-offset-2 hover:underline">
          {lang === "en" ? "Privacy" : "Bảo mật"}
        </Link>
        <Link to="/responsible" className="underline-offset-2 hover:underline">
          {lang === "en" ? "Responsible play" : "Chơi có trách nhiệm"}
        </Link>
      </nav>

      <LanguagePopup
        open={langOpen}
        lang={lang}
        onPick={pick}
        onClose={() => setLangOpen(false)}
      />
    </AppShell>
  );
}
