# AIR Mira - AI Recruiter Chat Application

## Overview

AIR Mira is a Russian-language AI recruiter web application that automates hiring processes. The application features a conversational AI chat interface (Mira) on the left side and a dynamic content panel on the right that displays contextual HTML content based on the conversation. The AI assistant can answer questions about the product, display pricing tables, feature comparisons, and other marketing content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React useState for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with React plugin

**Key Design Pattern**: Split-panel layout with chat interface (30% width) on the left and dynamic HTML content area (70% width) on the right. The AI can generate HTML content that renders in the right panel based on conversation context.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API
- **Build**: esbuild for production bundling with selective dependency bundling for faster cold starts

**Key Endpoint**: `/api/chat` - Accepts conversation history, returns AI response with optional HTML content for the dynamic panel.

### AI Integration
- **Provider**: OpenRouter API (configured via `OPENROUTER_API_KEY` environment variable)
- **System Prompt**: Defines Mira as a Russian-speaking AI recruiter with specific response format (JSON with `message` and `html` fields)
- **Knowledge Base**: Markdown file at `server/knowledge-base.md` for product information injection into prompts

### Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `shared/schema.ts` (uses Zod for validation via drizzle-zod)
- **Current State**: Basic user schema with in-memory storage fallback (`MemStorage` class)
- **Migration Strategy**: Drizzle Kit with `db:push` command

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components (chat, dynamic content, hero)
│       ├── pages/        # Route components
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities (queryClient, utils)
├── server/           # Express backend
│   ├── routes.ts     # API endpoints
│   ├── storage.ts    # Data access layer
│   └── knowledge-base.md  # AI context
├── shared/           # Shared types and schemas
└── migrations/       # Database migrations
```

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## External Dependencies

### AI Services
- **OpenRouter API**: LLM provider for chat completions (requires `OPENROUTER_API_KEY`)

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **connect-pg-simple**: Session storage for Express

### Key Frontend Libraries
- **@tanstack/react-query**: Async state management
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **class-variance-authority**: Component variant styling
- **wouter**: Client-side routing
- **lucide-react**: Icon library

### Key Backend Libraries
- **drizzle-orm**: Type-safe SQL ORM
- **zod**: Runtime schema validation
- **express-session**: Session management