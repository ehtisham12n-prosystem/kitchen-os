# Architectural Decision Record: Global Frontend Design System

**Date**: Feb 2026
**Context**: Ensuring visual consistency, maintainability, and white-labeling capabilities across the KitchenOS Frontend (React JS).

## Requirement
The system requires a centralized "Theme Repository" where all visual styles (colors, button styles, typography, table layouts, border radii, etc.) are defined. Developers should never hardcode hex colors or arbitrary pixel values in individual page files.

## Decision: Design Tokens & Component Library

To achieve this, the frontend architecture will strictly adhere to the following principles:

### 1. CSS Variables (Design Tokens) as the Single Source of Truth
All theme-related values will be stored in a centralized CSS/SCSS token file (e.g., `theme.css`). 
- **Colors**: `--color-primary`, `--color-secondary`, `--color-background`, `--color-danger`
- **Typography**: `--font-family-base`, `--text-size-sm`, `--text-size-lg`
- **Spacing/Border**: `--border-radius-base`, `--spacing-md`

*Benefit*: Changing `--color-primary: #1d4ed8;` to `--color-primary: #10b981;` in this single file will instantly update every button, header, and active state across the entire application without touching a single React component.

### 2. Strict UI Component Reusability
The application will utilize a strict UI component library (either a highly customized Tailwind setup, Material-UI, or custom built components like `<KitchenButton>`, `<KitchenTable>`).
- Developers MUST use these wrapper components for all UI elements.
- Components MUST inherit their styling exclusively from the design tokens.
- **Example**: If we need to change all buttons from "square" to "rounded", we only modify the `<KitchenButton>` wrapper component or the `--border-radius-base` token.

### 3. Future-proofing for Client White-Labeling (Multi-tenant Themes)
Because KitchenOS is a SaaS platform, this tokenized approach allows us to eventually store specific theme overrides in the database per `client_id` (e.g., in a `client_settings` table). 
When a branch POS terminal boots up, it can fetch its `client_id` specific theme variables overrides and inject them into the CSS root, instantly branding the POS for that specific restaurant.
