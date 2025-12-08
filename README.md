# StepDevCode.Tech - Portfolio Website

Một trang web portfolio siêu đỉnh với các hiệu ứng animation tuyệt đẹp, được xây dựng bằng Next.js 14 và TypeScript.

🌐 **Live Demo**: [stepdevcode.tech](https://stepdevcode.tech)

## ✨ Tính năng

- 🌟 **Starfield Background**: Bầu trời sao động với hiệu ứng lấp lánh
- ⭐ **Shooting Stars**: Hiệu ứng sao băng di chuyển chéo qua màn hình
- 🔮 **Glassmorphism Navbar**: Thanh điều hướng với hiệu ứng kính mờ
- 🎨 **Smooth Animations**: Sử dụng Framer Motion cho các animation mượt mà
- 📱 **Responsive Design**: Tối ưu cho mọi thiết bị
- 🎯 **Modern UI/UX**: Giao diện hiện đại và trải nghiệm người dùng tuyệt vời

## 🚀 Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Chạy development server:
```bash
npm run dev
```

3. Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt

## 🛠️ Công nghệ sử dụng

- **Next.js 14**: React framework với App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library cho React
- **Canvas API**: Để tạo hiệu ứng starfield

## 📁 Cấu trúc dự án (2 nhóm chính)

```
├── app/
│   ├── static/                 # Nhóm trang tĩnh (không cần server)
│   │   └── page.tsx            # Portfolio tĩnh
│   ├── habit/                  # Nhóm trang động (cần server)
│   │   ├── page.tsx            # Danh sách hãng
│   │   └── [brandId]/[deckId]/page.tsx  # Các bộ & lá bài
│   ├── page.tsx                # Home động (chọn Static vs Dynamic)
│   ├── layout.tsx
│   └── globals.css
├── components/                 # Components dùng chung (tĩnh + động)
├── docs/                       # Tài liệu (deploy, static vs dynamic, git)
├── scripts/                    # Script tiện ích (start.ps1/.bat)
└── package.json + config       # next.config.js, tailwind, postcss, tsconfig
```

## 🎨 Tùy chỉnh

### Thay đổi màu sắc
Chỉnh sửa các gradient trong `tailwind.config.ts` và các component để thay đổi màu sắc chủ đạo.

### Thêm nội dung
Cập nhật thông tin cá nhân trong các component:
- `Hero.tsx`: Tên và role
- `About.tsx`: Thông tin về bạn
- `Projects.tsx`: Danh sách dự án

### Điều chỉnh animation
Tùy chỉnh tốc độ và hiệu ứng trong:
- `components/Starfield.tsx`: Số lượng sao và tốc độ
- `components/ShootingStars.tsx`: Tần suất và tốc độ sao băng

## 📝 Scripts

- `npm run dev`: Chạy development server
- `npm run build`: Build production
- `npm run start`: Chạy production server
- `npm run lint`: Kiểm tra lỗi code

## 🚀 Deploy (gợi ý 2025)

- **Vercel (khuyến nghị cho phần động):** giữ `next.config.js` hiện tại, connect repo, auto deploy.
- **GitHub Pages / Static host (chỉ phần tĩnh):**
  ```bash
  npm run build:static
  # Deploy thư mục out/ lên Pages hoặc bất kỳ static host
  ```
  Chỉ phục vụ trang tĩnh `/static`.

📖 Chi tiết: `docs/STATIC_VS_DYNAMIC.md`, `docs/DEPLOYMENT_OPTIONS.md`

### 💻 Chạy Local (Development)

```bash
# Development server
npm run dev
# Truy cập: http://localhost:3000

# Production build local
npm run build
npm start
# Truy cập: http://localhost:3000
```

## 📦 Git Setup

```bash
# Khởi tạo git repository (nếu chưa có)
git init

# Thêm tất cả files
git add .

# Commit
git commit -m "Initial commit: Portfolio website với Next.js + TypeScript"

# Thêm remote repository
git remote add origin <your-repo-url>

# Push lên GitHub
git push -u origin main
```

## 🎯 Tính năng nổi bật

### Starfield Background
- 200 ngôi sao động với hiệu ứng lấp lánh
- Canvas animation mượt mà, tối ưu performance
- Tự động resize khi thay đổi kích thước màn hình

### Shooting Stars
- Sao băng di chuyển chéo với gradient đẹp mắt
- Tự động tạo mới và xóa khi ra khỏi màn hình
- Hiệu ứng shadow và glow

### Glassmorphism Navbar
- Backdrop blur effect
- Active section detection
- Smooth scroll navigation
- Responsive design

## 📄 License

MIT License - Tự do sử dụng cho dự án của bạn!

## 👨‍💻 Author

**StepDevCode.Tech**

- Website: [stepdevcode.tech](https://stepdevcode.tech)
- GitHub: [@stepdevcode](https://github.com/stepdevcode)

