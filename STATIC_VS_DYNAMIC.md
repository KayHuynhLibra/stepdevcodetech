# Static vs Dynamic Pages

## 📄 Static Pages (Không cần server)

### `/static` - Static Portfolio
- **URL**: `/static` hoặc `/static.html`
- **Tính năng**: Portfolio tĩnh với tất cả animations
- **Yêu cầu**: Không cần server, có thể export static
- **Sử dụng**: 
  - Xem portfolio offline
  - Deploy lên GitHub Pages
  - Host static files

### Cách sử dụng Static:
```bash
# Build static
npm run build:static

# Output sẽ ở folder `out/`
# Có thể deploy folder `out/` lên bất kỳ static host nào
```

## ⚡ Dynamic Pages (Cần server)

### `/` - Home Page
- **URL**: `/`
- **Tính năng**: Trang chủ với links đến static và dynamic features
- **Yêu cầu**: Cần chạy `npm run dev`

### `/habit` - Tarot Research
- **URL**: `/habit`, `/habit/[brandId]`, `/habit/[brandId]/[deckId]`
- **Tính năng**: 
  - Danh sách các hãng bộ bài
  - Các bộ bài của từng hãng
  - Danh sách lá bài
  - Thêm/sửa lá bài
- **Yêu cầu**: Cần chạy `npm run dev`

### Cách sử dụng Dynamic:
```bash
# Chạy development server
npm run dev

# Truy cập http://localhost:3000
```

## 🎯 Tóm tắt

| Page | Type | Cần Server | Export Static |
|------|------|------------|---------------|
| `/static` | Static | ❌ | ✅ |
| `/` | Dynamic | ✅ | ❌ |
| `/habit` | Dynamic | ✅ | ❌ |

## 💡 Lưu ý

- **Static pages** có thể chạy offline, không cần Node.js
- **Dynamic pages** cần Next.js server để chạy
- Có thể build static chỉ cho `/static` page
- Dynamic features chỉ hoạt động khi có server chạy

