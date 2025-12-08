# Cấu trúc Website - StepDevCode.Tech

Tài liệu này mô tả chi tiết cấu trúc website từ tổng quan đến các phần nhỏ nhất, bao gồm navigation hierarchy và user flow.

## 📋 Mục lục

1. [Tổng quan Website](#tổng-quan-website)
2. [Cấu trúc Navigation](#cấu-trúc-navigation)
3. [Routing Hierarchy](#routing-hierarchy)
4. [Chi tiết từng Module](#chi-tiết-từng-module)
5. [User Flow và Navigation Path](#user-flow-và-navigation-path)
6. [Component Structure](#component-structure)
7. [Data Flow](#data-flow)

---

## 🌐 Tổng quan Website

Website StepDevCode.Tech được chia thành **2 nhóm chính**:

### 1. **Portfolio Section** (Static/Dynamic)
- Trang chủ với portfolio
- Static portfolio page
- Các sections: Hero, About, Projects, Contact

### 2. **Habit Section** (Tarot Research - Multi-level Navigation)
- Danh sách các hãng bộ bài Tarot
- Các bộ bài của từng hãng
- Danh sách lá bài trong mỗi bộ
- Chi tiết từng lá bài

---

## 🗺️ Cấu trúc Navigation

### Navigation Bar (Top Level)

```
┌─────────────────────────────────────────┐
│  Portfolio  │  Home  │  Static  │  Habit │
└─────────────────────────────────────────┘
```

**Navbar Items**:
- **Home** (`/`) - Trang chủ với links
- **Static** (`/static`) - Portfolio tĩnh
- **Habit** (`/habit`) - Tarot Research (entry point)

---

## 📍 Routing Hierarchy

### Level 0: Root Pages

```
/
├── / (Home Page)
├── /static (Static Portfolio)
├── /simple (Simple Test Page)
└── /habit (Tarot Research Entry)
```

### Level 1: Habit - Brand Selection

```
/habit
│
├── Click Brand Card
│
└── Navigate to: /habit/[brandId]
```

**Available Brands** (5 brands):
- `/habit/rider-waite`
- `/habit/thoth`
- `/habit/marseille`
- `/habit/wild-unknown`
- `/habit/everyday-witch`

### Level 2: Habit - Deck Selection

```
/habit/[brandId]
│
├── Click Deck Card
│
└── Navigate to: /habit/[brandId]/[deckId]
```

**Available Decks** (5 decks per brand):
- `major-arcana` - Bộ Ẩn Chính (22 lá)
- `cups` - Bộ Cốc (14 lá)
- `wands` - Bộ Gậy (14 lá)
- `swords` - Bộ Kiếm (14 lá)
- `pentacles` - Bộ Tiền (14 lá)

**Total**: 5 brands × 5 decks = **25 deck routes**

### Level 3: Habit - Card List

```
/habit/[brandId]/[deckId]
│
├── Display Cards List
├── Search/Filter Cards
├── Click Card → Show Details (Modal)
└── Add New Card Button
```

**Example Routes**:
- `/habit/rider-waite/major-arcana` - Lá bài Major Arcana của Rider-Waite
- `/habit/rider-waite/cups` - Lá bài Cups của Rider-Waite
- `/habit/thoth/major-arcana` - Lá bài Major Arcana của Thoth
- ... (25 total routes)

---

## 🎯 Chi tiết từng Module

### Module 1: Home Page (`/`)

**File**: `app/page.tsx`

**Cấu trúc**:
```
Home Page
├── Starfield Background
├── Shooting Stars Animation
├── Navbar
└── Content
    ├── Welcome Message
    ├── Static Portfolio Card (Link to /static)
    ├── Dynamic Features Card (Link to /habit)
    └── Quick Links (if server running)
```

**Tính năng**:
- Kiểm tra server status (`/api/health`)
- Hiển thị message khác nhau cho static/dynamic build
- Links đến các sections khác

**Navigation**:
- Click "Static Portfolio" → `/static`
- Click "Dynamic Features" → `/habit`
- Click "Habit - Tarot Research" → `/habit`

---

### Module 2: Static Portfolio (`/static`)

**File**: `app/static/page.tsx`

**Cấu trúc**:
```
Static Portfolio Page
├── Starfield Background
├── Shooting Stars Animation
├── Navbar
└── Sections
    ├── Hero Section
    ├── About Section
    ├── Projects Section
    └── Contact Section
```

**Tính năng**:
- Portfolio hoàn chỉnh
- Tất cả animations hoạt động
- Không cần server (static export)

**Components Used**:
- `Hero.tsx`
- `About.tsx`
- `Projects.tsx`
- `Contact.tsx`

---

### Module 3: Habit - Brand List (`/habit`)

**File**: `app/habit/page.tsx`

**Cấu trúc**:
```
Habit Entry Page
├── Starfield Background
├── Shooting Stars Animation
├── Navbar
└── Content
    ├── Title: "Habit - Tarot Research"
    ├── Description
    └── Brands Grid (5 brands)
        ├── Rider-Waite Card
        ├── Thoth Card
        ├── Marseille Card
        ├── Wild Unknown Card
        └── Everyday Witch Card
```

**Brand Data Structure**:
```typescript
{
  id: 'rider-waite',
  name: 'Rider-Waite',
  nameVi: 'Rider-Waite Tarot',
  description: 'Bộ bài Tarot cổ điển...'
}
```

**User Action**:
- Click vào brand card → Navigate to `/habit/[brandId]`

**Navigation Flow**:
```
/habit → Click Brand → /habit/rider-waite
```

---

### Module 4: Habit - Deck List (`/habit/[brandId]`)

**File**: `app/habit/[brandId]/page.tsx`  
**Layout**: `app/habit/[brandId]/layout.tsx` (generates static params)

**Cấu trúc**:
```
Brand Detail Page
├── Starfield Background
├── Shooting Stars Animation
├── Navbar
└── Content
    ├── Back Button (→ /habit)
    ├── Brand Title
    ├── Brand Description
    └── Decks Grid (5 decks)
        ├── Major Arcana Card
        ├── Cups Card
        ├── Wands Card
        ├── Swords Card
        └── Pentacles Card
```

**Deck Data Structure**:
```typescript
{
  id: 'major-arcana',
  name: 'Major Arcana',
  nameVi: 'Bộ Ẩn Chính',
  description: '22 lá bài đại diện...',
  cardCount: 22
}
```

**User Action**:
- Click "← Quay lại" → Navigate to `/habit`
- Click vào deck card → Navigate to `/habit/[brandId]/[deckId]`

**Navigation Flow**:
```
/habit/rider-waite → Click Deck → /habit/rider-waite/major-arcana
```

**Breadcrumb**:
```
Habit → Rider-Waite → Major Arcana
```

---

### Module 5: Habit - Card List (`/habit/[brandId]/[deckId]`)

**File**: `app/habit/[brandId]/[deckId]/page.tsx`  
**Layout**: `app/habit/[brandId]/[deckId]/layout.tsx` (generates static params)

**Cấu trúc**:
```
Deck Detail Page
├── Starfield Background
├── Shooting Stars Animation
├── Navbar
└── Content
    ├── Back Button (→ /habit/[brandId])
    ├── Deck Title + Brand Name
    ├── Search Bar
    ├── Add Card Button
    └── Cards Grid
        ├── Card 1 (Click → Show Modal)
        ├── Card 2 (Click → Show Modal)
        ├── Card 3 (Click → Show Modal)
        └── ... (more cards)
```

**Card Data Structure**:
```typescript
{
  id: 1,
  name: 'The Fool',
  number: '0',
  suit: 'Major Arcana',
  meaning: 'New Beginnings, Innocence...',
  upright: ['New beginnings', 'Innocence', ...],
  reversed: ['Recklessness', ...],
  description: 'The Fool represents...',
  image?: string
}
```

**Tính năng**:
- **Search/Filter**: Tìm kiếm lá bài theo tên hoặc meaning
- **Card Modal**: Click card để xem chi tiết
- **Add Card**: Thêm lá bài mới (client-side only)
- **Back Navigation**: Quay lại brand page

**User Actions**:
- Click "← Quay lại" → Navigate to `/habit/[brandId]`
- Type in search → Filter cards
- Click card → Show modal với chi tiết
- Click "Thêm lá bài" → Show form

**Navigation Flow**:
```
/habit/rider-waite/major-arcana
  ├── Click Back → /habit/rider-waite
  ├── Click Card → Show Modal (no navigation)
  └── Click Add → Show Form (no navigation)
```

**Breadcrumb**:
```
Habit → Rider-Waite → Major Arcana → [Card Name]
```

---

## 🔄 User Flow và Navigation Path

### Flow 1: Xem Portfolio

```
User lands on /
  ↓
Click "Static Portfolio"
  ↓
Navigate to /static
  ↓
View Portfolio Sections
  ├── Hero
  ├── About
  ├── Projects
  └── Contact
```

### Flow 2: Explore Tarot Cards (3 Levels Deep)

```
Level 0: Entry Point
  User lands on /habit
  ↓
  See 5 brand cards
  ↓
Level 1: Brand Selection
  Click "Rider-Waite" card
  ↓
  Navigate to /habit/rider-waite
  ↓
  See 5 deck cards
  ↓
Level 2: Deck Selection
  Click "Major Arcana" card
  ↓
  Navigate to /habit/rider-waite/major-arcana
  ↓
  See list of cards
  ↓
Level 3: Card Details
  Click a card
  ↓
  Show modal with card details
  (No navigation, modal overlay)
```

### Flow 3: Navigation Backwards

```
/habit/rider-waite/major-arcana
  ↓ Click "← Quay lại"
/habit/rider-waite
  ↓ Click "← Quay lại"
/habit
  ↓ Click Navbar "Home"
/
```

---

## 🧩 Component Structure

### Shared Components (Used Everywhere)

```
components/
├── Starfield.tsx          # Background animation (all pages)
├── ShootingStars.tsx      # Shooting stars effect (all pages)
└── Navbar.tsx             # Navigation bar (all pages)
```

### Portfolio Components

```
components/
├── Hero.tsx               # Hero section (used in /static)
├── About.tsx              # About section (used in /static)
├── Projects.tsx           # Projects grid (used in /static)
└── Contact.tsx            # Contact form (used in /static)
```

### Habit Components

```
components/
└── TarotCardForm.tsx      # Form to add/edit cards (used in deck detail page)
```

### Page Components

```
app/
├── page.tsx               # Home page component
├── static/
│   └── page.tsx           # Static portfolio component
└── habit/
    ├── page.tsx           # Brand list component
    ├── [brandId]/
    │   ├── layout.tsx     # Static params generator
    │   └── page.tsx       # Deck list component
    └── [brandId]/[deckId]/
        ├── layout.tsx     # Static params generator
        └── page.tsx       # Card list component
```

---

## 📊 Data Flow

### Static Data (Hardcoded)

**Brands** (`app/habit/page.tsx`):
```typescript
const tarotBrands = [
  { id: 'rider-waite', name: 'Rider-Waite', ... },
  { id: 'thoth', name: 'Thoth', ... },
  // ... 5 brands total
];
```

**Decks** (`app/habit/[brandId]/page.tsx`):
```typescript
const tarotDecks = [
  { id: 'major-arcana', name: 'Major Arcana', ... },
  { id: 'cups', name: 'Cups', ... },
  // ... 5 decks total
];
```

**Cards** (`app/habit/[brandId]/[deckId]/page.tsx`):
```typescript
const deckCards = {
  'major-arcana': [
    { id: 1, name: 'The Fool', ... },
    { id: 2, name: 'The Magician', ... },
    // ... more cards
  ],
  'cups': [
    { id: 101, name: 'Ace of Cups', ... },
    // ... more cards
  ],
  // ... other decks
};
```

### Dynamic Data (Client-side State)

**Card Management**:
- Cards được lưu trong `useState` (client-side only)
- Có thể thêm card mới qua form
- Search/filter hoạt động trên client-side
- **Lưu ý**: Dữ liệu không persist sau khi reload (chỉ trong session)

---

## 🗂️ File Structure Detail

### App Router Structure

```
app/
├── layout.tsx                    # Root layout (metadata)
├── page.tsx                      # Home page (/)
├── globals.css                   # Global styles
│
├── static/
│   └── page.tsx                  # Static portfolio (/static)
│
├── simple/
│   └── page.tsx                  # Simple test page (/simple)
│
├── api/
│   └── health/
│       └── route.ts              # Health check API (/api/health)
│
└── habit/                        # Tarot Research Module
    ├── page.tsx                  # Brand list (/habit)
    │
    └── [brandId]/                # Dynamic: Brand routes
        ├── layout.tsx            # Generate static params for brands
        ├── page.tsx              # Deck list (/habit/[brandId])
        │
        └── [deckId]/             # Dynamic: Deck routes
            ├── layout.tsx        # Generate static params for decks
            └── page.tsx          # Card list (/habit/[brandId]/[deckId])
```

### Component Structure

```
components/
├── Starfield.tsx                 # Canvas starfield animation
├── ShootingStars.tsx             # Shooting stars animation
├── Navbar.tsx                    # Navigation bar
│
├── Hero.tsx                      # Hero section
├── About.tsx                     # About section
├── Projects.tsx                  # Projects grid
├── Contact.tsx                   # Contact form
│
└── TarotCardForm.tsx             # Tarot card add/edit form
```

---

## 🎨 Visual Hierarchy

### Page Layout (All Pages)

```
┌─────────────────────────────────────┐
│         Navbar (Fixed Top)          │
├─────────────────────────────────────┤
│                                     │
│    Starfield Background             │
│    Shooting Stars Animation         │
│                                     │
│    ┌─────────────────────────┐     │
│    │                         │     │
│    │    Page Content         │     │
│    │                         │     │
│    └─────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

### Habit Module - Visual Flow

```
┌─────────────────────────────────────────────┐
│  Level 0: Brand Selection                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Brand1│ │Brand2│ │Brand3│ │Brand4│ ...  │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
└─────────────────────────────────────────────┘
              ↓ Click Brand
┌─────────────────────────────────────────────┐
│  Level 1: Deck Selection                    │
│  ← Back to Brands                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Deck1 │ │Deck2 │ │Deck3 │ │Deck4 │ ...  │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
└─────────────────────────────────────────────┘
              ↓ Click Deck
┌─────────────────────────────────────────────┐
│  Level 2: Card List                         │
│  ← Back to Decks                            │
│  [Search Bar] [+ Add Card]                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Card1 │ │Card2 │ │Card3 │ │Card4 │ ...  │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
└─────────────────────────────────────────────┘
              ↓ Click Card
┌─────────────────────────────────────────────┐
│  Level 3: Card Details (Modal)              │
│  ┌─────────────────────────────────────┐    │
│  │  Card Name                          │    │
│  │  Meaning                            │    │
│  │  Upright: [...]                    │    │
│  │  Reversed: [...]                   │    │
│  │  Description                       │    │
│  │  [Close]                           │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## 🔗 URL Examples

### Complete URL Structure

```
Root:
  https://stepdevcode.tech/

Portfolio:
  https://stepdevcode.tech/static

Habit Entry:
  https://stepdevcode.tech/habit

Brand Level (5 routes):
  https://stepdevcode.tech/habit/rider-waite
  https://stepdevcode.tech/habit/thoth
  https://stepdevcode.tech/habit/marseille
  https://stepdevcode.tech/habit/wild-unknown
  https://stepdevcode.tech/habit/everyday-witch

Deck Level (25 routes):
  https://stepdevcode.tech/habit/rider-waite/major-arcana
  https://stepdevcode.tech/habit/rider-waite/cups
  https://stepdevcode.tech/habit/rider-waite/wands
  https://stepdevcode.tech/habit/rider-waite/swords
  https://stepdevcode.tech/habit/rider-waite/pentacles
  
  https://stepdevcode.tech/habit/thoth/major-arcana
  https://stepdevcode.tech/habit/thoth/cups
  ... (20 more routes)
```

**Total Routes**: 1 (habit) + 5 (brands) + 25 (decks) = **31 habit routes**

---

## 📱 Responsive Design

### Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Layout Changes

**Brand/Deck Cards Grid**:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

**Card List Grid**:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3-4 columns

---

## 🎯 Key Features

### Navigation Features

1. **Breadcrumb Navigation**:
   - Back buttons trên mỗi level
   - Navbar links
   - Smooth transitions

2. **Search/Filter**:
   - Search cards by name
   - Search cards by meaning
   - Real-time filtering

3. **Modal Details**:
   - Click card → Show modal
   - No page navigation
   - Overlay background

### Animation Features

- **Page Transitions**: Framer Motion animations
- **Hover Effects**: Scale và color transitions
- **Loading States**: Smooth fade-in animations
- **Background**: Starfield và shooting stars (all pages)

---

## 🔧 Technical Details

### Static Generation

**Layout Files**:
- `app/habit/[brandId]/layout.tsx` - Generates 5 brand routes
- `app/habit/[brandId]/[deckId]/layout.tsx` - Generates 25 deck routes

**Result**: All 31 habit routes are pre-rendered as static HTML

### Client-Side Features

- Card search/filter (client-side)
- Add new card (client-side state)
- Modal display (no server needed)
- Smooth navigation (Next.js router)

---

## 📝 Summary

### Website Structure Overview

```
StepDevCode.Tech
│
├── Portfolio Section (Static)
│   ├── Home (/)
│   └── Static Portfolio (/static)
│
└── Habit Section (Multi-level Navigation)
    ├── Level 0: Brand List (/habit)
    ├── Level 1: Deck List (/habit/[brandId])
    └── Level 2: Card List (/habit/[brandId]/[deckId])
        └── Level 3: Card Details (Modal)
```

### Navigation Depth

- **Shallow**: Portfolio pages (1 level)
- **Deep**: Habit module (3-4 levels with modal)

### Total Pages

- **Static Pages**: 3 (/, /static, /simple)
- **Habit Pages**: 31 (1 entry + 5 brands + 25 decks)
- **Total**: 34 pages

---

**Last Updated**: 2025-12-08  
**Next.js Version**: 16.0.7  
**React Version**: 19.2.1

