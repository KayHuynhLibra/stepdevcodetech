# Cấu trúc Dự án

## 📁 Tổng quan

```
stepdevcodetech/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (Portfolio)
│   ├── globals.css        # Global styles
│   └── habit/             # Tarot Research Pages
│       ├── page.tsx       # Danh sách các hãng
│       └── [brandId]/     # Dynamic route: Hãng bộ bài
│           ├── page.tsx   # Các bộ bài của hãng
│           └── [deckId]/  # Dynamic route: Bộ bài
│               └── page.tsx # Danh sách lá bài
│
├── components/            # React Components
│   ├── Starfield.tsx     # Starfield background
│   ├── ShootingStars.tsx # Shooting stars animation
│   ├── Navbar.tsx        # Navigation bar
│   ├── Hero.tsx          # Hero section
│   ├── About.tsx         # About section
│   ├── Projects.tsx      # Projects section
│   ├── Contact.tsx       # Contact form
│   └── TarotCardForm.tsx # Form thêm lá bài
│
├── docs/                 # Documentation
│   ├── CHANGELOG.md
│   ├── GIT_SETUP.md
│   ├── VERCEL_DEPLOY.md
│   └── DEPLOYMENT_OPTIONS.md
│
└── Config Files (Root)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── .eslintrc.json
    ├── .gitignore
    ├── .gitattributes
    ├── .editorconfig
    ├── netlify.toml
    ├── README.md
    └── LICENSE
```

## 🗂️ Chi tiết từng phần

### `/app` - Next.js Pages
- **layout.tsx**: Root layout với metadata
- **page.tsx**: Trang chủ Portfolio
- **habit/**: Module nghiên cứu Tarot
  - **page.tsx**: Danh sách 5 hãng bộ bài
  - **[brandId]/page.tsx**: Các bộ bài (Major Arcana, Cups, Wands, Swords, Pentacles)
  - **[brandId]/[deckId]/page.tsx**: Danh sách lá bài trong bộ

### `/components` - React Components
- **Starfield.tsx**: Canvas animation với 200 sao
- **ShootingStars.tsx**: Animation sao băng
- **Navbar.tsx**: Navigation với glassmorphism
- **Hero.tsx**: Hero section với role rotation
- **About.tsx**: About section với skills
- **Projects.tsx**: Projects grid
- **Contact.tsx**: Contact form với validation
- **TarotCardForm.tsx**: Form thêm/sửa lá bài

### `/docs` - Documentation
- **CHANGELOG.md**: Lịch sử thay đổi
- **GIT_SETUP.md**: Hướng dẫn Git
- **VERCEL_DEPLOY.md**: Hướng dẫn deploy Vercel
- **DEPLOYMENT_OPTIONS.md**: Các cách deploy khác

## 🔗 Routing Structure

```
/                              → Portfolio Home
/habit                          → Danh sách hãng
/habit/rider-waite              → Bộ bài Rider-Waite
/habit/rider-waite/major-arcana → Lá bài Major Arcana
/habit/rider-waite/cups         → Lá bài Cups
... (tương tự cho các hãng khác)
```

## 📦 Dependencies

- **next**: ^14.0.4
- **react**: ^18.2.0
- **react-dom**: ^18.2.0
- **framer-motion**: ^10.16.16
- **tailwindcss**: ^3.4.0
- **typescript**: ^5.3.3

