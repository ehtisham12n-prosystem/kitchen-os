# KitchenOS — Antigravity Standing Instructions
> This file is loaded automatically at the start of EVERY conversation.
> Follow ALL rules below throughout the entire development of this project.

---

## 🧠 Step 0 — Always Do This First (Every Conversation)
1. Read `.agent/PROJECT_BRIEFING.md` — full project context + page name map
2. Read `.agent/RULES.md` — user-defined rules that override ALL defaults below
3. Only then proceed with the task — no codebase exploration before reading these two files

---

## ⚡ Token Efficiency Rules (ALWAYS APPLY)

### File Reading
- **Never** use `list_dir` to explore the project structure — use `PROJECT_BRIEFING.md` instead
- Only read a file if it is **directly relevant** to the current task
- If the user pastes code, use that — do not re-read the same file
- If you already read a file in this conversation, do not read it again
- Max 3 file reads before answering unless absolutely required

### Responses
- Be concise — no filler phrases ("Great question!", "Of course!", "Certainly!")
- Skip restating what the user said
- Lead with the answer or action, then explain if needed
- Use bullet points and tables over long paragraphs
- Code blocks must be complete and copy-paste ready — no `// ...rest of code` shortcuts

### Tool Calls
- Batch independent tool calls in parallel — never call them sequentially if they can run together
- Prefer `grep_search` over `view_file` when looking for a specific pattern
- Prefer `view_code_item` over `view_file` when only one function/class is needed

---

## 🏗️ Coding Standards

### Backend (NestJS)
- All entities: snake_case column names, camelCase TS property names
- All routes: JWT-protected globally — use `@Public()` decorator to bypass
- Always filter by `clientId` from `req.user.clientId` for tenant isolation
- DTOs must use `class-validator` decorators
- Never hardcode secrets — use `process.env.*`
- Module structure: `entities/`, `dto/`, `{module}.module|service|controller.ts`

### Frontend (React + Vite)
- **No Tailwind** — vanilla CSS with CSS variables only
- **No inline styles** unless trivial (e.g. `display: flex`)
- All colors via CSS variables from `index.css` — never hardcode hex/rgb
- All new pages must use `React.lazy()` pattern (already in `App.tsx`)
- All API calls: `fetch()` with `Authorization: Bearer ${localStorage.getItem('access_token')}`
- Base API URL: `http://localhost:3000`
- Component files: `.tsx` + optional `.module.css` in same folder
- Use `lucide-react` for icons — no other icon library
- Use `recharts` for charts — no other chart library

### Design System
- Theme: Deep Space Dark — glassmorphism, indigo/purple/cyan
- Primary accent: `var(--accent-primary)` (#6366f1 indigo)
- Glass panels: `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-blur)`
- Transitions: `var(--transition-smooth)` for all interactive elements
- Fonts: Inter (body), Outfit (headings) — already loaded globally
- Radii: `var(--radius-sm/md/lg/xl)` — never hardcode px

### General
- TypeScript strict mode — no `any` unless truly unavoidable
- No `console.log` in committed code (use proper error handling)
- All new files must follow the existing naming convention of their module

---

## 🚫 Never Do These
- Never use Tailwind CSS
- Never add a new npm package without asking the user first
- Never use a global state manager (no Redux, Zustand, etc.) — hooks + localStorage only
- Never use `any` TypeScript type without justification
- Never read `node_modules/` or `dist/` directories
- Never generate placeholder/lorem ipsum content — make it contextually real
- Never truncate code with `// ... rest remains the same` — always write complete code

---

## 📁 Portal Hierarchy
| Portal | Login URL | Base Directory |
|---|---|---|
| **System** | `/admin-login` | `pages/platform/` |
| **Client** | `/client-login` | `pages/client-portal/` |
| **Branch** | `/login` | `pages/pos/`, `pages/inventory/` |
| **Customer** | `/customer-login` | `pages/customers/` |

---

## 📁 Project Quick Map
```
d:\Antigravity\KitchenOS\
├── .agent/
│   ├── PROJECT_BRIEFING.md     ← Full project context (read this first)
│   ├── RULES.md                ← User-defined overrides
│   └── workflows/              ← Task playbooks (/new-backend-module, /new-frontend-page)
├── backend/src/                ← NestJS (16 modules)
├── frontend/src/               ← React 19 + Vite (91 pages)
├── pos/src/                    ← Electron + SQLite offline POS
└── docs/                       ← ADRs and architecture docs
```

---

## 🔄 Workflow Commands
| Command | What it does |
|---|---|
| `/new-backend-module` | Create NestJS module (entity → DTO → service → controller → module) |
| `/new-frontend-page` | Create React page with lazy import, route, and CSS module |

---

## GitHub Commit & DB Schema Records
- Every time code is committed and/or pushed to GitHub, update `COMMIT_RECORD.md` in the same commit whenever possible.
- Each commit record must include: commit hash, date/time with timezone, branch, commit message, scope, summary, verification performed, and whether DB schema changed.
- If a database schema is added, changed, or removed, update `DB_SCHEMA_CHANGE_LOG.md` in the same commit whenever possible.
- Each DB schema record must include: commit hash, migration file/path, affected table(s), columns/indexes/constraints changed, purpose, live deployment SQL or migration command, and post-deploy verification.
- After every commit/push, tell the user whether DB schema changed. If it changed, provide the exact instructions/SQL the live deployment agent must apply before or during deployment.
- These records are mandatory across all chats for this project. The user should not need to ask separately for commit records or DB schema deployment notes.
