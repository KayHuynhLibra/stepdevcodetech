# Changelog

## [1.3.0] - 2025-12-08

### 📱 Enhanced Mobile & Desktop Responsiveness
- ✅ Improved typography scaling: `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` cho headings
- ✅ Enhanced modal responsiveness: better padding và spacing trên mobile (`p-4 sm:p-6 md:p-8`)
- ✅ Optimized search bar: responsive text size và padding
- ✅ Improved card grids: better spacing và min-height cho mobile cards
- ✅ Enhanced buttons: `min-h-[44px]` cho touch targets (Apple/Google guidelines)
- ✅ Better form responsiveness: Contact form với responsive padding
- ✅ Improved Quick Links: `flex-col sm:flex-row` layout
- ✅ Enhanced back buttons: responsive text size và padding
- ✅ Better modal close button: larger touch target (`w-10 h-10 sm:w-12 sm:h-12`)
- ✅ Improved card detail modal: responsive text sizes và spacing

### 🎨 UI/UX Improvements
- ✅ Consistent responsive breakpoints across all pages
- ✅ Better spacing system: `px-4 sm:px-6 lg:px-8`
- ✅ Improved readability trên mobile với text size adjustments
- ✅ Better visual hierarchy với responsive typography

---

## [1.2.0] - 2025-12-08

### 🔧 Navigation Fixes
- ✅ Fixed Navbar syntax errors (removed extra closing brace)
- ✅ Converted all `<a>` tags to Next.js `<Link>` components để tránh full page reload
- ✅ Fixed "Get in Touch" button để link đến `/static#contact` thay vì `#contact`
- ✅ Improved back buttons trong habit pages với Link wrapper
- ✅ Fixed active state detection trong Navbar sử dụng `usePathname()` hook
- ✅ All navigation links now use client-side routing (smooth transitions)

### 📱 Mobile UX Improvements
- ✅ Added hamburger menu cho mobile devices
- ✅ Improved responsive spacing và typography
- ✅ Better touch targets cho mobile buttons

### 🌐 Static Generation for Habit
- ✅ Habit routes now pre-rendered (layouts with `generateStaticParams`)
- ✅ GitHub Pages friendly: brand/deck pages exported as static HTML
- ✅ 36 static pages generated successfully

### 📚 Documentation
- ✅ Added comprehensive website structure documentation (WEBSITE_STRUCTURE.md)
- ✅ Updated BUILD_TROUBLESHOOTING.md với habit static generation solution

---

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

