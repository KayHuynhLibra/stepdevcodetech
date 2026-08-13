/** Lí thuyết Bói bài — tách audience player / staff. */

export type TheoryAudience = "player" | "staff";

export type TheorySection = {
  id: string;
  title: string;
  lead: string;
  bullets: string[];
  audience: TheoryAudience;
};

export const ORACLE_THEORY_SECTIONS: TheorySection[] = [
  {
    id: "frame",
    title: "Khung đọc bài",
    lead: "Tarot soi gương tâm và bối cảnh đang hỏi — không phán số phận cứng.",
    bullets: [
      "Đặt một câu hỏi rõ, một việc đủ nặng để đáng rút.",
      "Đọc vị trí trải trước, rồi mới đọc lá.",
      "Xuôi / ngược là hai mặt cùng một bài học.",
      "Ghi sổ một dòng sau buổi đọc.",
    ],
    audience: "player",
  },
  {
    id: "spreads-player",
    title: "Chọn kiểu trải",
    lead: "Ít lá thì sắc. Nhiều lá thì rộng — đừng trải quá sức mình đọc.",
    bullets: [
      "1–2 lá: câu hỏi thẳng / hàng ngày.",
      "3 lá: dòng thời gian hoặc tâm–thân–trí.",
      "5 lá: tình yêu, lựa chọn, sự nghiệp.",
      "Celtic 10: chỉ khi chuyện đủ sâu.",
    ],
    audience: "player",
  },
  {
    id: "orient-player",
    title: "Xuôi và ngược",
    lead: "Ngược không phải “xui” — thường là tắc, nội chiếu, hoặc bài học bị trì hoãn.",
    bullets: [
      "Xuôi: năng lượng đang chảy ra ngoài.",
      "Ngược: lệch pha / cần điều chỉnh.",
      "Đọc ngược theo câu hỏi: thiếu gì, thừa gì, đang né điều gì.",
    ],
    audience: "player",
  },
  {
    id: "timing-player",
    title: "Gợi ý thời gian",
    lead: "Chỉ là gợi ý giải trí — không phải lịch cố định.",
    bullets: [
      "Gậy/Lửa thường nhanh hơn; Tiền/Đất thường chậm hơn.",
      "Major gợi chu kỳ dài hơn Minor số nhỏ.",
      "Luôn kiểm chứng bằng đời thật, không quyết định chỉ vì “deadline bài”.",
    ],
    audience: "player",
  },
  {
    id: "ethics-player",
    title: "Đạo đức & giới hạn",
    lead: "Bài không thay bác sĩ, luật sư hay cố vấn tài chính.",
    bullets: [
      "Không dùng bài để thao túng người khác.",
      "Không bói y tế / pháp lý / đầu tư như lời phán quyết.",
      "Bạn có quyền dừng nghi thức bất kỳ lúc nào.",
    ],
    audience: "player",
  },
  {
    id: "staff-framework",
    title: "[Staff] Khung nghiên cứu",
    lead: "Lab giữ notes / citations / domains — không lộ catalog public.",
    bullets: [
      "Public DTO: upright/reversed/keywords/image cơ bản.",
      "Deep: domains (tình yêu/công việc/tiền/sức khỏe), notes, sourceDoc.",
      "Nguồn seed chính: TAROT Ý nghĩa 78 lá (156 trang).",
      "Spread CMS từ «Các spread bài tarot tiếng Việt».",
    ],
    audience: "staff",
  },
  {
    id: "staff-elements",
    title: "[Staff] Nguyên tố & bộ",
    lead: "Lửa Gậy · Nước Cốc · Khí Kiếm · Đất Tiền — đọc khí chất trước khi đọc cảnh.",
    bullets: [
      "Major: chu kỳ lớn; Minor: đời sống hàng ngày.",
      "Court: thái độ / người / mức độ làm chủ năng lượng bộ.",
      "Marseille/Thoth: cùng 78 chìa, khác lớp biểu tượng — so trong Lab.",
    ],
    audience: "staff",
  },
  {
    id: "staff-library",
    title: "[Staff] Thư viện tài liệu",
    lead: "Ingest metadata trong Admin — không host PDF công khai cho player.",
    bullets: [
      "Waite Smith / Tự học / Dẫn nhập / Toàn thư → theory + tip.",
      "Lenormand 36 + sơ lược → deck lenormand.",
      "Trà 35 trang → deck tea.",
      "Dự đoán thời gian → timing rules.",
    ],
    audience: "staff",
  },
];

export function theoryForAudience(audience: TheoryAudience): TheorySection[] {
  if (audience === "staff") return ORACLE_THEORY_SECTIONS;
  return ORACLE_THEORY_SECTIONS.filter((s) => s.audience === "player");
}
