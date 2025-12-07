# Hướng dẫn Setup Git và Push Code

## Bước 1: Khởi tạo Git Repository

```bash
git init
```

## Bước 2: Thêm tất cả files

```bash
git add .
```

## Bước 3: Commit lần đầu

```bash
git commit -m "Initial commit: Portfolio website với Next.js + TypeScript

- Starfield background animation
- Shooting stars effect
- Glassmorphism navbar
- Responsive design
- Smooth animations với Framer Motion"
```

## Bước 4: Tạo Repository trên GitHub

1. Đăng nhập vào GitHub
2. Tạo repository mới (ví dụ: `stepdevcode.tech`)
3. **KHÔNG** khởi tạo với README, .gitignore, hoặc license (vì đã có sẵn)

## Bước 5: Kết nối với Remote Repository

```bash
# Thay <username> và <repo-name> bằng thông tin của bạn
git remote add origin https://github.com/<username>/<repo-name>.git
```

Hoặc nếu dùng SSH:
```bash
git remote add origin git@github.com:<username>/<repo-name>.git
```

## Bước 6: Push code lên GitHub

```bash
# Đổi tên branch thành main (nếu cần)
git branch -M main

# Push code
git push -u origin main
```

## Các lệnh Git hữu ích

### Xem trạng thái
```bash
git status
```

### Xem lịch sử commit
```bash
git log --oneline
```

### Thêm thay đổi và commit
```bash
git add .
git commit -m "Mô tả thay đổi"
git push
```

### Tạo branch mới
```bash
git checkout -b feature/new-feature
git push -u origin feature/new-feature
```

## Deploy lên Vercel

1. Truy cập [vercel.com](https://vercel.com)
2. Đăng nhập bằng GitHub
3. Import project từ GitHub repository
4. Vercel sẽ tự động detect Next.js và deploy
5. Website sẽ có URL dạng: `https://stepdevcode-tech.vercel.app`

## Lưu ý

- Đảm bảo `.env.local` đã được thêm vào `.gitignore`
- Không commit file nhạy cảm (API keys, tokens, etc.)
- Commit message nên rõ ràng và mô tả được thay đổi

