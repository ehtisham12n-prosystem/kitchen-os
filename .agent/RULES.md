# KitchenOS — User-Defined Rules
> These rules override any Antigravity defaults.
> Edit this file whenever you want to change how Antigravity behaves on this project.

## 🚨 Troubleshooting & Active Bugs
- If you encounter a backend compilation error, a silent `401 Unauthorized` token drop, or database syncing crashes, **STOP** and read `.agent/TROUBLESHOOTING.md`.
- It contains mapped out solutions for recent JWT caching bugs, TypeORM crash recoveries, and common column mapping mismatch resolutions.

---

## 🎨 UI-First Development Mode (DEFAULT)
- Build all frontend pages with realistic mock/static data first
- Do NOT read backend service, entity, or controller files during UI work
- Do NOT make real API calls during UI-only sessions — use hardcoded mock data
- Only wire up real APIs when the user explicitly says "now connect the API" or "wire it up"
- Mock data must be realistic and contextual — real-looking PKR amounts, real menu item names, real staff names etc.

---

## ⚡ Autonomous Efficiency Rules (Act Without Asking)

### File Operations
- When creating a new page, automatically:
  1. Create the `.tsx` file
  2. Create the `.module.css` file
  3. Add the `lazy()` import to `App.tsx`
  4. Add the `<Route>` to `App.tsx`
  5. Add the entry to the page map in `.agent/PROJECT_BRIEFING.md`
  6. Place the page in the correct architectural side: **Nexus** (`pages/platform/`) or **Console** (`pages/client-portal/`, `pages/inventory/`, etc.) based on the target user.
  — Do all 6 steps in one response. Never ask permission for each step.
- When editing a page that has a `.module.css`, always update both files together in the same response
- Never create a page without a `.module.css` — always create both

### Decision Making
- Make design decisions autonomously — do not ask "should I use a table or cards?" — choose the best option and build it
- If given a vague UI instruction like "make it better" or "more premium" — apply best judgment and execute
- Never ask "do you want me to also update X?" — if X is obviously related, update it
- If the user says a page name and one clear action — just do it. No confirmation needed.

### Self-Maintenance
- After completing any UI work, check if `.agent/PROJECT_BRIEFING.md` page map needs updating — if yes, update it silently.
- **CRITICAL**: If a page is developed, discarded, or altered, its presence and routing MUST be immediately replicated/updated on the frontend in the Console or Nexus navigation menus and `App.tsx` routes.
- If a new module/page is created mid-conversation, update `PROJECT_BRIEFING.md` in the same response.
- Keep `GEMINI.md` and `RULES.md` in sync if any contradictions are found.

### Reading Files
- Never read a file that was already read in the current conversation — use the version already in context
- Never read `node_modules/`, `dist/`, `build/` directories under any circumstances
- Prefer `grep_search` for finding a function/class — only use `view_file` if the entire file is needed
- Prefer `view_code_item` when only one function or class is needed from a file

---

## 🛑 Questions vs Execution
- If the user asks a question — answer it. Do NOT start executing or building anything.
- Only execute/build/edit files when the user gives a clear instruction to do so (e.g. "do it", "build it", "make the change")
- If unsure whether it's a question or an instruction — ask directly before doing anything
- If any part of an instruction is unclear or ambiguous — ask first, act after

## 🗣️ Communication Style
- No filler phrases — lead with the answer immediately
- No restating what the user said
- Keep responses short unless the task truly requires detail
- After completing work: short summary only — no lengthy explanation of what was done
- When writing code, always write the complete file — no truncation with `// ...rest remains the same`
- Do not explain what you are about to do — just do it, then give a 2–3 line summary

---

## 🔍 Before Coding Anything
- Confirm the approach ONLY IF the change touches more than 3 files or involves a new DB schema
- Do NOT install new npm packages without asking
- Do NOT create new database migrations without asking
- For UI changes on a single page — never ask for confirmation, just execute

---

## 📐 Design
- **ZERO hardcoded colors allowed** — every color in every `.module.css` file MUST use a CSS variable from `index.css`
- **Never use gradient colors for text** — use solid theme tokens only (e.g., `var(--accent-primary)`).
- No `#hex`, no `rgb()`, no `rgba()` literals — ever. Use `var(--token-name)` instead
- The full token list lives in `frontend/src/index.css` — always reference it before adding new styles
- Never use Tailwind, Bootstrap, or any CSS framework
- Always use `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-blur)` for panels
- Always use `var(--card-bg)`, `var(--card-border)` for cards
- Always use `var(--transition-smooth)` on interactive elements
- Nav: `var(--nav-bg)`, `var(--nav-item-bg-active)`, `var(--nav-item-text-active)` for the sidebar
- Badges: always use `var(--badge-{status}-bg)` + `var(--badge-{status}-text)`
- Buttons: always use `var(--btn-{variant}-bg)` + `var(--btn-{variant}-text)`
- Tables: always use `var(--table-header-bg)`, `var(--table-row-hover-bg)`, `var(--table-border)`
- Modals: always use `var(--modal-overlay-bg)`, `var(--modal-bg)`, `var(--modal-border)`
- Tabs: always use `var(--tab-active-bg)`, `var(--tab-active-text)`, `var(--tab-inactive-text)`
- Form controls: always use `var(--input-bg)`, `var(--input-border)`, `var(--input-border-focus)`
- Use `lucide-react` for all icons — no other icon library
- Use `var(--font-base)` for body text, `var(--font-heading)` for headings

## 🎨 Design Aesthetics & Layout Standards (NEW)
- **Compact One-Screen Layout**: Prioritize fitting all form logic/content within a single viewport/screen height to eliminate scrolling.
- **2-Column Grid**: Use a 2-column layout (`grid-template-columns: 1fr 1fr`) as the default for form fields on desktop.
- **Section Separators**: Use centered, indigo-accented section titles with a gradient horizontal line to divide form sections (Identity vs. Location, etc.).
- **Auto-Logic First**: Always implement "Auto-select" for known fields (like Client) and "Auto-generate" for unique ID/Code fields based on Name inputs.
- **Glassmorphism Plus**: Combine `var(--glass-bg)` with subtle accent glows (`box-shadow`) and indigo borders for active separators or headers.
- **Compact Components**: Use `size="sm"` for buttons and reduced paddings (`var(--spacing-lg)` or `var(--spacing-md)`) in form containers to save space.

---

## 🎨 Theme System (Active since 2026-02-24)
- 5 system themes: Dark, **Light (default/active)**, Blue, Purple, Orange
- **DEFAULT THEME**: The default theme across the entire application must ALWAYS ALWAYS be the Light theme. Do not use Deep Space Dark or any dark themes unless explicitly requested for a specific component.
- Tokens stored in `themes.tokens` JSONB in PostgreSQL
- ThemeProvider maps ~80 tokens to CSS vars on `:root` at runtime
- Only **Nexus Admins** can create/edit themes via `/nexus/themes`
- Any user can switch their active theme from the theme switcher
- New theme columns: `slug` (unique key), `description`, `tokens` (JSONB replaces all old flat color cols)
- API seed endpoint: `POST /v1/platform/themes/admin/seed`

---

## ⚡ Performance Standards
- **Large Component Lists (e.g., 500+ checkboxes)**: React can easily render massive lists without lagging if state is managed correctly. Instead of re-rendering the whole page when a single element is clicked, use optimized state maps (e.g., `Set<number>`) and `useMemo()` hooks. Always refer to this rule when building complex mapping pages like Permissions Assignment.

---

## 🔒 Security
- Never hardcode API keys, secrets, or tokens
- Always use `process.env.*` on the backend
- Always use `localStorage.getItem('access_token')` on the frontend

## 🗄️ Database & Seeding
- **NEVER** add data or seed the database automatically on restart (e.g. in `onModuleInit`).
- Only add data when the user specifically instructs you to do so (e.g. "seed some demo products").
- If data is deleted by the user, do NOT let it reappear automatically.
- Seeding should always be a conscious, manual action performed via a specific task or endpoint.

## GitHub Commit & DB Schema Records
- Every time code is committed and/or pushed to GitHub, update `COMMIT_RECORD.md` in the same commit whenever possible.
- Each commit record must include: commit hash, date/time with timezone, branch, commit message, scope, summary, verification performed, and whether DB schema changed.
- If a database schema is added, changed, or removed, update `DB_SCHEMA_CHANGE_LOG.md` in the same commit whenever possible.
- Each DB schema record must include: commit hash, migration file/path, affected table(s), columns/indexes/constraints changed, purpose, live deployment SQL or migration command, and post-deploy verification.
- After every commit/push, tell the user whether DB schema changed. If it changed, provide the exact instructions/SQL the live deployment agent must apply before or during deployment.
- These records are mandatory across all chats for this project. The user should not need to ask separately for commit records or DB schema deployment notes.

---

## 💬 When the User Gives Instructions
- Save important instructions to `.agent/RULES.md` immediately in the same response
- Save project context updates to `.agent/PROJECT_BRIEFING.md` immediately
- Confirm what was saved in one line: "✅ Saved to RULES.md"
- Never wait until the end of a long task to save — save at the moment of instruction

---

## 🎯 Stay Focused on Current Page/Module
- When working on a specific page or module, only read files directly related to that task
- Do NOT browse or explore other parts of the project during a focused task
- If I need to go outside the current page/module to complete the task, I stop — name the exact files needed and why — then wait for permission before reading them

---

## 📂 File Read Limit Per Task
- **UI-only sessions (default mode):** Max 3–4 frontend files. No backend files at all.
- **Full-stack sessions:** Max 3–4 files total, including 1 DB entity file if needed.
- **Beyond the limit:** Stop immediately, list the extra files by name, ask before proceeding.

---

## 💬 When to Start a New Chat
- Same page/module, continuing work → stay in same chat (file already in context)
- Moving to a different page/module → start a new chat
- Current chat exceeds 8–10 turns → start a new chat regardless of topic
- Completed a full feature, moving to the next → start a new chat

---

## 🏗️ Architecture Decisions
- **Multi-Branch Users (APPROVED)**: Shift to a "Contract" model. Users will no longer have a single `branch_id`. Instead, we will implement a `user_branch_roles` junction table linking User + Branch + Role, allowing users to have different permissions per branch they are assigned to.
- **Client Creation Flow (APPROVED)**: `createClient` in Nexus creates a Client record, Settings, a `CLIENT_ADMIN` user with `branch_id = null`, and **auto-creates a "Main Branch"**. The Admin/Branch toggle in the UI is deprecated in favor of a "Global Configuration" left menu section and a Branch Selector dropdown based strictly on permissions.

---

## 🔐 Role-Based Access Control (RBAC) Standards
- **MANDATORY**: Whenever a new feature is added or an existing one is changed, you MUST:
  1. Add/update the corresponding permission keys in `backend/src/platform/security/permissions.ts` and `frontend/src/auth/access.ts`.
  2. Update the `RegistryService.ts` to include any new pages or modules in the system hierarchy.
  3. Update the relevant role templates in `SysGroupsService.ts` so new features are automatically available to the correct roles.
  4. Ensure the `usePermissionAccess.ts` hook is updated to expose the new permission as a usable boolean flag.

---

## ✏️ How to Add New Rules
Tell Antigravity: "Add to RULES.md: [your instruction]"
It will update this file immediately and confirm.
