# AGENTS.md: After the Credits

Context for coding agents working in this repository.

## What this is
A private, personal film diary for MPCS 51238 Assignment 3, "Patterns & Flows: An Everyday Tool". A visitor logs a film (title, date watched, 1–5 star rating, optional reflection) and finds their entries again when they come back. Data lives only in the browser's `localStorage`.

## Hard constraints (push back if a change would break these)
- **Stack:** Next.js (App Router) + Tailwind CSS v4 + TypeScript. Vitest is the only extra dev dependency.
- **No** backend, database, authentication, API routes, or external APIs. That includes movie lookup APIs such as TMDB and OMDb.
- **No** new runtime dependencies without a clear reason. Prefer platform features such as native inputs and `crypto.randomUUID`.
- Keep the scope small. The full list of postponed features is in `README.md` under "Decisions".

## Commands
```bash
npm run dev     # local dev server at http://localhost:3000
npm test        # Vitest (lib/*.test.ts)
npm run lint    # ESLint (next/core-web-vitals + TypeScript)
npm run build   # production build; must pass before committing
```

## Map
| Path | Role |
|---|---|
| `app/layout.tsx` | Fonts, skip link, shared `SiteHeader`, `<main>` |
| `app/page.tsx` → `components/Diary.tsx` | `/`: loading, first-visit welcome, returning diary, save banner |
| `app/log/page.tsx` → `components/EntryForm.tsx` | `/log`: the entry form |
| `components/ui.tsx` | Shared `Button`, `ButtonLink`, `Field`, and `FieldError` primitives |
| `lib/entries.ts` | `Entry` type and all `localStorage` access (load, save, delete, corrupt-data backup, form draft) |
| `lib/validate.ts` | Pure validators and the user-facing error messages |
| `lib/date.ts` | Local-day date helpers (never use `toISOString()` for days) |
| `docs/flows.md` | Mermaid diagram of the three flows (embedded in `README.md`) |
| `docs/RESEARCH.md` | Onboarding research and the design decisions it led to |

## Conventions
- Read and write `localStorage` only through `lib/entries.ts`, and only in effects or event handlers. Never during render.
- Error messages say what to do next ("Enter the film's title."), never "Invalid input". They appear next to the field and in the summary.
- Every field has a visible `<label>`. Use the `Field` primitive and native controls.
- Colors come from the `@theme` tokens in `app/globals.css`. Any new color pairing must keep text at ≥ 4.5:1 contrast (non-text ≥ 3:1). Note the ratio in the comment there.
- Keep commits small and conventional (`feat:`, `fix:`, `docs:`, `a11y:`), and run `npm test && npm run lint && npm run build` before each.
- Don't deploy or push without the owner's approval.
