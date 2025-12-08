# Các cách Deploy Website Next.js (Không cần Vercel)

## 🚀 Các Platform miễn phí để Deploy Next.js

### 1. **Netlify** (Khuyến nghị - Dễ nhất)
- **URL**: [netlify.com](https://netlify.com)
- **Free tier**: Rất rộng rãi
- **Cách deploy**:
  1. Đăng ký bằng GitHub
  2. Click "Add new site" → "Import an existing project"
  3. Chọn repository từ GitHub
  4. Build settings tự động detect Next.js
  5. Deploy!

**Lưu ý**: Cần thêm file `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 2. **Railway**
- **URL**: [railway.app](https://railway.app)
- **Free tier**: $5 credit/tháng
- **Cách deploy**:
  1. Đăng ký bằng GitHub
  2. "New Project" → "Deploy from GitHub repo"
  3. Chọn repository
  4. Tự động detect và deploy

### 3. **Render**
- **URL**: [render.com](https://render.com)
- **Free tier**: Có (có thể sleep sau 15 phút không dùng)
- **Cách deploy**:
  1. Đăng ký
  2. "New" → "Web Service"
  3. Connect GitHub repo
  4. Build command: `npm run build`
  5. Start command: `npm start`

### 4. **Cloudflare Pages**
- **URL**: [pages.cloudflare.com](https://pages.cloudflare.com)
- **Free tier**: Unlimited
- **Cách deploy**:
  1. Đăng ký
  2. "Create a project" → "Connect to Git"
  3. Chọn GitHub repo
  4. Framework preset: Next.js
  5. Deploy!

### 5. **GitHub Pages** (Chỉ static export)
⚠️ **Lưu ý**: GitHub Pages chỉ hỗ trợ static sites. Cần export Next.js thành static:

```bash
# Thêm vào next.config.js
module.exports = {
  output: 'export',
  images: {
    unoptimized: true
  }
}
```

Sau đó build và push folder `out/` lên GitHub Pages.

## 💻 Chạy Local (Development)

### Cách 1: Development Server
```bash
cd stepdevcodetech
npm install
npm run dev
```
Truy cập: http://localhost:3000

### Cách 2: Production Build Local
```bash
cd stepdevcodetech
npm install
npm run build
npm start
```
Truy cập: http://localhost:3000

## 🖥️ Self-Hosted (VPS/Server riêng)

### Sử dụng PM2 (Process Manager)
```bash
# Cài đặt PM2
npm install -g pm2

# Build project
npm run build

# Chạy với PM2
pm2 start npm --name "portfolio" -- start

# Tự động restart khi server reboot
pm2 startup
pm2 save
```

### Sử dụng Docker
Tạo file `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build và chạy:
```bash
docker build -t portfolio .
docker run -p 3000:3000 portfolio
```

### Sử dụng Nginx làm Reverse Proxy
Cấu hình Nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 So sánh các Platform

| Platform | Free Tier | Custom Domain | SSL | Auto Deploy | Sleep |
|----------|----------|---------------|-----|-------------|-------|
| **Vercel** | ✅ Tốt | ✅ | ✅ | ✅ | ❌ |
| **Netlify** | ✅ Tốt | ✅ | ✅ | ✅ | ❌ |
| **Railway** | $5 credit | ✅ | ✅ | ✅ | ❌ |
| **Render** | ✅ | ✅ | ✅ | ✅ | ⚠️ Có |
| **Cloudflare Pages** | ✅ Unlimited | ✅ | ✅ | ✅ | ❌ |
| **GitHub Pages** | ✅ | ✅ | ✅ | ✅ | ❌ (Static only) |

## 🎯 Khuyến nghị

1. **Cho người mới**: **Netlify** hoặc **Cloudflare Pages** - dễ nhất
2. **Cho production**: **Vercel** hoặc **Netlify** - performance tốt nhất
3. **Cho custom domain**: Tất cả đều hỗ trợ
4. **Cho self-hosted**: VPS + PM2 hoặc Docker

## 📝 Lưu ý

- Tất cả các platform trên đều hỗ trợ Next.js đầy đủ
- Custom domain đều được hỗ trợ miễn phí
- SSL certificate tự động được cấp
- Auto deploy khi push code lên GitHub

