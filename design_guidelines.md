# AIR Mira Design Guidelines

## Brand Colors (FIXED - Do Not Change)

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

## Design Philosophy: LUXURY VISUAL QUALITY

**Target Quality Level**: Stripe, Linear, Vercel - world-class landing pages

**Core Principles**:
- **Visual Richness**: Never use plain flat cards. Always add depth through gradients, glassmorphism, shadows, or glow effects
- **Motion & Life**: Every element should have subtle animations, hover effects, micro-interactions
- **Layered Composition**: Use overlapping elements, floating decorations, background meshes
- **Premium Feel**: Every pixel should feel intentional and polished

## Creative Freedom: COMPOSITION PATTERNS

**You are NOT limited to card grids!** Use diverse layouts:

### Hero Sections
- Split layouts with floating elements
- Full-bleed gradients with mesh overlays
- Asymmetric compositions with offset content
- Animated background patterns (grid, dots, noise)
- Floating metrics with glassmorphism

### Content Sections
- Bento grid layouts (varied cell sizes)
- Overlapping cards with depth
- Horizontal scrolling showcases
- Staggered/offset arrangements
- Feature spotlights with large visuals

### Visual Effects (ALWAYS USE)
- `gradient-mesh` - Radial gradient backgrounds with brand colors
- `glass` / `glass-dark` / `glass-primary` - Frosted glass surfaces
- `glow-primary` / `glow-secondary` - Neon glow effects
- `shadow-luxury` / `shadow-floating` - Multi-layer shadows
- `border-gradient` - Gradient border effects
- `text-gradient` - Gradient text headlines
- `noise-overlay` - Subtle texture
- `grid-pattern` / `dot-pattern` - Background patterns

### Hover Effects (ALWAYS INCLUDE)
- `hover-lift` - Card lifts and scales on hover
- `hover-glow` - Glowing border on hover
- `hover-shine` - Light sweep across element
- `hover-border-animate` - Animated underline

### Animations (USE LIBERALLY)
- `animate-float` - Gentle floating motion
- `animate-pulse-glow` - Pulsing glow effect
- `animate-shimmer` - Shimmer loading effect
- `animate-gradient` - Shifting gradient background
- `animate-scale-in` / `animate-slide-up` - Entrance animations
- `blob` + `blob-animate` - Organic morphing shapes

## B2B Context

- **Professional credibility** with premium aesthetics
- **Conversational AI** personality via chat interface
- **Russian Market** localization
- Trust through visual polish, not through blandness

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

**Spacing**: Tailwind units 2, 4, 6, 8, 12, 16, 24
**Grids**: Flexible - use bento, asymmetric, overlapping layouts as appropriate

## HTML Generation Examples

### Luxury Hero with Gradient Mesh
```html
<section class="relative py-24 overflow-hidden">
  <div class="absolute inset-0 gradient-mesh"></div>
  <div class="absolute top-20 right-20 w-64 h-64 blob blob-animate gradient-primary opacity-20"></div>
  <div class="relative z-10 max-w-4xl mx-auto text-center">
    <h1 class="text-5xl font-bold mb-6">
      <span class="text-gradient">Революция</span> в подборе персонала
    </h1>
    <p class="text-xl text-gray-600 mb-8">AI-рекрутер нового поколения</p>
    <button class="gradient-primary text-white px-8 py-4 rounded-xl font-semibold hover-lift glow-primary">
      Начать бесплатно
    </button>
  </div>
</section>
```

### Glassmorphism Feature Cards
```html
<div class="grid grid-cols-3 gap-6">
  <div class="glass rounded-2xl p-8 hover-lift hover-glow animate-slide-up">
    <div class="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6 animate-float">
      <svg>...</svg>
    </div>
    <h3 class="text-xl font-semibold mb-3">Автоматический скрининг</h3>
    <p class="text-gray-600">Mira анализирует резюме за секунды</p>
  </div>
</div>
```

### Floating Metrics with Glow
```html
<div class="flex gap-8 justify-center">
  <div class="glass-dark rounded-2xl p-8 text-center glow-primary animate-pulse-glow hover-lift">
    <div class="text-5xl font-black text-white mb-2">500+</div>
    <div class="text-gray-400 uppercase text-sm tracking-wider">Компаний</div>
  </div>
</div>
```

### Animated Gradient Background Section
```html
<section class="relative py-20 gradient-dark noise-overlay rounded-3xl overflow-hidden">
  <div class="absolute inset-0 grid-pattern opacity-30"></div>
  <div class="relative z-10 text-white text-center">
    <h2 class="text-4xl font-bold mb-4 text-glow">Готовы начать?</h2>
    <button class="border-gradient bg-white/10 backdrop-blur px-8 py-4 rounded-xl text-white font-semibold hover-shine">
      Связаться с нами
    </button>
  </div>
</section>
```

## Key Rules

1. **ALWAYS use visual effects** - never plain flat surfaces
2. **ALWAYS include hover states** - every interactive element animates
3. **ALWAYS add depth** - shadows, glows, or glassmorphism
4. **ALWAYS animate entrances** - staggered fade-ins, slide-ups
5. **Use brand colors creatively** - gradients, glows, meshes from orange/blue/black

## Accessibility

- ARIA labels for dynamic content updates
- Keyboard navigation for interactive elements
- Focus indicators with sufficient contrast
- Minimum touch target: 44x44px for mobile