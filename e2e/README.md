# End-to-end tests (Playwright)

```bash
npm run test:e2e                                   # everything: desktop, 375 px, 320 px
npx playwright test e2e/isolation.spec.ts          # one file
npx playwright show-report                         # last HTML report
E2E_ISOLATION_SELF_CHECK=1 npx playwright test e2e/isolation.spec.ts   # must FAIL (see below)
```

Playwright starts `npm run dev` on port 3000, or reuses one that's already running.

## One-time setup (owner)

The tests sign in as **two dedicated Clerk test users**, never as a real account,
so they can create and delete entries freely without touching a real diary.

1. Clerk Dashboard → this app → **Development** instance → **Users** → **Create user**.
   Create two users with addresses that receive no mail, such as
   `<your-test-name-a>+clerk_test@example.com` and `<your-test-name-b>+clerk_test@example.com`.
   Pick your own names and keep them out of the repository. If a password is
   required, any strong one will do; the tests don't use it.
2. Add to `.env.local` (git-ignored):
   ```
   E2E_USER_A_EMAIL=<test user A's email>
   E2E_USER_B_EMAIL=<test user B's email>
   ```
3. Keep Clerk **Test mode** off (Dashboard → Development instance → Settings).
   The tests sign in with one-time tickets created with `CLERK_SECRET_KEY`, so they
   don't need test mode. With it off, nobody can sign in to these accounts with
   Clerk's fixed test code.

`CLERK_SECRET_KEY` is already in `.env.local`. The test process loads it the
same way `next dev` does, to get a Clerk testing token (so bot protection
doesn't block automation) and a one-time sign-in ticket per test user. It's
never printed or written anywhere. The signed-in browser state is saved in
`e2e/.auth/` (git-ignored, contains session cookies).

## What's covered

| File | Covers |
|---|---|
| `auth.spec.ts` | Signed-out welcome, `/log` redirect, search API and database refuse signed-out callers; signed-in header |
| `diary.spec.ts` | Log → banner → card → reload → delete; Keep it; validation and focus; drafts; database down on save and on load |
| `search.spec.ts` | Suggestions, linking, unlinking, drafts with a film; keyboard; nothing found; 502/429/401/offline/slow search never block a typed title; live iTunes |
| `isolation.spec.ts` | Two users: no reading, changing, deleting, or inserting as each other (both directions); no access without a session |
| `import.spec.ts` | localStorage import: offer, Not now, preserved fields, backup, no duplicates on retry, refused for a second account, failure leaves storage untouched |
| `mobile.spec.ts` | 375 px and 320 px: no sideways scroll, suggestions fit and are tappable (≥ 44 px), linked card fits, 16 px input |

## Test data

Every entry the tests create has a title starting `E2E <run id>`, and each test
deletes exactly the titles or ids it created, as their owner. `deleteTitles`
refuses any title that doesn't start with `E2E `. Search is stubbed in the
browser except in the "live iTunes" tests, to stay well under Apple's rate limit.

## Watching the isolation test fail

`E2E_ISOLATION_SELF_CHECK=1` makes "the other user" the owner. The same
assertions then see the entry, so the test fails. That shows it would catch a
real leak, without weakening row-level security to prove it.
