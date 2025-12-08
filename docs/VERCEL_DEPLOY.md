# Hướng dẫn Deploy lên Vercel với Custom Domain

## 🚀 Deploy lên Vercel (Khuyến nghị cho Next.js)

### Bước 1: Đăng ký Vercel
1. Truy cập [vercel.com](https://vercel.com)
2. Đăng nhập bằng GitHub account
3. Authorize Vercel để truy cập repositories

### Bước 2: Import Project
1. Click **"Add New Project"**
2. Chọn repository `stepdevcodetech`
3. Vercel sẽ tự động detect Next.js
4. Click **"Deploy"**

### Bước 3: Cấu hình Custom Domain `stepdevcode.tech`

1. Sau khi deploy xong, vào **Project Settings** → **Domains**
2. Thêm domain: `stepdevcode.tech` và `www.stepdevcode.tech`
3. Vercel sẽ hiển thị DNS records cần cấu hình

### Bước 4: Cấu hình DNS

Vào nhà cung cấp domain của bạn (GoDaddy, Namecheap, Cloudflare, etc.) và thêm các records sau:

#### Nếu dùng A Records:
```
Type: A
Name: @
Value: 76.76.21.21

Type: A
Name: @
Value: 76.223.126.88

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

#### Hoặc nếu dùng CNAME (Khuyến nghị):
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**Lưu ý:** Một số nhà cung cấp không cho phép CNAME ở root domain (@), trong trường hợp đó dùng A records.

### Bước 5: Chờ DNS Propagation
- DNS có thể mất 24-48 giờ để propagate
- Kiểm tra bằng: `nslookup stepdevcode.tech` hoặc [whatsmydns.net](https://www.whatsmydns.net)

### Bước 6: SSL Certificate
- Vercel tự động cấp SSL certificate (Let's Encrypt)
- HTTPS sẽ tự động enable sau khi DNS đã propagate

## ✅ Kiểm tra

Sau khi DNS đã propagate:
- `https://stepdevcode.tech` sẽ hoạt động
- `https://www.stepdevcode.tech` sẽ redirect về domain chính
- SSL certificate sẽ tự động được cấp

## 🔄 Auto Deploy

Vercel tự động deploy mỗi khi bạn push code lên GitHub:
- Push lên `main` branch → Production deploy
- Tạo Pull Request → Preview deploy

## 📝 Lưu ý

- **GitHub Pages không hỗ trợ Next.js**: GitHub Pages chỉ hỗ trợ static sites, không hỗ trợ server-side rendering của Next.js
- **Vercel là lựa chọn tốt nhất** cho Next.js vì:
  - Hỗ trợ đầy đủ Next.js features
  - Auto SSL
  - CDN global
  - Preview deployments
  - Free tier rộng rãi

