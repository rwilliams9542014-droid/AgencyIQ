# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Hot reload dev server (Vite)
npm run build      # TypeScript check + production bundle (tsc -b && vite build)
npm run lint       # ESLint validation
npm run preview    # Serve the production build locally
```

Always run `npm run build` after making changes to confirm TypeScript compiles cleanly.

## Critical: File Integrity

`src/App.tsx` is a large (~1,700+ line) monolithic file. If it ever appears to contain only a JSON string or error message, it has been corrupted — reconstruct it from conversation history and the supporting files (`crmTypes.ts`, `seedData.ts`, `scopedStorage.ts`).

Do NOT wipe or overwrite large files without reading them first. Always use Edit for targeted changes.

## Architecture

### Routing
`src/main.tsx` is the entry point. It renders a `Root` component with two views:
- `'landing'` → `LandingPage.tsx` (public marketing page)
- `'app'` → `App.tsx` (the full CRM)

View is determined by `window.location.hash === '#app'`, `?view=app` query param, or `/app` pathname. Clicking "Access CRM" sets `window.location.hash = '#app'` and calls `setView('app')`. There is no React Router — all navigation is React state.

### Data Flow (localStorage-first)
All CRM data (clients, policies, tasks, etc.) lives in **localStorage**, not Supabase. The shape is `CrmDataset` from `src/data/crmTypes.ts`.

- **Load**: `loadDataset()` in `src/data/scopedStorage.ts` — reads from localStorage keyed by `accountId:userId`
- **Save**: `saveDataset()` — called on every state change via `useEffect`
- **Seed data**: Three tiers merged on first load — `createDemoDataset()` (core) + `createBulkSeedData()` (100 bulk clients). `SEED_VERSION_KEY` forces a re-seed when seed data changes.

**Supabase is NOT the primary data store.** It's only used for:
1. `active_sessions` — single-session enforcement
2. `ivans_policy_sync` / `ivans_connection` — IVANS carrier sync status

### Session Enforcement
`src/lib/sessionGuard.ts` enforces one active session per user:
- On app load, a UUID token is stored in `sessionStorage` (survives page reload in the same tab, not shared across tabs)
- `registerSession()` upserts this token to `active_sessions` in Supabase, overwriting any prior session
- `startHeartbeat()` polls every 60 seconds; if the DB token no longer matches the local token, `onKicked()` fires and an overlay appears telling the user they were signed in elsewhere

Session heartbeat only runs for real Supabase users (`uid` that doesn't start with `'u-'`).

### App.tsx Structure
`App.tsx` is a single mega-component. All views are defined as nested functions within the file and rendered conditionally based on `activeView` state:
- `activeView: AppView` — `'dashboard' | 'clients' | 'client-detail' | 'policies' | 'renewals' | 'tasks' | 'leads' | 'settings'`
- `modal: ModalType | null` — controls which modal overlay is shown
- All state lives at the `App` level and is passed down as props

**Modal pattern**: Each modal is a standalone function component. `ModalShell` provides the wrapper. State is local to each modal; `onSave` callback updates `dataset`, then `setModal(null)`.

**Data mutation pattern**: All handlers follow — update local `dataset` state → `save()` persists to localStorage → `toast()` shows confirmation.

### Permissions
`src/auth/permissions.ts` — role-based guards for owner analytics, revenue reports, and user management. Client-side only; no backend enforcement.

Roles: `Agent/Owner`, `Principal Agent`, `Admin`, `Producer`, `CSR`

### Styling
- `src/App.css` — monolithic stylesheet for the CRM (~140 KB)
- `src/LandingPage.css` — landing page styles
- `agencyiq-color-scheme.css` — CSS variable palette definitions
- 8 color palettes selectable at runtime; dark/light mode stored in localStorage
- Brand colors: teal `#1d6f76` / `#18d4c3`, gold `#c58a20`, dark bg `#050b16`

### Mascot Image
`src/assets/AGENCYIQ_MASCOT_CLEAR.png` has a black background. Use `mix-blend-mode: screen` in CSS to dissolve the black so the robot appears to float. On light backgrounds, use `mix-blend-mode: multiply` instead.

### Address Autocomplete
The `AddressInput` component in `App.tsx` uses the free OpenStreetMap Nominatim API. No API key required. Debounced at 5-character minimum. Sets separate `mailingAddress`, `city`, `state`, `zip`, `county` fields on selection.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.tsx` | Entry point; hash-based landing vs. CRM routing |
| `src/App.tsx` | Entire CRM application — all views, modals, state |
| `src/LandingPage.tsx` | Public marketing homepage |
| `src/data/crmTypes.ts` | All TypeScript types for CrmDataset and entities |
| `src/data/scopedStorage.ts` | localStorage load/save + seed versioning |
| `src/data/seedData.ts` | Demo agency data (core) |
| `src/data/bulkSeedData.ts` | 100-client bulk seed for scale testing |
| `src/lib/supabase.ts` | Supabase client + IVANS table types |
| `src/lib/sessionGuard.ts` | Single-session enforcement heartbeat |
| `src/auth/permissions.ts` | Role-based permission helpers |
| `src/components/IvansPanel.tsx` | IVANS carrier sync UI |
| `src/components/NewClientWizard.tsx` | Multi-step new client wizard |

## Adding Features

- **New data type**: Add type to `crmTypes.ts` → add to `CrmDataset` → update seed files → add `mergeById()` call in `scopedStorage.ts`
- **New view**: Add to `AppView` union → add nav item → add conditional render in App's main content area
- **New modal**: Add to `ModalType` union → create component function → add conditional render in modal section of App → wire up handler
- **New Supabase table**: Follow IVANS pattern — read-only fetch in a `useEffect`, don't touch the localStorage data layer
