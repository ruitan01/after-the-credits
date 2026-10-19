# After the Credits

A quiet, private diary for the films you've watched. Write down the title, when you saw it, a rating, and a line about how it stayed with you. Everything stays in your own browser.

Built for MPCS 51238 *Design, Build, Ship*, Assignment 3: "Patterns & Flows: An Everyday Tool". It uses Next.js (App Router), Tailwind CSS v4, and `localStorage`. There's no backend, no account and no external APIs.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest: validation, dates, storage helpers
npm run lint
npm run build
```

## The three flows

1. **First visit:** `/` with an empty diary shows a short introduction, a privacy note, and one action, **Log your first film**. That action opens `/log` with the cursor already in the title field.
2. **Core task:** `/log` has four labelled fields: **Film title**, **Date watched** (defaults to today), **Rating** (1–5 stars, using native radio buttons), and an optional **Reflection** (up to 500 characters). Errors appear next to each field and in a summary at the top, and focus moves to the first problem. When the entry is valid, it's saved and you return to the diary with a confirmation banner and the new entry highlighted.
3. **Returning visit:** `/` reads `localStorage` after the page loads, showing a loading placeholder first, so returning visitors never see the empty state flash. Entries are listed newest viewing date first, and **Log a film** is always in the header.

## Decisions

- **Two routes only.** The empty state works as the onboarding, and each card shows the full reflection, so there's no detail page.
- **Storage** (`lib/entries.ts`): uses the key `after-the-credits:entries:v1`. Each read checks the shape of every entry. If stored data can't be read, it's copied to a `…:corrupt-<timestamp>` key rather than deleted. Every write re-reads storage first, so a second tab's entries aren't overwritten. Blocked storage gets a clear notice, and a failed save keeps everything the user typed.
- **Dates** are stored as local `YYYY-MM-DD` days, never UTC timestamps, so a late-evening viewing doesn't move to the next day.
- **Accessibility:** visible labels and hints, `aria-invalid` / `aria-describedby` on fields, errors marked with text and not only color, a skip link, amber focus rings, `prefers-reduced-motion` support, and a palette whose contrast ratios are documented in `app/globals.css`.
- **Postponed:** editing, search and filters, half-star ratings, tags and posters, import/export, and stats.

Research notes that shaped these decisions are in [`docs/RESEARCH.md`](docs/RESEARCH.md).
