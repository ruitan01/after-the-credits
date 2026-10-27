# AGENTS.md: After the Credits

Context for coding agents working in this repository.

## What this is
A private, personal film diary. A visitor signs in, logs a film (title, date watched, 1–5 star rating, optional reflection), and finds their entries again on any device.

- **Assignment 3** ("Patterns & Flows") built the diary with `localStorage` only. That version is live from `main`.
- **Assignment 4** ("Full Stack App", branch `assignment-4-fullstack`) adds Clerk sign-in, a Supabase database with row-level security, and iTunes Search for finding films. Each person sees only their own entries.

## Hard constraints (push back if a change would break these)
- **Stack:** Next.js (App Router) + Tailwind CSS v4 + TypeScript, Clerk (`@clerk/nextjs`), Supabase (`@supabase/supabase-js`), and one external API: iTunes Search. Dev-only: Vitest, Playwright, `@clerk/testing`.
- **No other** backend services, external APIs or runtime dependencies without a clear reason. Prefer platform features.
- **Keys:** secrets live only in `.env.local` (git-ignored) and in Vercel's environment variables. Never in code, commits, logs or chat. Agents must not read or write `.env*` files (denied in `.claude/settings.json`). The owner creates `.env.local` by hand.
  - Only `NEXT_PUBLIC_*` values may reach the browser: the Clerk publishable key, the Supabase URL and the Supabase publishable key.
  - The Clerk secret key is server-only. The Supabase secret / service-role key is **not used** by this app, because it bypasses row-level security.
- **Free tiers only.** Clerk stays on development keys.
- **Preserve the existing visual design and flows.** New UI reuses the `@theme` tokens and `components/ui.tsx`.
- Keep the scope small. Postponed features are listed in `README.md` under "Decisions".

## Architecture
```
Browser (client components)
 ├─ Clerk: sign-up / sign-in / sign-out, session token (JWT)
 ├─ Supabase client: publishable key + Clerk token ──► Postgres; RLS decides which rows
 └─ fetch /api/films/search?q= ──► Next.js route handler ──► iTunes Search
middleware.ts (clerkMiddleware): /log and /api/* need a signed-in user
```
- **Identity:** Clerk. Supabase trusts Clerk tokens via Third-Party Auth (Clerk provider). In SQL, `auth.jwt()->>'sub'` is the Clerk user id (`user_…`).
- **Access control:** RLS policies in Postgres are the only gate for diary data. Diary reads and writes go straight from the browser to Supabase with the user's token, and no server code filters by user. Don't add a service-role client to "work around" RLS.
- **Signed out:** `/` shows a welcome with sign-in and sign-up, and no entries, including entries from `localStorage`.
- **Film search (Phase 4):** `GET /api/films/search?q=` is a server route handler, because it shrinks a ~450 KB response to a few KB, caches identical searches for a day (our own `revalidate`, since Apple's `max-age` varies), and limits use to signed-in users (it checks `auth()` as well as the middleware). iTunes needs no key and allows CORS, so keys aren't the reason. Risk: Apple's informal limit is ~20 requests a minute per IP, and on Vercel every user shares the server's IP. The server cache, a 300 ms debounce, a 2-character minimum, aborted stale requests and a per-tab cache keep requests down. Any failure (network, 5 s timeout, 429/403/5xx, malformed body) is a 502 and the form shows "unavailable". Search never blocks saving a typed title.

## iTunes Search: what we verified (2026-10-26)
- `media=movie` or `entity=movie` **returns 0 results for every title tried**. Don't use it.
- `term=<q>&media=all&limit=200&country=US`, then keep only results with `kind === "feature-movie"`. This works but coverage is patchy: it found *Barbie* (2023), but not *Inception*, *Parasite*, *Past Lives* or *Aftersun*, which are crowded out by music and podcasts. `lookup?id=` does find them.
- **Rechecked 2026-10-27:** iTunes also returns *irrelevant* films. "inception" gives 67 feature films, none of them *Inception*. So results are filtered by title (`lib/films.ts` `matchScore`): exact, starts-with (ignoring a leading article), every query word starting a title word, or a match ignoring spaces. Anything else is dropped, never shown to fill the list. `Cache-Control` varied from `max-age=17817` to `86400`.
- **Consequence:** search is an optional helper on `/log`. Typing a title by hand must always work.
- **Fields we use:** `trackId` (stable id), `trackName` (title), `artistName` (director), `releaseDate` (ISO; we take the year), `artworkUrl100` (poster; swap `100x100bb` for a larger size), `primaryGenreName`. Ignore prices, previews and the `collection*` fields.
- **Nothing found:** HTTP 200 with `{"resultCount":0,"results":[]}`. An empty term behaves the same. "Nothing found" is not an error.
- **API down:** network failure or a non-2xx status. The UI has three designed states: loading, nothing found and unavailable.

## Data model (Supabase)
One table. Every row belongs to one Clerk user.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` | Imported entries keep their existing `localStorage` UUID |
| `user_id` | `text not null`, default `auth.jwt()->>'sub'` | Clerk user id. **`text`, not `uuid`** |
| `title` | `text not null`, non-blank check | |
| `watched_on` | `date not null` | Local calendar day; maps to `YYYY-MM-DD` |
| `rating` | `smallint not null`, check 1–5 | |
| `reflection` | `text not null default ''` | |
| `itunes_id` | `bigint` null | `trackId`; null when typed by hand |
| `artwork_url` | `text` null | |
| `release_year` | `smallint` null | |
| `created_at` | `timestamptz not null default now()` | |

- Index on `(user_id, watched_on desc)`.
- **RLS is enabled.** One policy per action, all `to authenticated`, comparing `(select auth.jwt()->>'sub') = user_id`: `select` (using), `insert` (with check), `update` (using + with check), `delete` (using).
- Schema changes are migrations only, made through the Supabase MCP server. Never edit tables by hand.
- The form draft stays in `localStorage` (`after-the-credits:draft:v1`). It's a per-device convenience, not diary data.

## Existing localStorage entries
Entries from Assignment 3 (`after-the-credits:entries:v1`) belong to a browser, not an account.
1. **Never import automatically, and never delete them automatically.** After sign-in, if any exist, offer: "N films are saved in this browser only. Add them to your account?" with **Add them** and **Not now**.
2. **The import is idempotent:** reuse each entry's UUID as `id` and insert with `on conflict do nothing`. Entries without a UUID id get a new one.
3. **Only after the whole import succeeds**, copy the value to `after-the-credits:entries:v1:imported-<timestamp>` and remove the original key. On any failure, leave `localStorage` untouched.

## Commands
```bash
npm run dev     # local dev server at http://localhost:3000
npm test        # Vitest (lib/*.test.ts, app/**/route.test.ts)
npm run test:e2e  # Playwright (e2e/): needs two Clerk test users in .env.local, see e2e/README.md
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
| `lib/entries.ts` | `Entry` type and all diary storage (Supabase `public.entries`), plus read-only parsers for the Assignment 3 `localStorage` entries (Phase 3 import) and the form draft helpers |
| `components/ImportOffer.tsx` | "N films are saved in this browser only" offer; calls `importLocalEntries` only when the user chooses **Add them** |
| `components/FilmSearch.tsx` | The `/log` title input as an ARIA combobox with iTunes suggestions; loading, nothing-found and unavailable states; never blocks a typed title |
| `components/Poster.tsx` | Decorative poster image (`next/image`, `unoptimized`); an empty frame when there's no artwork |
| `app/api/films/search/route.ts` | Signed-in iTunes search: validate `q`, cached fetch, trimmed and ranked results, 502 when unavailable |
| `lib/films.ts` | `Film` / `FilmLink` types, iTunes parsing, title relevance and ranking, artwork URL check (https `*.mzstatic.com` only) |
| `lib/combobox.ts` | Keyboard rules for the suggestion list (arrows, Enter, Escape, Tab) |
| `lib/supabase.ts` | `useSupabase()`: browser client with the publishable key and the Clerk session token; null until signed in |
| `supabase/migrations/` | Record of each migration applied through the Supabase MCP server |
| `lib/validate.ts` | Pure validators and the user-facing error messages |
| `lib/date.ts` | Local-day date helpers (never use `toISOString()` for days) |
| `e2e/` | Playwright: setup signs in two dedicated Clerk test users; specs for auth, diary, search, two-user isolation, import, and 375/320 px layouts. Test data is `E2E `-prefixed and removed by the test that made it |
| `playwright.config.ts` | Projects (desktop, mobile-375, mobile-320), dev server, loads `.env.local` via `@next/env` |
| `.claude/settings.json` | Denies agents read access to `.env` files |
| `docs/flows.md` | Mermaid diagram of the three flows (embedded in `README.md`) |
| `docs/RESEARCH.md` | Onboarding research and the design decisions it led to |

## Build phases (each needs the owner's go-ahead)
0. Deny rule + this file. 1. Clerk. 2. Supabase table, RLS, `lib/entries.ts` on Supabase. 3. `localStorage` import. 4. iTunes search on `/log`. 5. Playwright two-user test, watched failing first. 6. `/security-review`, then deploy as a **separate Vercel project** whose production branch is `assignment-4-fullstack`. `main` stays the Assignment 3 site: don't merge into it.

## Conventions
- Diary data goes through `lib/entries.ts` only, and only in effects or event handlers. Never during render.
- Error messages say what to do next ("Enter the film's title."), never "Invalid input". They appear next to the field and in the summary.
- Every field has a visible `<label>`. Use the `Field` primitive and native controls.
- Colors come from the `@theme` tokens in `app/globals.css`. Any new color pairing must keep text at ≥ 4.5:1 contrast (non-text ≥ 3:1). Note the ratio in the comment there.
- Keep commits small and conventional (`feat:`, `fix:`, `docs:`, `a11y:`, `chore:`), and run `npm test && npm run lint && npm run build` before each.
- Work on `assignment-4-fullstack`. Don't merge, deploy, push, or change the database without the owner's approval. Never merge into `main` (the live Assignment 3 site).
