/** Nghĩa lá Bói bài — 78 lá từ tài liệu PDF + chiêm tinh / note truyền thống. */

import {
  DOC_MAJOR_MEANINGS,
  DOC_MINOR_MEANINGS,
} from "./oracleDoc78.gen.js";

export type MeaningRow = {
  upright: string;
  reversed: string;
  keywords: string[];
  notes?: string;
  citations?: string;
};

type RowInput = Omit<MeaningRow, "citations"> & { citations: string };

const makeRow = (row: RowInput): MeaningRow => row;

export const MARSEILLE_CITATION = "Tarot de Marseille · biểu tượng cổ châu Âu";
export const THOTH_CITATION = "Thoth Crowley · Qabalah / astrology / alchemy";
const ZODIAC_CITATION = "Chiêm tinh Tây · 12 cung";

/** Rider–Waite 22 Major — nguồn: TAROT Ý nghĩa 78 lá bài (156 trang). */
export const MAJOR_MEANINGS: Record<string, MeaningRow> = DOC_MAJOR_MEANINGS;

/** Rider–Waite 56 Minor — nguồn: TAROT Ý nghĩa 78 lá bài (156 trang). */
export const MINOR_MEANINGS: Record<string, MeaningRow> = DOC_MINOR_MEANINGS;

const ZODIAC_ROWS: Record<string, Omit<MeaningRow, "citations">> = {
  aries: {
    upright:
      "Bạn được mời khởi động, mở đường và hành động trước khi quá nhiều người đồng ý. Giữ dũng khí nhưng giảm nóng vội; bước nhỏ, rõ mục tiêu, dễ thắng hơn lao thẳng.",
    reversed:
      "Khi cái tôi quá nóng, xung đột và hấp tấp làm mục tiêu lệch khỏi hướng. Hãy hạ tốc, chọn một việc quan trọng nhất, và dùng kỷ luật để giữ lửa.",
    keywords: ["khởi xướng", "nhiệt huyết", "dũng cảm"],
  },
  taurus: {
    upright:
      "Năng lượng đất này muốn an toàn, giá trị bền và nhịp sống đều. Hãy chăm cơ thể, tài chính và điều bạn thật sự coi trọng, rồi để mọi thứ lớn chậm mà chắc.",
    reversed:
      "Cố chấp hoặc bám vào tiện nghi cũ làm bạn chậm tiến. Hãy mở tay với thay đổi nhỏ, vì an toàn thật đến từ sự ổn định linh hoạt.",
    keywords: ["ổn định", "giá trị", "kiên trì"],
  },
  gemini: {
    upright:
      "Bạn đang cần học, nói, viết và kết nối nhiều hơn. Hãy chọn lọc thông tin, giữ câu chuyện rõ ràng, và tránh để sự tò mò biến thành phân tán.",
    reversed:
      "Nhiễu tin và nói nhiều làm ý chính bị mờ. Đóng bớt các kênh, xác minh điều quan trọng, và đừng để đầu óc chạy quá nhiều hướng.",
    keywords: ["giao tiếp", "linh hoạt", "thông tin"],
  },
  cancer: {
    upright:
      "Điều cần nuôi bây giờ là cảm giác an toàn, nhà cửa và sự nâng đỡ tình cảm. Hãy chăm người thân, chăm ký ức, nhưng đừng để nỗi sợ kéo bạn về vỏ cũ.",
    reversed:
      "Phòng thủ quá mức khiến mọi thứ ngột ngạt. Hãy mở thêm một khe cửa cho tin cậy, và đừng để quá khứ điều khiển phản ứng hiện tại.",
    keywords: ["gia đình", "an toàn", "chăm sóc"],
  },
  leo: {
    upright:
      "Bạn có thể tỏa sáng bằng sự ấm áp, sáng tạo và lòng hào phóng. Hãy cho thấy trái tim của mình, nhưng đừng biến được chú ý thành nhu cầu sống còn.",
    reversed:
      "Kiêu hãnh hoặc nhu cầu được công nhận quá lớn có thể làm ánh sáng của bạn chói thay vì ấm. Hạ cái tôi, rồi để tài năng tự lên tiếng.",
    keywords: ["tỏa sáng", "sáng tạo", "tự tin"],
  },
  virgo: {
    upright:
      "Năng lượng này muốn tinh chỉnh, phục vụ và làm cho mọi thứ vận hành tốt hơn. Hãy sửa điều nhỏ, giữ thói quen lành, và xem chi tiết là nơi tạo giá trị.",
    reversed:
      "Cầu toàn, lo lắng hoặc soi lỗi quá mức sẽ làm bạn mệt. Hãy chấp nhận đủ tốt, ưu tiên việc thật sự quan trọng, và đừng tự bắt lỗi mãi.",
    keywords: ["tinh chỉnh", "phục vụ", "chi tiết"],
  },
  libra: {
    upright:
      "Bạn đang được mời cân lại quan hệ, hợp tác và cách bạn ra quyết định. Hãy tìm công bằng có đối thoại, không phải công bằng bằng cách né xung đột.",
    reversed:
      "Do dự hoặc chiều lòng quá mức làm cán cân lệch. Nói rõ điều bạn muốn, vì hòa hợp thật cần ranh giới chứ không chỉ lịch sự.",
    keywords: ["cân bằng", "quan hệ", "công bằng"],
  },
  scorpio: {
    upright:
      "Đây là năng lượng của chiều sâu, biến đổi và sự thật không dễ nói. Hãy chấp nhận đào sâu, bỏ lớp giả, và dùng cường độ cảm xúc để tái sinh.",
    reversed:
      "Kiểm soát, ghen hoặc giữ bí mật độc hại đang làm năng lượng nghẹt lại. Hãy thành thật hơn với động cơ của mình và buông điều bám chặt.",
    keywords: ["biến đổi", "chiều sâu", "sự thật"],
  },
  sagittarius: {
    upright:
      "Bạn cần mở rộng tầm nhìn, học hỏi và đi xa hơn những giới hạn quen thuộc. Hãy giữ lòng tin nhưng kiểm tra thực tế để đừng chỉ sống bằng khẩu hiệu.",
    reversed:
      "Nói lớn hơn làm, hoặc tin quá một chiều, có thể làm bạn lệch đường. Học cách lắng nghe và tinh chỉnh niềm tin bằng trải nghiệm thật.",
    keywords: ["mở rộng", "triết lý", "khám phá"],
  },
  capricorn: {
    upright:
      "Đây là sức của kỷ luật dài hạn, trách nhiệm và xây nền chắc. Hãy đi chậm mà chắc, vì điều bạn tạo hôm nay phải nâng đỡ được tương lai.",
    reversed:
      "Quá tải, cứng nhắc hoặc ám ảnh thành tựu khiến bạn kiệt sức. Bớt ôm vai trò một mình, và sửa nhịp làm việc trước khi nó bẻ bạn.",
    keywords: ["kỷ luật", "trách nhiệm", "xây nền"],
  },
  aquarius: {
    upright:
      "Năng lượng này nghiêng về đổi mới, cộng đồng và góc nhìn khác biệt. Hãy giữ đầu óc mở, nhưng gắn ý tưởng vào lợi ích thật cho người thật.",
    reversed:
      "Xa cách, lập dị vô hướng hoặc chống lại mọi thứ chỉ để khác biệt sẽ làm bạn lạc. Hãy nối lại với cộng đồng và mục đích rõ hơn.",
    keywords: ["đổi mới", "cộng đồng", "khác biệt"],
  },
  pisces: {
    upright:
      "Đây là năng lượng của lòng trắc ẩn, trực giác và trí tưởng tượng. Hãy để cảm xúc chảy, nhưng giữ ranh giới để sự mơ mộng không nuốt mất thực tế.",
    reversed:
      "Mơ hồ, thoát ly hoặc đồng cảm quá mức khiến bạn mất phương hướng. Quay về thân thể, lịch sinh hoạt và một ranh giới rõ ràng hơn.",
    keywords: ["trực giác", "trắc ẩn", "mơ mộng"],
  },
};

export const ZODIAC_MEANINGS: Record<string, MeaningRow> = Object.fromEntries(
  Object.entries(ZODIAC_ROWS).map(([key, value]) => [
    key,
    makeRow({
      ...value,
      citations: ZODIAC_CITATION,
    }),
  ]),
) as Record<string, MeaningRow>;

export const MARSEILLE_MAJOR_NOTES: Record<string, string> = {
  fool: "Trong Marseille, lá 0 là trạng thái mở chưa định hình; đọc như kẻ đứng ngoài mép hành trình, nơi số và hình chưa khóa lại.",
  magician: "Hình người và dụng cụ nhắc đến tay nghề, sự chủ động và khả năng nối trời đất bằng bàn tay con người.",
  priestess: "Không gian hai cột và tấm màn nhấn điều ẩn, sự im lặng và tri thức chỉ mở khi đủ chín.",
  empress: "Biểu tượng của sinh sôi, mùa màng và thân thể biết nuôi dưỡng; thường đọc qua độ dày, sự đầy và chuyển động mềm.",
  emperor: "Ghế ngồi, trật tự và cấu trúc cho thấy quyền lực được giữ bằng luật lệ hơn là cảm hứng.",
  hierophant: "Hình thầy và nghi lễ nhấn truyền thống, giáo huấn và đường dây nối cá nhân với cộng đồng.",
  lovers: "Ba nhân vật và lựa chọn giữa hai hướng làm nổi bật giá trị, sự đồng thuận và cái giá của chọn lựa.",
  chariot: "Xe, ngựa hoặc nhân vật di chuyển nhấn thắng thế bằng kiểm soát hướng đi và kỷ luật.",
  strength: "Mô-típ thuần phục thú tính bằng sự dịu dàng nhấn sức mạnh mềm và bản lĩnh không ồn.",
  hermit: "Ẩn sĩ mang đèn và cây gậy cho thấy tìm đường bằng cô đơn có chủ đích, không phải trốn đời.",
  wheel: "Bánh xe và các hình quanh nó cho thấy đời sống xoay theo chu kỳ, may rủi, thăng trầm.",
  justice: "Cán cân và lưỡi kiếm đặt công bằng lên mặt phẳng luật lệ, lời nói và hậu quả.",
  hanged: "Tư thế treo ngược nhấn đảo chiều góc nhìn, cái giá của dừng lại và phép buông.",
  death: "Xương, liềm, con ngựa hoặc biểu tượng tương tự nhấn sự cắt dứt tự nhiên của một chu kỳ.",
  temperance: "Hai bình và dòng chảy qua lại nhấn pha trộn, tiết chế và điều tiết nhịp.",
  devil: "Xiềng xích và thân thể nhắc đến ràng buộc do ham muốn, lệ thuộc và điều từng được chọn.",
  tower: "Tòa tháp bị đánh sập là hình ảnh phá vỡ ảo tưởng và trật tự giả.",
  star: "Ngôi sao và dòng nước gợi sự hồi phục, hy vọng và lời hứa của bầu trời đêm.",
  moon: "Mặt trăng và cảnh vật mờ cho thấy vùng không chắc chắn, sợ hãi và mộng ảnh.",
  sun: "Mặt trời, bức tường và đứa trẻ nhấn sự sống, niềm vui và sự sáng rõ của ban ngày.",
  judgement: "Tiếng gọi từ trên cao và những hình thức thức dậy cho thấy hồi sinh, xét lại, và bước ra khỏi ngủ mê.",
  world: "Vòng nguyệt quế, bốn biểu tượng bốn góc và chuyển động khép vòng nêu sự hoàn thành viên mãn.",
};

export const THOTH_MAJOR_NOTES: Record<string, string> = {
  fool: "Thoth xem 0 là điểm mở của ý thức và tiềm năng; lá này nghiêng về khả năng bước ra khỏi khuôn cũ mà vẫn giữ tỉnh thức.",
  magician: "Liên hệ với sức năng hành động của ý chí, ý tưởng được gom vào thao tác cụ thể; đọc như điểm quy tụ của năng lực và nhận biết.",
  priestess: "Là cánh cổng của tri thức bí mật, chịu ảnh hưởng của trực giác, mặt trăng và chiều sâu nội giới.",
  empress: "Nghiêng về nguyên lý sinh sản và sự phong nhiêu của tự nhiên, gắn với năng lượng sáng tạo và khoái cảm lành.",
  emperor: "Nguyên lý tổ chức, quyền lực và cấu trúc bền, kết nối với lửa định hình và năng lực bảo hộ.",
  hierophant: "Gắn với cấp độ luật thiêng, ngôn ngữ biểu tượng và quá trình truyền đạo qua lớp học thuật lẫn nghi thức.",
  lovers: "Là nơi lựa chọn tình yêu gặp thử thách của ý chí; đọc như sự hợp nhất cần tỉnh thức, không chỉ cảm xúc.",
  chariot: "Mang khí chất chinh phục, tiến lên bằng năng lực điều hướng lực đối nghịch; gần với ý chí chiến thắng.",
  strength: "Cân bằng năng lượng sống và lòng can đảm; sức mạnh là điều chỉnh nội lực, không phải ép buộc.",
  hermit: "Là ánh sáng soi đường trong hành trình nội tâm, nhấn trí tuệ chín và sự giản lược.",
  wheel: "Liên hệ mạnh với vòng quay của định mệnh, chuyển động của các lực vũ trụ và nhịp biến dịch.",
  justice: "Gắn với cán cân nghiệp quả và sự cân chỉnh giữa tư tưởng, hành động và hệ quả.",
  hanged: "Bài học là đảo trục ý thức để thấy điều vốn bị che; hy sinh ở đây là để mở trí.",
  death: "Không phải huỷ diệt đơn thuần mà là chuyển pha bắt buộc của năng lượng sống, kết thúc để tái cấu trúc.",
  temperance: "Là nghệ thuật dung hợp đối cực, hợp kim nội tâm và sự cân bằng tinh tế của dòng lực.",
  devil: "Lá bóng tối của ham muốn và ảo lực; đọc như bài kiểm tra về tự do, dục tính và kiểm soát.",
  tower: "Cú giáng của chân lý vào cấu trúc yếu, buộc năng lượng phải đổi hình nhanh và thật.",
  star: "Là tín hiệu hướng dẫn sau khủng hoảng, liên hệ với cảm hứng, tinh khiết và niềm tin.",
  moon: "Là cổng của tiềm thức, mộng và ảo tưởng; cần phân biệt linh cảm thật với nỗi lo.",
  sun: "Là tính minh bạch, sức sống và thành tựu hiện rõ; ánh sáng của ý thức chiếu trọn không che.",
  judgement: "Được đọc như lời gọi của cấp độ cao hơn, kết nối tái sinh tinh thần với sự đáp ứng đúng mệnh lệnh nội tâm.",
  world: "Là kết chu kỳ và hội nhập toàn bộ trải nghiệm; một trạng thái hoàn tất trước khi bước vào vòng mới.",
};

export const ORACLE_THEORY_SEED_VERSION = 4;
