# Build Troubleshooting Guide - StepDevCode.Tech

Tài liệu này ghi lại toàn bộ quá trình build và deploy dự án lên GitHub Pages, bao gồm tất cả các lỗi đã gặp và cách khắc phục.

## 📋 Mục lục

1. [Tổng quan dự án](#tổng-quan-dự-án)
2. [Mục tiêu ban đầu](#mục-tiêu-ban-đầu)
3. [Các bước đã thực hiện](#các-bước-đã-thực-hiện)
4. [Các lỗi đã gặp và cách khắc phục](#các-lỗi-đã-gặp-và-cách-khắc-phục)
5. [Các file đã tạo/sửa](#các-file-đã-tạosửa)
6. [Kiến thức rút ra](#kiến-thức-rút-ra)
7. [Checklist deploy GitHub Pages](#checklist-deploy-github-pages)

---

## 📖 Tổng quan dự án

- **Tên dự án**: StepDevCode.Tech - Portfolio Website
- **Framework**: Next.js 16.0.7 với TypeScript 5.7.2
- **React**: React 19.2.1
- **Deployment target**: GitHub Pages với custom domain `stepdevcode.tech`
- **Repository**: `KayHuynhLibra/stepdevcodetech`
- **Ngày bắt đầu**: 2025-12-08
- **Version hiện tại**: Next.js 16.0.7 (upgraded từ 14 → 15 → 16)

---

## 🎯 Mục tiêu ban đầu

1. Fix lại toàn bộ code để deploy GitHub Pages
2. Tạo một page đơn giản để chạy website
3. Cấu hình DNS và GitHub Pages để website hoạt động tại `stepdevcode.tech`

---

## 🔧 Các bước đã thực hiện

### Bước 1: Kiểm tra cấu trúc dự án

**Hành động**: 
- Kiểm tra thư mục dự án
- Xem các file cấu hình hiện có

**Kết quả**:
- Dự án có cấu trúc Next.js App Router
- Đã có `CNAME` file với domain `stepdevcode.tech`
- Có script `build:static` trong `package.json`
- Chưa có GitHub Actions workflow

### Bước 2: Tạo trang đơn giản

**Hành động**: 
- Tạo trang `/simple` để test website

**File tạo**: `app/simple/page.tsx`

**Mục đích**: Có một trang đơn giản không cần animation/API để test build

### Bước 3: Tạo GitHub Actions Workflow

**Hành động**: 
- Tạo workflow `.github/workflows/pages.yml` để tự động build và deploy

**Cấu hình ban đầu**:
```yaml
- Build static site với npm run build:static
- Copy CNAME vào out directory
- Upload artifact và deploy
```

### Bước 4: Cập nhật README

**Hành động**: 
- Thêm hướng dẫn deploy GitHub Pages vào README.md

### Bước 5: Cải thiện trang chủ

**Hành động**: 
- Cập nhật `app/page.tsx` để hỗ trợ cả static và dynamic build
- Không gọi API khi build static

### Bước 6: Cải thiện workflow

**Hành động**: 
- Thêm bước copy CNAME vào workflow
- Tách các bước build để dễ debug

### Bước 7: Upgrade Next.js 15

**Hành động**: 
- Cập nhật Next.js từ 14 lên 15.5.7
- Cập nhật React lên 19.2.1
- Cập nhật các dependencies liên quan

**Lỗi gặp phải**:
- ESLint errors về unescaped entities (`'` trong JSX)

**Cách khắc phục**:
- Thay `'` bằng `&apos;` trong các components
- Fix trong: `About.tsx`, `Contact.tsx`, `Hero.tsx`

**Kết quả**:
- Build thành công với Next.js 15.5.7
- React 19 hoạt động tốt

### Bước 8: Upgrade Next.js 16

**Hành động**: 
- Cập nhật Next.js từ 15.5.7 lên 16.0.7
- Cập nhật `eslint-config-next` lên 16.0.7
- Test build với Turbopack (mặc định trong Next.js 16)

**Tính năng mới**:
- Turbopack là bundler mặc định
- Build time giảm từ ~4.7s xuống ~3.1s
- TypeScript check nhanh hơn
- Parallel workers (19 workers)

**Kết quả**:
- Build thành công với Next.js 16.0.7
- Turbopack hoạt động tốt
- Tất cả routes generate đúng

---

## ❌ Các lỗi đã gặp và cách khắc phục

### Lỗi 1: Domain không resolve (NotServedByPagesError)

**Mô tả lỗi**:
```
Domain does not resolve to the GitHub Pages server. 
For more information, see documentation (NotServedByPagesError).
```

**Nguyên nhân**:
- DNS chưa được cấu hình đúng
- Chưa có A records và CNAME records trỏ về GitHub Pages

**Cách khắc phục**:
1. Thêm 4 A records cho apex domain (`@`):
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`

2. Thêm CNAME record cho `www`:
   - Host: `www`
   - Value: `KayHuynhLibra.github.io` (hoặc username GitHub của bạn)

3. Cấu hình GitHub Pages Settings:
   - Source: Chọn "GitHub Actions"
   - Custom domain: Nhập `stepdevcode.tech`
   - Bật "Enforce HTTPS"

**Lưu ý**: 
- Không dùng URL Forwarding/Masking, phải dùng DNS records
- Đợi DNS propagate (có thể mất vài phút đến 1 giờ)

---

### Lỗi 2: Workflow conflict với configure-pages

**Mô tả lỗi**:
```
TypeError: /home/runner/work/_actions/actions/configure-pages/v5/src/config-parser.js#L290
We were unable to determine how to inject the site metadata into your config.
Error: Cannot read properties of undefined (reading 'type')
```

**Nguyên nhân**:
- Có 2 workflow files với cùng tên "Deploy Next.js site to Pages"
- File `nextjs.yml` (từ GitHub template) đang cố inject basePath vào `next.config.js`
- `next.config.js` dùng conditional config nên không parse được

**Cách khắc phục**:
1. Xóa file `.github/workflows/nextjs.yml` (workflow template từ GitHub)
2. Chỉ giữ lại `.github/workflows/pages.yml` (workflow tự build)
3. Cải thiện `next.config.js` để cấu trúc rõ ràng hơn:

```javascript
// Trước (có thể gây lỗi parse)
const nextConfig = {
  reactStrictMode: true,
  ...(isStatic ? { output: 'export', ... } : {}),
}

// Sau (rõ ràng hơn)
const nextConfig = {
  reactStrictMode: true,
}
if (isStatic) {
  nextConfig.output = 'export'
  nextConfig.images = { unoptimized: true }
  nextConfig.trailingSlash = true
}
```

**Bài học**: 
- Không nên có nhiều workflow cùng tên
- Workflow tự build tốt hơn workflow dùng `configure-pages` cho static export

---

### Lỗi 3: package-lock.json không đồng bộ

**Mô tả lỗi**:
```
npm error `npm ci` can only install packages when your package.json and 
package-lock.json or npm-shrinkwrap.json are in sync.

npm error Invalid: lock file's picomatch@2.3.1 does not satisfy picomatch@4.0.3
npm error Missing: picomatch@2.3.1 from lock file
```

**Nguyên nhân**:
- `package-lock.json` không đồng bộ với `package.json`
- Dependencies đã được cập nhật nhưng lock file chưa được commit
- Có conflict về version của `picomatch`

**Cách khắc phục**:
1. Chạy `npm install` local để cập nhật `package-lock.json`
2. Commit và push `package-lock.json` mới:
```bash
npm install
git add package-lock.json
git commit -m "Fix package-lock.json sync issue"
git push origin main
```

**Bài học**: 
- Luôn commit `package-lock.json` sau khi cập nhật dependencies
- Đảm bảo `package-lock.json` đồng bộ trước khi push
- Dùng `npm ci` trong CI/CD để đảm bảo install chính xác

---

### Lỗi 4: Website local không hiện

**Mô tả lỗi**:
- Chạy `npm run dev` nhưng website không hiện

**Nguyên nhân**:
- Server chưa khởi động đúng cách
- Port 3000 có thể bị chiếm

**Cách khắc phục**:
1. Kiểm tra port: `netstat -ano | findstr :3000`
2. Chạy lại server: `npm run dev`
3. Đợi server khởi động (thường mất vài giây)
4. Truy cập: `http://localhost:3000`

**Lưu ý**: 
- Development server cần thời gian để compile
- Kiểm tra console để xem có lỗi không

---

### Lỗi 5: ESLint unescaped entities khi upgrade Next.js 15

**Mô tả lỗi**:
```
Error: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  
react/no-unescaped-entities

./components/About.tsx
41:16  Error: `'` can be escaped
46:58  Error: `'` can be escaped

./components/Contact.tsx
49:40  Error: `'` can be escaped

./components/Hero.tsx
31:18  Error: `'` can be escaped
45:46  Error: `'` can be escaped
```

**Nguyên nhân**:
- Next.js 15 có ESLint rules nghiêm ngặt hơn
- Không cho phép dấu nháy đơn (`'`) trực tiếp trong JSX text
- Cần escape các ký tự đặc biệt

**Cách khắc phục**:
1. Thay tất cả `'` bằng `&apos;` trong JSX:
   - `I'm` → `I&apos;m`
   - `Let's` → `Let&apos;s`
   - `I'm a` → `I&apos;m a`

2. Files đã sửa:
   - `components/About.tsx`: 2 lỗi
   - `components/Contact.tsx`: 1 lỗi
   - `components/Hero.tsx`: 2 lỗi

**Bài học**: 
- Next.js 15+ có ESLint rules nghiêm ngặt hơn
- Luôn escape các ký tự đặc biệt trong JSX
- Có thể disable rule này nếu cần: `"react/no-unescaped-entities": "off"`

---

### Lỗi 6: tsconfig.json jsx setting conflict

**Mô tả lỗi**:
- Khi upgrade Next.js 16, Next.js tự động thay đổi `jsx` từ `"preserve"` về `"react-jsx"`
- Có thể gây confusion nếu manual set `"preserve"`

**Nguyên nhân**:
- Next.js 16 tự động cấu hình `tsconfig.json` khi build
- Next.js sử dụng React automatic runtime, không cần `"preserve"`

**Cách khắc phục**:
- Để Next.js tự động cấu hình `tsconfig.json`
- Hoặc set `jsx: "react-jsx"` trong `tsconfig.json`

**Kết quả**:
- Next.js tự động set `jsx: "react-jsx"` khi build
- Không cần manual config

**Bài học**: 
- Tin tưởng Next.js auto-configuration
- Không cần manual set `jsx: "preserve"` cho Next.js

---

## 📁 Các file đã tạo/sửa

### Files mới tạo:

1. **`.github/workflows/pages.yml`**
   - Workflow tự động build và deploy lên GitHub Pages
   - Build static site với `npm run build`
   - Copy CNAME vào out directory
   - Upload và deploy artifact

2. **`app/simple/page.tsx`**
   - Trang đơn giản để test website
   - Không cần animation/API

3. **`docs/BUILD_TROUBLESHOOTING.md`** (file này)
   - Tài liệu ghi lại toàn bộ quá trình

### Files đã sửa:

1. **`app/page.tsx`**
   - Thêm hỗ trợ static build
   - Không gọi API khi `NEXT_PUBLIC_STATIC_BUILD=true`
   - Hiển thị message phù hợp cho static build

2. **`next.config.js`**
   - Cải thiện cấu trúc để tránh lỗi parse
   - Conditional config rõ ràng hơn

3. **`README.md`**
   - Thêm hướng dẫn deploy GitHub Pages
   - Cập nhật thông tin về workflow

4. **`package-lock.json`**
   - Cập nhật để đồng bộ với `package.json`
   - Fix conflict về `picomatch`

5. **`components/About.tsx`, `components/Contact.tsx`, `components/Hero.tsx`**
   - Fix ESLint errors về unescaped entities
   - Thay `'` bằng `&apos;`

6. **`tsconfig.json`**
   - Cập nhật target lên `ES2022`
   - Next.js tự động cấu hình `jsx: "react-jsx"`

7. **`package.json`**
   - Upgrade Next.js: 14 → 15.5.7 → 16.0.7
   - Upgrade React: 18 → 19.2.1
   - Cập nhật tất cả dependencies

### Files đã xóa:

1. **`.github/workflows/nextjs.yml`**
   - Xóa vì conflict với `pages.yml`
   - Workflow này dùng `configure-pages` gây lỗi

---

## 💡 Kiến thức rút ra

### 1. GitHub Pages với Next.js Static Export

**Cách hoạt động**:
- Next.js có thể export thành static site với `output: 'export'`
- Static export không hỗ trợ API routes và dynamic routes
- Cần tạm thời di chuyển các routes không hỗ trợ khi build

**Best practices**:
- Dùng GitHub Actions để build và deploy tự động
- Copy CNAME file vào thư mục `out/` sau khi build
- Không dùng `configure-pages` cho static export, tự build tốt hơn

### 2. DNS Configuration cho GitHub Pages

**A Records (cho apex domain)**:
- Cần 4 A records với IP của GitHub Pages
- IP có thể thay đổi, kiểm tra documentation mới nhất

**CNAME Record (cho subdomain)**:
- `www` → `username.github.io`
- Không được dùng CNAME cho apex domain (trừ một số DNS provider hỗ trợ)

**Lưu ý**:
- Không dùng URL Forwarding/Masking
- Đợi DNS propagate (có thể mất thời gian)
- Kiểm tra DNS với `nslookup` hoặc `dig`

### 3. GitHub Actions Workflow

**Cấu trúc workflow tốt**:
- Tách các bước rõ ràng để dễ debug
- Mỗi bước có log riêng
- Xử lý lỗi tốt với `if` statements

**Permissions cần thiết**:
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

**Environment variables**:
- Set env vars trong workflow, không hardcode
- Dùng `env:` trong steps

### 4. Package Management

**npm ci vs npm install**:
- `npm ci`: Clean install, dùng cho CI/CD
- `npm install`: Update lock file, dùng local development
- Luôn commit `package-lock.json` sau khi update dependencies

**Dependency conflicts**:
- Kiểm tra version conflicts
- Update lock file khi có conflict
- Test local trước khi push

### 5. Next.js Static Export

**Cấu hình cần thiết**:
```javascript
output: 'export'
images: { unoptimized: true }
trailingSlash: true
```

**Hạn chế**:
- Không hỗ trợ API routes
- Không hỗ trợ dynamic routes (có thể workaround)
- Không hỗ trợ server-side rendering

**Workaround cho dynamic routes**:
- Tạm thời di chuyển routes không hỗ trợ khi build
- Khôi phục lại sau khi build xong

### 6. Upgrade Next.js từ 14 → 15 → 16

**Quá trình upgrade**:

1. **Next.js 14 → 15**:
   - Cập nhật `next` và `eslint-config-next` lên 15.x
   - Cập nhật React lên 19.x
   - Fix ESLint errors về unescaped entities
   - Test build và fix các breaking changes

2. **Next.js 15 → 16**:
   - Cập nhật `next` và `eslint-config-next` lên 16.x
   - Turbopack tự động được enable
   - Build time cải thiện đáng kể
   - TypeScript config tự động được cập nhật

**Breaking changes cần lưu ý**:
- ESLint rules nghiêm ngặt hơn (unescaped entities)
- TypeScript config tự động được cập nhật
- Turbopack là bundler mặc định (Next.js 16)

**Best practices khi upgrade**:
- Đọc changelog trước khi upgrade
- Test build local trước khi push
- Fix ESLint errors ngay khi gặp
- Commit từng bước upgrade để dễ rollback

### 7. Next.js 16 Features

**Tính năng mới trong Next.js 16**:

1. **Turbopack mặc định**:
   - Build nhanh hơn 2-5 lần
   - Hot reload nhanh hơn 10 lần
   - Tự động enable, không cần config

2. **Cache Components**:
   - Directive `"use cache"` để cache components
   - Kiểm soát caching tốt hơn

3. **Next.js DevTools MCP**:
   - Debug thông minh với AI
   - Thông tin về routing, caching, rendering

4. **Improved Performance**:
   - Parallel workers (19 workers)
   - TypeScript check nhanh hơn
   - Build optimization tốt hơn

**So sánh hiệu suất**:
- Next.js 15: Build time ~4.7s
- Next.js 16: Build time ~3.1s (với Turbopack)
- Cải thiện: ~34% nhanh hơn

---

## ✅ Checklist deploy GitHub Pages

### Trước khi deploy:

- [ ] Đảm bảo `package-lock.json` đồng bộ với `package.json`
- [ ] Test build local: `npm run build:static`
- [ ] Kiểm tra thư mục `out/` có đầy đủ files
- [ ] File `CNAME` có trong repo root

### Cấu hình DNS:

- [ ] Thêm 4 A records cho `@` → IP GitHub Pages
- [ ] Thêm CNAME cho `www` → `username.github.io`
- [ ] Không dùng URL Forwarding/Masking
- [ ] Đợi DNS propagate (kiểm tra với `nslookup`)

### Cấu hình GitHub:

- [ ] Tạo workflow `.github/workflows/pages.yml`
- [ ] Vào Settings → Pages
- [ ] Chọn Source: "GitHub Actions"
- [ ] Nhập Custom domain: `stepdevcode.tech`
- [ ] Bật "Enforce HTTPS"

### Sau khi deploy:

- [ ] Kiểm tra workflow chạy thành công
- [ ] Kiểm tra website tại custom domain
- [ ] Kiểm tra HTTPS hoạt động
- [ ] Test các trang chính

---

## 🔍 Debug Tips

### Nếu workflow fail:

1. Xem log từng bước trong GitHub Actions
2. Kiểm tra bước nào bị lỗi
3. Test bước đó local nếu có thể
4. Kiểm tra environment variables

### Nếu website không load:

1. Kiểm tra DNS: `nslookup stepdevcode.tech`
2. Kiểm tra GitHub Pages Settings
3. Kiểm tra workflow đã deploy thành công chưa
4. Đợi vài phút để DNS/Pages cập nhật

### Nếu build fail:

1. Test build local: `npm run build:static`
2. Kiểm tra `next.config.js` có đúng không
3. Kiểm tra dependencies có conflict không
4. Xem log chi tiết trong workflow

---

## 📚 Tài liệu tham khảo

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [DNS Configuration for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

## 📝 Ghi chú

- Ngày tạo: 2025-12-08
- Ngày cập nhật cuối: 2025-12-08
- Repository: `KayHuynhLibra/stepdevcodetech`
- Domain: `stepdevcode.tech`
- Framework: Next.js 16.0.7 + React 19.2.1 + TypeScript 5.7.2

## 📊 Timeline Upgrade

- **2025-12-08**: Bắt đầu dự án với Next.js 14
- **2025-12-08**: Setup GitHub Pages deployment
- **2025-12-08**: Fix các lỗi DNS và workflow
- **2025-12-08**: Upgrade Next.js 14 → 15.5.7 + React 19
- **2025-12-08**: Fix ESLint errors (unescaped entities)
- **2025-12-08**: Upgrade Next.js 15 → 16.0.7 với Turbopack

## 📦 Dependencies Timeline

### Ban đầu (Next.js 14):
- next: ^14.0.4
- react: ^18.2.0
- react-dom: ^18.2.0

### Sau upgrade (Next.js 16):
- next: ^16.0.7
- react: ^19.2.1
- react-dom: ^19.2.1
- eslint-config-next: ^16.0.7
- typescript: ^5.7.2

---

**Lưu ý**: Tài liệu này được tạo để học hỏi và tham khảo. Các lỗi và cách khắc phục có thể khác nhau tùy vào môi trường và version của tools.

**Version History**:
- v1.0: Initial documentation với Next.js 14
- v2.0: Updated với Next.js 15 và React 19
- v3.0: Updated với Next.js 16 và Turbopack

