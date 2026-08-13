/**
 * Spread catalog seed — từ tài liệu «Các spread bài tarot tiếng Việt».
 */

export interface OracleSpreadSeed {
  id: string;
  nameVi: string;
  blurb: string;
  cardCount: number;
  positions: string[];
  enabled: boolean;
  sort: number;
  tags?: string[];
  source?: string;
  draft?: boolean;
}

export const DEFAULT_ORACLE_SPREADS: OracleSpreadSeed[] = [
  {
    id: "single",
    nameVi: "Một lá chủ",
    blurb: "Câu hỏi thẳng — một tín hiệu đủ nặng.",
    cardCount: 1,
    positions: ["Lá chủ"],
    enabled: true,
    sort: 1,
    tags: ["nhanh"],
    source: "spread-vi",
  },
  {
    id: "daily-2",
    nameVi: "Hàng ngày (2)",
    blurb: "Năng lượng hôm nay và lời khuyên hành động.",
    cardCount: 2,
    positions: ["Năng lượng hôm nay", "Lời khuyên"],
    enabled: true,
    sort: 2,
    tags: ["hang-ngay"],
    source: "spread-vi",
  },
  {
    id: "energy-2",
    nameVi: "Năng lượng (2)",
    blurb: "Điều đang chảy và điều cần cân bằng.",
    cardCount: 2,
    positions: ["Đang chảy", "Cần cân bằng"],
    enabled: true,
    sort: 3,
    tags: ["nang-luong"],
    source: "spread-vi",
  },
  {
    id: "timeline-3",
    nameVi: "Quá khứ · Hiện tại · Tương lai",
    blurb: "Dòng thời gian ba nhịp cho một câu hỏi.",
    cardCount: 3,
    positions: ["Quá khứ", "Hiện tại", "Tương lai"],
    enabled: true,
    sort: 4,
    tags: ["thoi-gian"],
    source: "spread-vi",
  },
  {
    id: "mind-body-spirit",
    nameVi: "Tâm · Thân · Trí",
    blurb: "Ba tầng trạng thái đang đồng hành.",
    cardCount: 3,
    positions: ["Tâm / cảm xúc", "Thân / thực tế", "Trí / hướng đi"],
    enabled: true,
    sort: 5,
    tags: ["can-bang"],
    source: "spread-vi",
  },
  {
    id: "love-5",
    nameVi: "Tình yêu (5)",
    blurb: "Bạn, đối phương, quan hệ, thách thức, lời khuyên.",
    cardCount: 5,
    positions: ["Bạn", "Đối phương", "Quan hệ", "Thách thức", "Lời khuyên"],
    enabled: true,
    sort: 6,
    tags: ["tinh-yeu"],
    source: "spread-vi",
  },
  {
    id: "choice-5",
    nameVi: "Lựa chọn (5)",
    blurb: "Hai hướng và điều cần cân nhắc trước khi quyết.",
    cardCount: 5,
    positions: [
      "Hiện trạng",
      "Lựa chọn A",
      "Lựa chọn B",
      "Ẩn số",
      "Lời khuyên",
    ],
    enabled: true,
    sort: 7,
    tags: ["lua-chon"],
    source: "spread-vi",
  },
  {
    id: "career-5",
    nameVi: "Sự nghiệp (5)",
    blurb: "Vị thế, cơ hội, trở ngại, hỗ trợ, bước tiếp.",
    cardCount: 5,
    positions: ["Vị thế", "Cơ hội", "Trở ngại", "Hỗ trợ", "Bước tiếp"],
    enabled: true,
    sort: 8,
    tags: ["su-nghiep"],
    source: "spread-vi",
  },
  {
    id: "celtic-10",
    nameVi: "Celtic Cross (10)",
    blurb: "Trải sâu — thập tự trung tâm và cột staff.",
    cardCount: 10,
    positions: [
      "1 · Hiện tại",
      "2 · Thách thức (chéo)",
      "3 · Nền / gốc",
      "4 · Gần đây",
      "5 · Vương miện / mục tiêu",
      "6 · Sắp tới",
      "7 · Bản thân",
      "8 · Môi trường",
      "9 · Hy vọng / sợ",
      "10 · Kết quả",
    ],
    enabled: true,
    sort: 9,
    tags: ["sau", "celtic"],
    source: "spread-vi",
  },
  {
    id: "lenormand-3",
    nameVi: "Lenormand 3 lá",
    blurb: "Chuỗi ngắn Lenormand — đọc liền mạch.",
    cardCount: 3,
    positions: ["Lá 1", "Lá 2", "Lá 3"],
    enabled: true,
    sort: 20,
    tags: ["lenormand"],
    source: "lenormand",
  },
  {
    id: "lenormand-5",
    nameVi: "Lenormand 5 lá",
    blurb: "Trải đường Lenormand năm nhịp.",
    cardCount: 5,
    positions: ["1", "2", "3", "4", "5"],
    enabled: true,
    sort: 21,
    tags: ["lenormand"],
    source: "lenormand",
  },
  {
    id: "tea-3",
    nameVi: "Trà 3 dấu",
    blurb: "Ba dấu hiệu từ bộ Trà — quá khứ / nay / tới.",
    cardCount: 3,
    positions: ["Dấu đã qua", "Dấu hiện tại", "Dấu sắp tới"],
    enabled: true,
    sort: 30,
    tags: ["tra"],
    source: "tea",
  },
];
