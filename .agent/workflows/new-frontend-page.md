---
description: Create a new frontend page/module in KitchenOS
---

# New Frontend Page Workflow
> Context: Read `.agent/PROJECT_BRIEFING.md` first — no need to explore the codebase.

## Design Rules (MUST follow)
- Vanilla CSS only — no Tailwind
- Use CSS variables from `index.css` — never hardcode colors
- **Compact Layout**: Single-viewport height forms (no scrolling) where possible
- **2-Column Grid**: Default for form fields on desktop
- **Centered Separators**: Indigo-accented horizontal lines with centered labels for sections
- **Auto-Logic**: Auto-generate IDs/Codes and Auto-select known parent IDs (Clients, Branches)
- Use `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-blur)` for panels
- Use `var(--accent-primary)` (#6366f1 indigo) for primary actions
- Use `var(--text-primary/secondary/tertiary)` for text hierarchy
- Fonts: Inter (body), Outfit (headings — h1-h6)
- All interactive elements need `transition: var(--transition-smooth)`
- Use lucide-react for icons

## Steps

1. Create page component `frontend/src/pages/{module}/{PageName}.tsx`
   - Functional component with TypeScript
   - Use `fetch()` with `Authorization: Bearer ${localStorage.getItem('access_token')}`
   - Use base URL pattern: `http://localhost:3000/{endpoint}`

2. Create styles `frontend/src/pages/{module}/{PageName}.module.css` (if needed)
   - Import and use as `styles.className`
   - Use CSS variables — never hardcode colors/fonts

3. Register route in `frontend/src/App.tsx`
   - Add lazy import at top: `const PageName = lazy(() => import('./pages/{module}/{PageName}'));`
   - Add route in the appropriate section inside `<Routes>`

## API Call Pattern
```tsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('http://localhost:3000/endpoint', {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
  })
    .then(r => r.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

## Standard Page Shell
```tsx
export function PageName() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Page Title</h1>
      </div>
      <div className={styles.content}>
        {/* content */}
      </div>
    </div>
  );
}
```
