# Changelog

## [1.1.0] - 2025-12-08

### 🧭 Mobile UX & Navigation
- Added mobile menu (hamburger) with slide-down links in `Navbar.tsx`
- Adjusted padding/spacing for mobile across main pages
- Ensured buttons/links have larger hit areas on small screens

### 🌐 Static Generation for Habit
- Habit routes now pre-rendered (layouts with `generateStaticParams`)
- GitHub Pages friendly: brand/deck pages exported as static HTML

### 📚 Docs
- Added `WEBSITE_STRUCTURE.md` (routing & hierarchy overview)
- Updated troubleshooting with habit static generation notes

---

## [1.0.0] - 2024-12-19

### ✨ Features

#### Core Setup
- ✅ Next.js 14 với App Router
- ✅ TypeScript configuration
- ✅ Tailwind CSS với custom animations
- ✅ Framer Motion cho smooth animations
- ✅ ESLint configuration

#### Components
- ✅ **Starfield Background**: Canvas animation với 200 ngôi sao lấp lánh
- ✅ **Shooting Stars**: Hiệu ứng sao băng di chuyển chéo với gradient
- ✅ **Glassmorphism Navbar**: Navigation bar với backdrop blur effect
- ✅ **Hero Section**: Animated title, role rotation, CTA buttons
- ✅ **About Section**: Skills display với animations
- ✅ **Projects Section**: Grid layout với hover effects
- ✅ **Contact Form**: Form với validation và success/error states

#### Styling
- ✅ Custom scrollbar
- ✅ Glassmorphism utilities
- ✅ Gradient text effects
- ✅ Responsive design cho mọi thiết bị
- ✅ Dark theme với starry background

#### Optimization
- ✅ Performance optimized animations
- ✅ Proper cleanup trong useEffect hooks
- ✅ Smooth scroll navigation
- ✅ Active section detection

#### Documentation
- ✅ Comprehensive README.md
- ✅ Git setup guide (GIT_SETUP.md)
- ✅ LICENSE file (MIT)
- ✅ .editorconfig cho code consistency
- ✅ .gitattributes cho line endings

### 🎨 Design Features

- **Starfield**: 200 animated stars với twinkling effect
- **Shooting Stars**: Dynamic meteors với random paths
- **Glassmorphism**: Modern glass effect trên navbar và cards
- **Gradients**: Beautiful color transitions
- **Animations**: Smooth entrance và hover effects

### 📦 Dependencies

- next: ^14.0.4
- react: ^18.2.0
- react-dom: ^18.2.0
- framer-motion: ^10.16.16
- tailwindcss: ^3.4.0
- typescript: ^5.3.3

### 🚀 Ready for Production

- ✅ All components optimized
- ✅ No linter errors
- ✅ TypeScript strict mode
- ✅ Git configuration ready
- ✅ Deployment ready (Vercel compatible)

