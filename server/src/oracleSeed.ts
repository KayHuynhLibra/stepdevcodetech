/**
 * Seed full bộ bài Bói: Tarot 78 lá (Major + Minor) + Chiêm tinh 12 cung.
 * Admin có thể cập nhật qua API / store JSON.
 */

export type OracleDeckId = "tarot" | "zodiac";

export interface OracleDeckMeta {
  id: OracleDeckId;
  nameVi: string;
  blurb: string;
  enabled: boolean;
  sort: number;
}

export interface OracleCardSeed {
  key: string;
  deckId: OracleDeckId;
  name: string;
  nameVi: string;
  /** Số thứ tự trong bộ (0–21 major, 1–14 minor rank, 1–12 zodiac) */
  number: number;
  suit?: "major" | "wands" | "cups" | "swords" | "pentacles" | "zodiac";
  element?: string;
  upright: string;
  reversed: string;
  keywords: string[];
  image: string;
  enabled: boolean;
  sort: number;
  blurb?: string;
}

const MAJOR: Omit<OracleCardSeed, "deckId" | "suit" | "enabled" | "sort" | "image">[] = [
  {
    key: "fool",
    name: "The Fool",
    nameVi: "Kẻ Khờ",
    number: 0,
    element: "Air",
    upright: "Khởi đầu mới, niềm tin thuần khiết, bước vào hành trình chưa biết. Lời khuyên: tin trực giác và chấp nhận rủi ro có ý thức — cánh cửa đang mở.",
    reversed: "Liều lĩnh thiếu chuẩn bị, sợ bước tiếp, hoặc hành trình bị trì hoãn. Cần hạ nhiệt, lập kế hoạch nhỏ trước khi nhảy.",
    keywords: ["khởi đầu", "niềm tin", "tự do"],
  },
  {
    key: "magician",
    name: "The Magician",
    nameVi: "Nhà Ảo Thuật",
    number: 1,
    element: "Air",
    upright: "Tập trung ý chí, biến ý tưởng thành hiện thực bằng kỹ năng và nguồn lực sẵn có. Thời điểm hành động — bạn đủ công cụ.",
    reversed: "Thao túng, phân tán năng lượng, hoặc lãng phí tài năng. Cần làm rõ mục tiêu và trung thực với động cơ.",
    keywords: ["ý chí", "sáng tạo", "hành động"],
  },
  {
    key: "priestess",
    name: "The High Priestess",
    nameVi: "Nữ Tư Tế",
    number: 2,
    element: "Water",
    upright: "Trực giác, bí ẩn, lắng nghe nội tâm, tri thức ẩn.",
    reversed: "Bỏ qua trực giác, bí mật lộ, rối loạn cảm xúc.",
    keywords: ["trực giác", "bí ẩn", "nội tâm"],
  },
  {
    key: "empress",
    name: "The Empress",
    nameVi: "Nữ Hoàng",
    number: 3,
    element: "Earth",
    upright: "Nuôi dưỡng, sung túc, vẻ đẹp, sáng tạo sinh sôi.",
    reversed: "Phụ thuộc, bế tắc sáng tạo, bỏ bê bản thân.",
    keywords: ["nuôi dưỡng", "dồi dào", "vẻ đẹp"],
  },
  {
    key: "emperor",
    name: "The Emperor",
    nameVi: "Hoàng Đế",
    number: 4,
    element: "Fire",
    upright: "Trật tự, lãnh đạo, kỷ luật, nền tảng vững.",
    reversed: "Cứng nhắc, kiểm soát quá mức, thiếu linh hoạt.",
    keywords: ["trật tự", "quyền lực", "cấu trúc"],
  },
  {
    key: "hierophant",
    name: "The Hierophant",
    nameVi: "Giáo Hoàng",
    number: 5,
    element: "Earth",
    upright: "Truyền thống, mentorship, nghi lễ, giá trị chung.",
    reversed: "Phá lệ, nghi ngờ giáo điều, tìm đường riêng.",
    keywords: ["truyền thống", "học hỏi", "niềm tin"],
  },
  {
    key: "lovers",
    name: "The Lovers",
    nameVi: "Đôi Tình Nhân",
    number: 6,
    element: "Air",
    upright: "Lựa chọn từ trái tim, hòa hợp, kết nối sâu.",
    reversed: "Mâu thuẫn giá trị, lựa chọn khó, lệch pha.",
    keywords: ["lựa chọn", "tình yêu", "hòa hợp"],
  },
  {
    key: "chariot",
    name: "The Chariot",
    nameVi: "Chiến Xa",
    number: 7,
    element: "Water",
    upright: "Thắng lợi nhờ ý chí, tiến bước, kiểm soát hướng đi.",
    reversed: "Mất phương hướng, xung đột nội tâm, dừng lại.",
    keywords: ["ý chí", "tiến bước", "chiến thắng"],
  },
  {
    key: "strength",
    name: "Strength",
    nameVi: "Sức Mạnh",
    number: 8,
    element: "Fire",
    upright: "Can đảm mềm mại, kiên nhẫn, thuần hóa bản năng.",
    reversed: "Tự nghi, nóng nảy, thiếu tự chủ.",
    keywords: ["can đảm", "kiên nhẫn", "từ bi"],
  },
  {
    key: "hermit",
    name: "The Hermit",
    nameVi: "Ẩn Sĩ",
    number: 9,
    element: "Earth",
    upright: "Tĩnh lặng nội chiếu, tìm chân lý, rút lui sáng suốt.",
    reversed: "Cô lập quá mức, lạc lối, từ chối trợ giúp.",
    keywords: ["nội chiếu", "trí tuệ", "một mình"],
  },
  {
    key: "wheel",
    name: "Wheel of Fortune",
    nameVi: "Bánh Xe Số Phận",
    number: 10,
    element: "Fire",
    upright: "Chu kỳ đổi thay, vận may đến, thời điểm chuyển mình.",
    reversed: "Trì trệ, kháng cự thay đổi, vận xấu tạm thời.",
    keywords: ["chu kỳ", "vận may", "đổi thay"],
  },
  {
    key: "justice",
    name: "Justice",
    nameVi: "Công Lý",
    number: 11,
    element: "Air",
    upright: "Công bằng, trách nhiệm, sự thật được soi sáng.",
    reversed: "Thiên vị, né tránh trách nhiệm, bất công.",
    keywords: ["công bằng", "sự thật", "cân bằng"],
  },
  {
    key: "hanged",
    name: "The Hanged Man",
    nameVi: "Người Bị Treo",
    number: 12,
    element: "Water",
    upright: "Buông bỏ, nhìn góc mới, hy sinh có ý nghĩa.",
    reversed: "Trì hoãn vô ích, cứng đầu, hy sinh sai chỗ.",
    keywords: ["buông bỏ", "góc nhìn", "tạm dừng"],
  },
  {
    key: "death",
    name: "Death",
    nameVi: "Tử Thần",
    number: 13,
    element: "Water",
    upright: "Kết thúc để tái sinh, chuyển hóa sâu, đóng chương cũ.",
    reversed: "Bám víu quá khứ, sợ thay đổi, chuyển hóa chậm.",
    keywords: ["chuyển hóa", "kết thúc", "tái sinh"],
  },
  {
    key: "temperance",
    name: "Temperance",
    nameVi: "Tiết Độ",
    number: 14,
    element: "Fire",
    upright: "Cân bằng, hòa trộn, kiên nhẫn chữa lành.",
    reversed: "Thiếu điều độ, mất cân bằng, vội vàng.",
    keywords: ["cân bằng", "hòa hợp", "chữa lành"],
  },
  {
    key: "devil",
    name: "The Devil",
    nameVi: "Ác Quỷ",
    number: 15,
    element: "Earth",
    upright: "Ràng buộc, thèm muốn, nhận diện xiềng xích.",
    reversed: "Tháo gỡ ràng buộc, giải phóng, tỉnh thức.",
    keywords: ["ràng buộc", "cám dỗ", "bóng tối"],
  },
  {
    key: "tower",
    name: "The Tower",
    nameVi: "Tòa Tháp",
    number: 16,
    element: "Fire",
    upright: "Đổ vỡ bất ngờ, phá ảo tưởng, giải phóng đột ngột.",
    reversed: "Sợ khủng hoảng, trì hoãn đổ vỡ, phục hồi chậm.",
    keywords: ["đột phá", "đổ vỡ", "thức tỉnh"],
  },
  {
    key: "star",
    name: "The Star",
    nameVi: "Ngôi Sao",
    number: 17,
    element: "Air",
    upright: "Hy vọng, chữa lành, cảm hứng, hướng tới ánh sáng.",
    reversed: "Mất niềm tin, tuyệt vọng tạm thời, tự nghi.",
    keywords: ["hy vọng", "chữa lành", "cảm hứng"],
  },
  {
    key: "moon",
    name: "The Moon",
    nameVi: "Mặt Trăng",
    number: 18,
    element: "Water",
    upright: "Ảo ảnh, tiềm thức, cảm xúc sâu, đi trong sương mù.",
    reversed: "Tan sương, nhìn rõ hơn, vượt sợ hãi.",
    keywords: ["tiềm thức", "ảo ảnh", "cảm xúc"],
  },
  {
    key: "sun",
    name: "The Sun",
    nameVi: "Mặt Trời",
    number: 19,
    element: "Fire",
    upright: "Niềm vui, thành công, sự thật sáng tỏ, sức sống.",
    reversed: "Tạm u ám, kiêu ngạo, vui chưa trọn.",
    keywords: ["niềm vui", "thành công", "rạng rỡ"],
  },
  {
    key: "judgement",
    name: "Judgement",
    nameVi: "Phán Xét",
    number: 20,
    element: "Fire",
    upright: "Thức tỉnh, lời gọi sứ mệnh, tha thứ & tái định hướng.",
    reversed: "Tự phán xét khắc nghiệt, bỏ lỡ lời gọi.",
    keywords: ["thức tỉnh", "gọi hồn", "tha thứ"],
  },
  {
    key: "world",
    name: "The World",
    nameVi: "Thế Giới",
    number: 21,
    element: "Earth",
    upright: "Hoàn tất chu kỳ, viên mãn, hội nhập, bước sang tầng mới.",
    reversed: "Chưa khép lại, thiếu đóng, trì hoãn thành tựu.",
    keywords: ["hoàn tất", "viên mãn", "chu kỳ"],
  },
];

const ZODIAC: Omit<OracleCardSeed, "deckId" | "suit" | "enabled" | "sort" | "image">[] = [
  {
    key: "aries",
    name: "Aries",
    nameVi: "Bạch Dương",
    number: 1,
    element: "Fire",
    upright: "Khởi động mạnh, dũng cảm dẫn đầu, năng lượng hành động.",
    reversed: "Nóng vội, xung đột, thiếu kiên nhẫn.",
    keywords: ["lửa", "dẫn đầu", "xung phong"],
    blurb: "21/3 – 19/4",
  },
  {
    key: "taurus",
    name: "Taurus",
    nameVi: "Kim Ngưu",
    number: 2,
    element: "Earth",
    upright: "Ổn định, kiên trì, hưởng thụ giá trị thực.",
    reversed: "Cứng đầu, trì trệ, bám vật chất.",
    keywords: ["ổn định", "kiên trì", "giá trị"],
    blurb: "20/4 – 20/5",
  },
  {
    key: "gemini",
    name: "Gemini",
    nameVi: "Song Tử",
    number: 3,
    element: "Air",
    upright: "Giao tiếp, học hỏi nhanh, đa dạng ý tưởng.",
    reversed: "Phân tán, nói nhiều làm ít, bất ổn.",
    keywords: ["giao tiếp", "linh hoạt", "ý tưởng"],
    blurb: "21/5 – 20/6",
  },
  {
    key: "cancer",
    name: "Cancer",
    nameVi: "Cự Giải",
    number: 4,
    element: "Water",
    upright: "Bảo vệ, trực giác gia đình, chăm sóc cảm xúc.",
    reversed: "Quá nhạy, phòng thủ, bám quá khứ.",
    keywords: ["cảm xúc", "gia đình", "bảo vệ"],
    blurb: "21/6 – 22/7",
  },
  {
    key: "leo",
    name: "Leo",
    nameVi: "Sư Tử",
    number: 5,
    element: "Fire",
    upright: "Tự tin tỏa sáng, sáng tạo, lòng hào phóng.",
    reversed: "Kiêu ngạo, cần được chú ý quá mức.",
    keywords: ["tỏa sáng", "tự tin", "sáng tạo"],
    blurb: "23/7 – 22/8",
  },
  {
    key: "virgo",
    name: "Virgo",
    nameVi: "Xử Nữ",
    number: 6,
    element: "Earth",
    upright: "Tỉ mỉ, phục vụ, cải thiện thực tế từng bước.",
    reversed: "Phê phán quá, lo âu tiểu tiết.",
    keywords: ["tỉ mỉ", "phân tích", "phục vụ"],
    blurb: "23/8 – 22/9",
  },
  {
    key: "libra",
    name: "Libra",
    nameVi: "Thiên Bình",
    number: 7,
    element: "Air",
    upright: "Cân bằng quan hệ, thẩm mỹ, hòa giải.",
    reversed: "Do dự, né xung đột, mất cân bằng.",
    keywords: ["cân bằng", "hòa hợp", "quan hệ"],
    blurb: "23/9 – 22/10",
  },
  {
    key: "scorpio",
    name: "Scorpio",
    nameVi: "Thiên Yết",
    number: 8,
    element: "Water",
    upright: "Chuyển hóa sâu, chân thật, sức mạnh nội tâm.",
    reversed: "Ghen tuông, kiểm soát, bí mật độc hại.",
    keywords: ["chuyển hóa", "sâu sắc", "quyền lực"],
    blurb: "23/10 – 21/11",
  },
  {
    key: "sagittarius",
    name: "Sagittarius",
    nameVi: "Nhân Mã",
    number: 9,
    element: "Fire",
    upright: "Mở rộng tầm nhìn, học hỏi, chân trời mới.",
    reversed: "Hứa suông, thiếu tập trung, cực đoan.",
    keywords: ["tự do", "triết lý", "khám phá"],
    blurb: "22/11 – 21/12",
  },
  {
    key: "capricorn",
    name: "Capricorn",
    nameVi: "Ma Kết",
    number: 10,
    element: "Earth",
    upright: "Kỷ luật dài hạn, tham vọng vững, trách nhiệm.",
    reversed: "Công việc quá tải, cứng nhắc, bi quan.",
    keywords: ["kỷ luật", "sự nghiệp", "bền bỉ"],
    blurb: "22/12 – 19/1",
  },
  {
    key: "aquarius",
    name: "Aquarius",
    nameVi: "Bảo Bình",
    number: 11,
    element: "Air",
    upright: "Đổi mới cộng đồng, tư duy độc lập, nhân đạo.",
    reversed: "Lệch lạc, lạnh lùng, nổi loạn vô hướng.",
    keywords: ["đổi mới", "cộng đồng", "tương lai"],
    blurb: "20/1 – 18/2",
  },
  {
    key: "pisces",
    name: "Pisces",
    nameVi: "Song Ngư",
    number: 12,
    element: "Water",
    upright: "Đồng cảm, mơ mộng sáng tạo, chữa lành tinh thần.",
    reversed: "Ảo tưởng, thoát ly thực tế, mất ranh giới.",
    keywords: ["đồng cảm", "trực giác", "mơ"],
    blurb: "19/2 – 20/3",
  },
];

type SuitKey = "wands" | "cups" | "swords" | "pentacles";

const SUITS: {
  key: SuitKey;
  name: string;
  nameVi: string;
  element: string;
  theme: string;
}[] = [
  {
    key: "wands",
    name: "Wands",
    nameVi: "Gậy",
    element: "Fire",
    theme: "hành động, đam mê, dự án",
  },
  {
    key: "cups",
    name: "Cups",
    nameVi: "Cốc",
    element: "Water",
    theme: "cảm xúc, quan hệ, trực giác",
  },
  {
    key: "swords",
    name: "Swords",
    nameVi: "Kiếm",
    element: "Air",
    theme: "tư duy, xung đột, sự thật",
  },
  {
    key: "pentacles",
    name: "Pentacles",
    nameVi: "Tiền",
    element: "Earth",
    theme: "vật chất, công việc, thực tế",
  },
];

const RANKS: {
  n: number;
  en: string;
  vi: string;
  up: string;
  rev: string;
}[] = [
  {
    n: 1,
    en: "Ace",
    vi: "Át",
    up: "Khởi nguồn năng lượng thuần khiết của bộ.",
    rev: "Cơ hội bị chặn, trì hoãn khởi đầu.",
  },
  {
    n: 2,
    en: "Two",
    vi: "Hai",
    up: "Cân nhắc cặp đối, lựa chọn bước tiếp.",
    rev: "Mất cân bằng, do dự kéo dài.",
  },
  {
    n: 3,
    en: "Three",
    vi: "Ba",
    up: "Mở rộng, hợp tác, kết quả sơ khởi.",
    rev: "Chậm tiến, thiếu đồng lòng.",
  },
  {
    n: 4,
    en: "Four",
    vi: "Bốn",
    up: "Ổn định cấu trúc, nền tạm vững.",
    rev: "Bế tắc, cứng nhắc trong khuôn.",
  },
  {
    n: 5,
    en: "Five",
    vi: "Năm",
    up: "Thách thức, mất mát nhỏ để học bài học.",
    rev: "Leo thang xung đột hoặc phục hồi sau va chạm.",
  },
  {
    n: 6,
    en: "Six",
    vi: "Sáu",
    up: "Hài hòa trở lại, hỗ trợ, tiến bộ.",
    rev: "Nợ ơn lệch, tiến chậm hơn kỳ vọng.",
  },
  {
    n: 7,
    en: "Seven",
    vi: "Bảy",
    up: "Kiên trì đánh giá, chiến lược dài.",
    rev: "Mệt mỏi, bỏ cuộc sớm, thiếu tin.",
  },
  {
    n: 8,
    en: "Eight",
    vi: "Tám",
    up: "Vận động nhanh, tinh luyện kỹ năng.",
    rev: "Trì trệ, phân tán lực.",
  },
  {
    n: 9,
    en: "Nine",
    vi: "Chín",
    up: "Gần hoàn tất, tích lũy thành quả.",
    rev: "Lo âu trước đích, tự cô lập.",
  },
  {
    n: 10,
    en: "Ten",
    vi: "Mười",
    up: "Đỉnh chu kỳ bộ bài, gánh hoặc viên mãn.",
    rev: "Buông gánh nặng, kết thúc quá tải.",
  },
  {
    n: 11,
    en: "Page",
    vi: "Đầy tớ",
    up: "Tin tức mới, học trò nhiệt huyết.",
    rev: "Tin chậm, nông nổi, thiếu chín.",
  },
  {
    n: 12,
    en: "Knight",
    vi: "Hiệp sĩ",
    up: "Hành động quyết liệt theo tinh thần bộ.",
    rev: "Vội vàng, cực đoan, thiếu định hướng.",
  },
  {
    n: 13,
    en: "Queen",
    vi: "Nữ hoàng",
    up: "Làm chủ năng lượng bộ bằng trực giác & phẩm chất.",
    rev: "Lệch cảm xúc / kiểm soát theo bóng tối bộ.",
  },
  {
    n: 14,
    en: "King",
    vi: "Nhà vua",
    up: "Lãnh đạo chín chắn, làm chủ lĩnh vực bộ.",
    rev: "Độc đoán, cứng nhắc quyền lực.",
  },
];

function minorCards(): OracleCardSeed[] {
  const out: OracleCardSeed[] = [];
  let sort = 100;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = `${suit.key}_${rank.n}`;
      out.push({
        key,
        deckId: "tarot",
        name: `${rank.en} of ${suit.name}`,
        nameVi: `${rank.vi} ${suit.nameVi}`,
        number: rank.n,
        suit: suit.key,
        element: suit.element,
        upright: `${rank.up} Chủ đề: ${suit.theme}.`,
        reversed: `${rank.rev} Chủ đề: ${suit.theme}.`,
        keywords: [suit.nameVi.toLowerCase(), rank.vi.toLowerCase(), suit.element],
        image: `/assets/oracle/tarot/${key}.webp`,
        enabled: true,
        sort: sort++,
        blurb: `Minor · ${suit.nameVi}`,
      });
    }
  }
  return out;
}

export const DEFAULT_ORACLE_DECKS: OracleDeckMeta[] = [
  {
    id: "tarot",
    nameVi: "Tarot (78 lá)",
    blurb: "Major Arcana + Minor Arcana — bói bài kinh điển.",
    enabled: true,
    sort: 1,
  },
  {
    id: "zodiac",
    nameVi: "Chiêm tinh (12 cung)",
    blurb: "Mười hai cung Hoàng đạo — năng lượng tháng / bản ngã.",
    enabled: true,
    sort: 2,
  },
];

export function buildDefaultOracleCards(): OracleCardSeed[] {
  const major: OracleCardSeed[] = MAJOR.map((c, i) => ({
    ...c,
    deckId: "tarot",
    suit: "major",
    image: `/assets/oracle/tarot/${c.key}.webp`,
    enabled: true,
    sort: i,
  }));
  const zodiac: OracleCardSeed[] = ZODIAC.map((c, i) => ({
    ...c,
    deckId: "zodiac",
    suit: "zodiac",
    image: `/assets/oracle/zodiac/${c.key}.webp`,
    enabled: true,
    sort: i,
  }));
  return [...major, ...minorCards(), ...zodiac];
}
