/**
 * Phase 2 seed: Lenormand 36 + Trà (oracle đơn giản).
 */

import type { OracleCardSeed, OracleDeckMeta } from "./oracleSeed.js";

export const LENORMAND_DECK_META: OracleDeckMeta = {
  id: "lenormand",
  nameVi: "Lenormand (36 lá)",
  blurb: "Bộ Lenormand cổ điển — đọc chuỗi ký hiệu ngắn gọn.",
  enabled: true,
  sort: 20,
  tradition: "custom",
  research: true,
};

export const TEA_DECK_META: OracleDeckMeta = {
  id: "tea",
  nameVi: "Bói Trà",
  blurb: "Dấu hiệu trà — giải trí chiêm nghiệm theo biểu tượng.",
  enabled: true,
  sort: 30,
  tradition: "custom",
  research: true,
};

const LENORMAND: { key: string; name: string; nameVi: string; upright: string; reversed: string; keywords: string[] }[] = [
  { key: "rider", name: "Rider", nameVi: "Hiệp sĩ", upright: "Tin tức đến nhanh, chuyển động, người đưa tin.", reversed: "Tin chậm, trì hoãn, thông điệp lệch.", keywords: ["tin", "nhanh"] },
  { key: "clover", name: "Clover", nameVi: "Cỏ ba lá", upright: "May mắn nhỏ, cơ hội ngắn, nhẹ nhõm.", reversed: "May rủi qua nhanh, đừng chủ quan.", keywords: ["may", "nhẹ"] },
  { key: "ship", name: "Ship", nameVi: "Con tàu", upright: "Hành trình, giao thương, mở rộng tầm.", reversed: "Kế hoạch đi chậm, tắc đường xa.", keywords: ["đi", "mở"] },
  { key: "house", name: "House", nameVi: "Ngôi nhà", upright: "Gia đình, ổn định, nền tảng riêng.", reversed: "Bất ổn nhà cửa, thiếu chỗ dựa.", keywords: ["nhà", "ổn"] },
  { key: "tree", name: "Tree", nameVi: "Cây", upright: "Sức khỏe, tăng trưởng dài hạn, gốc rễ.", reversed: "Mệt mỏi, cần chăm gốc trước.", keywords: ["khỏe", "gốc"] },
  { key: "clouds", name: "Clouds", nameVi: "Mây", upright: "Mơ hồ, nghi hoặc, chưa rõ hướng.", reversed: "Tan sương, nhìn rõ dần.", keywords: ["mờ", "nghi"] },
  { key: "snake", name: "Snake", nameVi: "Rắn", upright: "Phức tạp, cám dỗ, người khôn khéo.", reversed: "Tháo gỡ mưu kế, hết vòng vèo.", keywords: ["phức", "cám"] },
  { key: "coffin", name: "Coffin", nameVi: "Quan tài", upright: "Kết thúc, buông bỏ, đóng chu kỳ.", reversed: "Kéo dài kết thúc, khó buông.", keywords: ["kết", "đóng"] },
  { key: "bouquet", name: "Bouquet", nameVi: "Bó hoa", upright: "Quà, lời khen, vẻ đẹp, tử tế.", reversed: "Lời ngọt sáo, quà không đúng.", keywords: ["quà", "đẹp"] },
  { key: "scythe", name: "Scythe", nameVi: "Lưỡi hái", upright: "Cắt đứt đột ngột, quyết nhanh.", reversed: "Sợ cắt, trì hoãn quyết.", keywords: ["cắt", "nhanh"] },
  { key: "whip", name: "Whip", nameVi: "Roi", upright: "Tranh cãi, lặp lại, xung đột lời.", reversed: "Hạ nhiệt tranh chấp.", keywords: ["cãi", "lặp"] },
  { key: "birds", name: "Birds", nameVi: "Chim", upright: "Trò chuyện, lo lắng nhỏ, đôi.", reversed: "ồn ào vô ích, tin đồn.", keywords: ["nói", "lo"] },
  { key: "child", name: "Child", nameVi: "Đứa trẻ", upright: "Mới mẻ, ngây thơ, khởi đầu nhỏ.", reversed: "Hờ hững, thiếu chín.", keywords: ["mới", "nhỏ"] },
  { key: "fox", name: "Fox", nameVi: "Cáo", upright: "Công việc, khôn ngoan, cảnh giác.", reversed: "Bị lừa, thiếu tỉnh táo nghề.", keywords: ["việc", "khôn"] },
  { key: "bear", name: "Bear", nameVi: "Gấu", upright: "Sức mạnh, bảo hộ, tài chính lớn.", reversed: "Áp lực quyền lực, nuốt năng lượng.", keywords: ["mạnh", "bảo"] },
  { key: "stars", name: "Stars", nameVi: "Ngôi sao", upright: "Hy vọng, cảm hứng, định hướng.", reversed: "Mất phương, hy vọng mờ.", keywords: ["hy vọng"] },
  { key: "stork", name: "Stork", nameVi: "Cò", upright: "Thay đổi, chuyển nhà, tiến triển.", reversed: "Đổi chậm, kháng cự thay đổi.", keywords: ["đổi"] },
  { key: "dog", name: "Dog", nameVi: "Chó", upright: "Bạn trung thành, đồng minh.", reversed: "Bạn giả, lòng tin lung lay.", keywords: ["bạn"] },
  { key: "tower", name: "Tower", nameVi: "Tháp", upright: "Cơ quan, ranh giới, vị thế.", reversed: "Cô lập, quan liêu.", keywords: ["tháp", "vị"] },
  { key: "garden", name: "Garden", nameVi: "Khu vườn", upright: "Xã hội, mạng lưới, công khai.", reversed: "Đám đông mệt, mất riêng tư.", keywords: ["xã hội"] },
  { key: "mountain", name: "Mountain", nameVi: "Núi", upright: "Trở ngại lớn, trì trệ, thử thách.", reversed: "Vượt ải, đường mở dần.", keywords: ["cản"] },
  { key: "crossroad", name: "Crossroad", nameVi: "Ngã ba", upright: "Lựa chọn, nhiều hướng.", reversed: "Do dự, lệch hướng.", keywords: ["chọn"] },
  { key: "mice", name: "Mice", nameVi: "Chuột", upright: "Hao hụt, lo âu nhỏ bào mòn.", reversed: "Ngừng thất thoát, phục hồi.", keywords: ["hao"] },
  { key: "heart", name: "Heart", nameVi: "Trái tim", upright: "Tình cảm, yêu thương, vui.", reversed: "Đau lòng, lệch nhịp cảm xúc.", keywords: ["tim"] },
  { key: "ring", name: "Ring", nameVi: "Nhẫn", upright: "Cam kết, hợp đồng, vòng kết.", reversed: "Vỡ hứa, ràng buộc lệch.", keywords: ["hứa"] },
  { key: "book", name: "Book", nameVi: "Sách", upright: "Bí mật, học hỏi, tri thức ẩn.", reversed: "Lộ thông tin, học chưa tới.", keywords: ["bí"] },
  { key: "letter", name: "Letter", nameVi: "Lá thư", upright: "Tin viết, giấy tờ, thông báo.", reversed: "Tin sai, giấy tờ chậm.", keywords: ["thư"] },
  { key: "man", name: "Man", nameVi: "Người nam", upright: "Nhân vật nam quan trọng / năng lượng dương.", reversed: "Lệch vai trò nam trong chuyện.", keywords: ["nam"] },
  { key: "woman", name: "Woman", nameVi: "Người nữ", upright: "Nhân vật nữ quan trọng / năng lượng âm.", reversed: "Lệch vai trò nữ trong chuyện.", keywords: ["nữ"] },
  { key: "lily", name: "Lily", nameVi: "Hoa huệ", upright: "Hòa bình, chín chắn, đạo đức.", reversed: "Căng già, thiếu dịu dàng.", keywords: ["hòa"] },
  { key: "sun", name: "Sun", nameVi: "Mặt trời", upright: "Thành công, vui, sáng rõ.", reversed: "Tạm u ám, thành công chậm.", keywords: ["nắng"] },
  { key: "moon", name: "Moon", nameVi: "Mặt trăng", upright: "Danh tiếng, cảm xúc đêm, chu kỳ.", reversed: "Danh ảo, cảm xúc rối.", keywords: ["trăng"] },
  { key: "key", name: "Key", nameVi: "Chìa khóa", upright: "Lời giải, chắc chắn, mở được.", reversed: "Chưa khớp khóa, giải pháp lệch.", keywords: ["khóa"] },
  { key: "fish", name: "Fish", nameVi: "Cá", upright: "Tiền bạc, lưu thông, kinh doanh.", reversed: "Tắc dòng tiền, tiêu hao.", keywords: ["tiền"] },
  { key: "anchor", name: "Anchor", nameVi: "Neo", upright: "Ổn định công việc, neo chắc.", reversed: "Bám quá cứng, trì trệ.", keywords: ["neo"] },
  { key: "cross", name: "Cross", nameVi: "Thánh giá", upright: "Gánh nặng, thử thách tinh thần, định mệnh.", reversed: "Nhẹ gánh, học bài xong.", keywords: ["gánh"] },
];

const TEA: { key: string; name: string; nameVi: string; upright: string; reversed: string; keywords: string[] }[] = [
  { key: "tea_ring", name: "Ring in cup", nameVi: "Vòng trong tách", upright: "Cam kết hoặc lời mời sắp tới.", reversed: "Hứa hẹn lung lay.", keywords: ["cam kết"] },
  { key: "tea_bird", name: "Bird", nameVi: "Hình chim", upright: "Tin vui, chuyến đi ngắn.", reversed: "Tin đồn gây nhiễu.", keywords: ["tin"] },
  { key: "tea_tree", name: "Tree", nameVi: "Hình cây", upright: "Sức khỏe và tăng trưởng vững.", reversed: "Cần nghỉ dưỡng.", keywords: ["khỏe"] },
  { key: "tea_heart", name: "Heart", nameVi: "Trái tim", upright: "Tình cảm ngọt, mở lòng.", reversed: "Thương nhớ lệch pha.", keywords: ["tim"] },
  { key: "tea_path", name: "Path", nameVi: "Đường", upright: "Lựa chọn lộ trình rõ hơn.", reversed: "Ngã rẽ gây do dự.", keywords: ["đường"] },
  { key: "tea_mountain", name: "Mountain", nameVi: "Núi", upright: "Thử thách cần kiên trì.", reversed: "Cản trở đang lùi.", keywords: ["cản"] },
  { key: "tea_coin", name: "Coin", nameVi: "Đồng xu", upright: "Cơ hội tài chính nhỏ.", reversed: "Chi tiêu cần siết.", keywords: ["xu"] },
  { key: "tea_house", name: "House", nameVi: "Nhà", upright: "Tin vui gia đình / chỗ ở.", reversed: "Bất ổn chỗ dựa.", keywords: ["nhà"] },
  { key: "tea_snake", name: "Snake", nameVi: "Rắn", upright: "Cảnh giác người quanh.", reversed: "Mối nguy đã lộ.", keywords: ["cảnh"] },
  { key: "tea_star", name: "Star", nameVi: "Sao", upright: "Ước nguyện được soi sáng.", reversed: "Hy vọng cần thực tế hơn.", keywords: ["sao"] },
  { key: "tea_anchor", name: "Anchor", nameVi: "Neo", upright: "Ổn định sắp chốt.", reversed: "Đừng neo sai chỗ.", keywords: ["neo"] },
  { key: "tea_cloud", name: "Cloud", nameVi: "Mây", upright: "Tạm thời chưa rõ — chờ thêm dấu.", reversed: "Sương đang tan.", keywords: ["mây"] },
];

export function buildLenormandCards(): OracleCardSeed[] {
  return LENORMAND.map((c, i) => ({
    key: c.key,
    deckId: "lenormand",
    name: c.name,
    nameVi: c.nameVi,
    number: i + 1,
    suit: "lenormand",
    element: "Spirit",
    upright: c.upright,
    reversed: c.reversed,
    keywords: c.keywords,
    image: `/assets/oracle/lenormand/${c.key}.svg`,
    enabled: true,
    sort: i,
    blurb: `Lenormand · ${i + 1}`,
    tags: ["lenormand"],
    notes: "",
    citations: "Tài liệu: Lenormand 36 lá / sơ lược",
    draft: false,
    level: "public",
    sourceDoc: "lenormand-36",
  }));
}

export function buildTeaCards(): OracleCardSeed[] {
  return TEA.map((c, i) => ({
    key: c.key,
    deckId: "tea",
    name: c.name,
    nameVi: c.nameVi,
    number: i + 1,
    suit: "tea",
    element: "Water",
    upright: c.upright,
    reversed: c.reversed,
    keywords: c.keywords,
    image: `/assets/oracle/tea/${c.key}.svg`,
    enabled: true,
    sort: i,
    blurb: `Trà · ${i + 1}`,
    tags: ["tea"],
    notes: "",
    citations: "Tài liệu: Ý nghĩa những lá bài Trà",
    draft: false,
    level: "public",
    sourceDoc: "tea-35",
  }));
}
