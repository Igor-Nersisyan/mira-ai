# AIR Mira Design Guidelines

## Brand Colors (from ai-recruiter.ru)

**Primary Palette**:
- **Orange (Primary)**: #FF8B36 - HSL(27, 100%, 60%) - Main CTA, accents, highlights
- **Blue (Secondary)**: #2D8CFF - HSL(211, 100%, 59%) - Supporting accent, links, secondary actions
- **Black (Dark)**: #1A1A1A - HSL(0, 0%, 10%) - Dark backgrounds, text on light
- **White (Light)**: #FFFFFF - HSL(0, 0%, 100%) - Backgrounds, text on dark
- **Text Gray**: #474648 - HSL(270, 1%, 28%) - Primary body text color

**Color Usage**:
- Primary buttons and CTAs: Orange gradient or solid
- Secondary buttons and links: Blue
- Hero sections: Dark overlays with orange/blue accents
- Cards and panels: White with subtle gray borders
- Text hierarchy: Dark gray (primary), medium gray (secondary), light gray (tertiary)

## Design Approach

**Reference-Based Approach** from ai-recruiter.ru:
- **Modern SaaS**: Clean, professional, trust-building
- **Conversational AI**: Approachable chat interface with Mira personality
- **B2B Focus**: Professional credibility with clear value propositions
- **Russian Market**: Localized content and cultural relevance

**Core Principles**:
- Conversational AI personality with professional credibility
- Seamless integration between chat and dynamic content
- Trust-building through clarity and modern aesthetics
- B2B professionalism with approachable interface

## Typography System

**Primary Font**: Manrope (from ai-recruiter.ru branding) via Google Fonts CDN
**Fallback Font**: Inter, system font stack

**Hierarchy**:
- Hero Headlines: text-5xl to text-7xl, font-bold, tracking-tight
- Section Headers: text-3xl to text-4xl, font-semibold
- Chat Messages: text-base, font-normal (AI) / font-medium (user)
- Metrics/Stats: text-6xl, font-black (impact numbers)
- Body Text: text-sm to text-base, leading-relaxed
- UI Labels: text-xs to text-sm, font-medium, uppercase tracking-wide

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Tight spacing: p-2, gap-2 (within components)
- Standard spacing: p-4, p-6, gap-4 (component padding)
- Section spacing: p-8, py-12, gap-8 (major divisions)
- Generous spacing: p-16, py-24 (hero, emphasis areas)

**Grid Structure**:
- Desktop: Two-column layout (30% chat / 70% content) using `grid grid-cols-[30%_1fr]`
- Tablet: Stack vertically with chat collapsible/expandable
- Mobile: Full-width stack (chat top, content below)

**Container Strategy**:
- Chat panel: Fixed width on desktop, full viewport height, contained scrolling
- Content area: max-w-6xl within its 70% column, centered padding
- Dynamic HTML sections: Responsive within content bounds

## Component Library

### Chat Interface

**Chat Container**:
- Full height viewport with sticky header
- Scrollable message area with subtle gradient fade at top/bottom edges
- Fixed input at bottom with subtle elevation
- Message bubbles: rounded-2xl, distinct styling for user vs AI
- User messages: Align right, max-w-sm
- AI messages: Align left, max-w-md, include avatar indicator
- Timestamp: text-xs, subtle, below each message
- Loading indicator: Three animated dots, inline with AI messages

**Input Field**:
- Large, comfortable textarea with auto-expand
- Rounded-xl border with focus state elevation
- Send button integrated inline (arrow icon)
- "Reset Dialog" link subtle and accessible above input

### Dynamic Content Area

**Hero Block (Default State)**:
- Large, impactful headline with key value proposition
- 3-4 metric cards in grid layout (grid-cols-2 lg:grid-cols-3)
- Each metric: Huge number (text-6xl), label below (text-sm uppercase)
- Subtle card elevation with hover lift effect
- Icon or small graphic per metric

**Dynamic Sections** (AI-Generated HTML):
- Pricing tables: Clean, comparison-focused with highlighted recommended tier
- Feature cards: Icon + title + description, grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- ROI calculators: Form inputs with real-time calculation display
- Process diagrams: Horizontal step flow with connecting lines
- FAQ blocks: Accordion-style with smooth expand/collapse

**Transition Behavior**:
- Crossfade transition (300ms) when content updates
- Preserve scroll position awareness
- Loading state: Subtle skeleton shimmer

### Navigation & Header

**Fixed Header** (spans full width above split):
- AIR Mira logo (left)
- Navigation links (center) - About, Features, Pricing, Contact
- CTA button (right) - "Начать работу" or "Демо"
- Sticky on scroll with subtle backdrop blur
- Height: h-16 to h-20

### Buttons & CTAs

**Primary CTA**: 
- Rounded-xl, px-8, py-4, text-lg, font-semibold
- Prominent placement in hero and key conversion points
- Hover: Subtle scale and elevation increase

**Secondary Actions**:
- Outlined style, rounded-lg, px-6, py-3
- Ghost variant for tertiary actions

### Cards & Containers

**Standard Card**:
- rounded-2xl, p-6 to p-8
- Subtle border or light shadow
- Hover: Slight elevation lift (transform + shadow)

**Metric Cards**:
- Centered content, py-8 to py-12
- Large number prominent, description below
- Minimal decoration, focus on clarity

## Visual Elements

**Icons**: 
- Heroicons via CDN (outline for secondary, solid for primary actions)
- Consistent 24px size for interface elements
- 32-48px for feature/metric illustrations

**Illustrations**:
- Abstract AI/tech-themed graphics for hero section
- Simplified, modern style (geometric, gradient-friendly)
- Placement: Background of hero or as accent elements

**Animations**:
- Message appearance: Slide-in-up with fade (200ms)
- Content transitions: Crossfade (300ms)
- Button interactions: Scale(1.02) on hover
- Loading states: Pulse or shimmer effects
- Avoid excessive motion; prioritize clarity

## Images

**Hero Section Background**:
- Abstract gradient mesh or subtle tech-pattern overlay
- Low opacity to maintain text readability
- Alternatively: Clean geometric shapes suggesting AI/automation

**Chat Avatar**:
- Small circular icon representing Mira AI (40px)
- Consistent placement next to AI messages

**Feature Sections**:
- Screenshots of AI in action (recruiting dashboard, analytics)
- Mockups of recruiter workflows
- Team/office photos for trust-building (if applicable)

No large photographic hero image needed - the split-screen with chat IS the hero experience.

## Responsive Behavior

**Desktop (lg+)**: Full split-screen experience
**Tablet (md)**: 
- Chat: Collapsible drawer from left
- Content: Takes full width when chat collapsed
- Toggle button to show/hide chat

**Mobile (base)**:
- Vertical stack: Chat section at top (collapsible to header bar)
- Content scrolls below
- Floating chat toggle button (bottom-right)

## Trust & Credibility Elements

- Social proof badges in hero (e.g., "Доверяют 500+ компаний")
- Client logos section (subtle, professional)
- Security/compliance indicators (GDPR, data protection)
- Real-time stats display (live counter effect)

## Accessibility

- ARIA labels for chat messages and dynamic content updates
- Keyboard navigation for chat and form elements
- Screen reader announcements for new AI messages
- Focus indicators with sufficient contrast
- Minimum touch target: 44x44px for mobile