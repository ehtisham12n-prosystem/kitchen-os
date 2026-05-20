# UI / UX & THEME SYSTEM INSTRUCTION PACKAGE

## 1. CORE PHILOSOPHY (NON-NEGOTIABLE)
This application is:
- Enterprise-grade
- Multi-tenant
- Long-term scalable
- Easy to maintain
- Easy to rebrand per client

**Golden Rule**
No UI style (color, font, spacing, button design) is allowed inside pages or modules directly.
Everything must come from one centralized system.

---

## 2. THEME ENGINE REQUIREMENT
The system MUST support:
- Multiple themes
- Multiple color palettes
- Multiple UI style variants
- Future addition of themes without code refactor

Themes must be:
- Switchable
- Extendable
- Centrally managed
- Applied system-wide instantly

---

## 3. WHAT A “THEME” INCLUDES
Each theme must define:

### 3.1 Visual Tokens
- Primary color
- Secondary color
- Accent color
- Background colors
- Text colors
- Border colors
- Status colors (success, warning, error, info)

### 3.2 UI Behavior Tokens
- Button radius
- Card radius
- Table density
- Shadow depth / Shadow intensity
- Font weight scale

### 3.3 Typography Tokens
- Font family
- Heading sizes (H1–H6)
- Body text size
- Line height

---

## 4. THEME APPLICATION RULES
- Theme must apply to:
  - All modules
  - All dashboards
  - All reports
  - POS
  - Admin panels
- No page reload required (if possible)
- Must support branch-level theme override (future-ready)

---

## 5. THEME SWITCHING ACCESS CONTROL
Theme switching:
- **System Admin** → All client
- **Business Owner** → Own branches only
- **Branch Manager** → View only (no edit)

---

## 6. THEME REPOSITORY (CORE SYSTEM MODULE)
There MUST be a Theme Repository / Design System Module that:
- Stores all themes
- Stores all UI tokens
- Is the ONLY place to modify styles

No theme logic inside pages
No per-module CSS overrides
One change → reflected everywhere

---

## 7. MULTIPLE THEMES (MANDATORY SUPPORT)
The system MUST support:
- Light theme
- Dark theme
- High-contrast theme
- Client-branded themes
- Custom themes

**Theme Switching**
- **Platform Admin** → Can manage all themes
- **Client Owner** → Can select theme for own business
- **Branch level** → Read-only (future extension)

---

## 8. UI COMPONENT RULES (STRICT)

**Buttons**
- Variants: primary, secondary, danger, ghost
- Sizes: small, medium, large
- States: Disabled, loading, icon-only states

**Tables**
- Sortable
- Filterable
- Paginated
- Density options (compact / normal)

**Forms**
- Clear labels
- Inline validation
- Required field indicators
- Keyboard friendly

---

## 9. DASHBOARD & ENTERPRISE UI GUIDELINES
- Clean, professional look
- No flashy animations
- Neutral colors
- Clear KPIs
- Card-based layout
- Consistent spacing

**Dashboards must:**
- Load fast
- Show summary first
- Allow drill-down

---

## 10. MULTI-LANGUAGE & MULTI-CURRENCY READY
UI MUST:
- Never hardcode text
- Use translation keys
- Support RTL (future)

---

## 11. ACCESSIBILITY (MANDATORY)
- Proper contrast ratios
- Keyboard navigation
- Screen-reader friendly labels

---

## 12. CHANGE MANAGEMENT RULE
If business asks:
**“Change button color”**

**Solution:**
- Update one token in Design System
- Entire system updates automatically

**NOT allowed:**
- Editing multiple/all pages

---

## 13. AUDIT & ENFORCEMENT
Developer must ensure:
- No inline styles
- No CSS duplication
- No module-level theme overrides

Violation = architectural failure.

---

## 14. SUMMARY FOR DEVELOPER AGENT
Build a centralized Design System & Theme Engine, store it in a dedicated repository/folder, enforce its usage across all modules, and ensure multi-theme, multi-tenant branding, easy future changes, and enterprise-grade consistency.

---

## 15. COLOR SYSTEM RULES

### 15.1 Color Categories (Fixed)
- **Primary** → Main actions
- **Secondary** → Neutral actions
- **Success** → Confirmations
- **Warning** → Caution states
- **Danger** → Errors / destructive actions
- **Info** → Informational messages
- **Background** → App surfaces

### 15.2 Usage Rules
- Primary color ONLY for main action
- Never use red for anything except:
  - Delete
  - Error
  - Reversal
- Green ONLY for success or completion
- Yellow/orange ONLY for warnings

---

## 16. TYPOGRAPHY RULES

### 16.1 Font Policy
- Maximum 1 primary font family
- Optional 1 secondary font
- No decorative fonts

### 16.2 Hierarchy
| Element | Size | Weight |
| --- | --- | --- |
| **Page Title** | Large | Semi-Bold |
| **Section Title** | Medium | Medium |
| **Body Text** | Regular | Normal |
| **Labels** | Small | Medium |
| **Helper Text** | Small | Normal |

### 16.3 Rules
- Do not mix font sizes randomly
- Line height must be readable (≥1.4)
- Never center-align long text

---

## 17. BUTTON DESIGN RULES

### 17.1 Button Types (Only These)
- Primary
- Secondary
- Outline
- Danger
- Ghost (icon-only)

### 17.2 Button Behavior
- Disabled state must be visually clear
- Loading state must replace text with spinner
- Buttons must never shift layout on loading

### 17.3 Placement Rules
- Primary action → Right
- Secondary action → Left
- Destructive actions → Separated visually

---

## 18. FORM & INPUT DESIGN

### 18.1 Input Rules
- Labels always visible (no placeholder-only)
- Required fields clearly marked (*)
- Inline validation preferred
- Error messages must be human-readable

### 18.2 Field Grouping
- Group related fields
- Use sections instead of long single forms
- Avoid scroll-heavy forms

---

## 19. TABLE & DATA DISPLAY RULES

### 19.1 Table Design
- Sticky header for long tables
- Row hover effect enabled
- Zebra striping preferred
- Action column always on right

### 19.2 Data Density
Must support:
- Compact
- Comfortable
- Default = Comfortable

### 19.3 Mandatory Features
- Search
- Column filters
- Sorting
- Pagination
- Export (CSV/PDF/Excel – later phase)

---

## 20. DASHBOARD & REPORT UI

### 20.1 Dashboard Rules
- KPI cards on top
- Charts below KPIs
- Tables at bottom

### 20.2 Charts
- Use consistent color mapping
- Avoid 3D charts
- No unnecessary animations

---

## 21. NAVIGATION & LAYOUT

### 21.1 Navigation Structure
- Left sidebar for main modules
- Top bar for:
  - Search
  - Notifications
  - Profile
- Breadcrumbs for deep pages

### 21.2 Page Layout
- Header → Content → Actions
- Max content width for readability
- No full-width text blocks

---

## 22. ALERTS, TOASTS & FEEDBACK

### 22.1 Feedback Rules
Every user action MUST have feedback:
- **Success** → Toast
- **Failure** → Error alert
- **Pending** → Loader

### 22.2 Alert Usage
- Confirmation before destructive actions
- Clear explanation, not technical error codes

---

## 23. MODALS & DIALOGS

### 23.1 When to Use
- Confirmation
- Quick edits
- Short forms

### 23.2 When NOT to Use
- Large forms
- Reports
- Multi-step processes

---

## 24. RESPONSIVENESS (MANDATORY)

### 24.1 Breakpoints
- Desktop / Laptop (Primary)
- Tablet (Secondary)
- Mobile (Limited but usable)

### 24.2 Mobile Rules
- POS must be usable on tablet
- No horizontal scrolling
- Touch-friendly buttons

---

## 25. ACCESSIBILITY (BASIC LEVEL)
- Proper color contrast
- Keyboard navigable forms
- Focus states visible
- Error messages linked to inputs

---

## 26. PERFORMANCE UX RULES
- Avoid heavy images
- Lazy load large tables
- Skeleton loaders instead of blank screens
- No blocking UI during API calls
