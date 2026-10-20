# Onboarding research: Letterboxd, Day One, The StoryGraph

There were two rounds:
1. **Round 1** (before implementation, 19 Oct 2026): one quick web-search pass over the core logging flow and form design. It's further down this page.
2. **Round 2** (compliance audit, 20 Oct 2026): three parallel **subagents**, one per product. Each studied how the product welcomes someone new: the first screen, what it asks for, and how soon you get something useful.

Both rounds used public web pages only. No agent signed up for anything.

## Round 2: subagent study of first-run onboarding

| | Letterboxd | Day One | The StoryGraph |
|---|---|---|---|
| **First screen** | [Reported] After sign-up, a welcome page tells you to mark films you've seen from Popular. The logged-out landing page couldn't be fetched (403). | [Reported] A splash screen, then a sign-up screen (Sign in with Apple and others). | [Reported] After sign-up you're offered a Goodreads import and privacy preferences, then a home screen with recommendations, goals, challenges and popular books. |
| **What it asks for before value** | [Reported] An account (email or social login). Profile details are suggested, not required. No mandatory survey was found. | [Reported] An account, a social-proof screen, then a 30-day-trial paywall. The order of the reminder-permission prompt is unclear. [Verified] Core journaling is free. | [Reported] An account. The import and the preference survey are optional. |
| **Time to first useful thing** | [Reported] Fast: tap the "eye" on any poster to log a watch. [Verified] The log form is one screen (date, rating, like, tags, rewatch, privacy) with a single Save. | [Reported] You land on a list with a pre-written welcome entry and a floating "+". The editor is free text plus a date/time line. | [Reported] Search, then switch "to read" to "read". Every field (rating, dates, review, mood/pace) is optional, and quarter stars are allowed. |
| **Feedback after saving** | [Verified] The entry appears in your Diary and Films. [Assumption] No documented toast. | [Reported] Done / checkmark, then [Assumption] the entry appears in the timeline. | [Assumption] The book moves to your Read shelf and feeds Stats. |
| **What brings people back** | [Assumption] The social feed and lists. | [Verified] Reminders, streaks, and "On This Day". | [Reported] Stats, reading challenges, and recommendations. |

**Copied:**
- A first log that's one tap away, with one form screen and one Save (Letterboxd, Day One).
- Every field except the essentials optional (StoryGraph).
- Saying plainly that data stays on this device (Day One's privacy emphasis).
- A light "what you've done lately" readout that brings people back (Day One "On This Day", StoryGraph stats).

**Avoided:**
- Account creation, paywalls, import prompts and preference surveys before the first entry (all three).
- Social and privacy tiers (Letterboxd).
- A **pre-seeded sample entry** (Day One). We considered it and rejected it: a made-up film in a personal diary would be confusing, and the user would have to delete it.

**Design decisions this round led to** (built in the audit commits):
1. The returning visit now opens with **"Welcome back"**, the last film logged, how long ago, and this month's tally. This is our small, private version of "On This Day" and stats. → `components/Diary.tsx` (`SinceLastTime`)
2. The save banner offers **"Log another film"**, so a run of logs stays one tap each, like Letterboxd's quick log. → `components/Diary.tsx`
3. The first visit stays a single welcome with one action. There's no sign-up, survey, import or tour. → unchanged, confirmed by all three studies.

Round 2 sources: [Letterboxd FAQ](https://letterboxd.com/about/faq/), [Letterboxd welcome](https://letterboxd.com/welcome/), [Digital Citizen](https://www.digitalcitizen.life/letterboxd-how-to-find-and-review-movies-online/), [ScreensDesign: Day One](https://screensdesign.com/apps/day-one-journal-private-diary/), [Day One App Store](https://apps.apple.com/ae/app/id1055511498), [Day One guides](https://dayoneapp.com/guides/tips-and-tutorials/), [Popular Science: StoryGraph](https://www.popsci.com/diy/storygraph/), [Modern Mrs Darcy](https://modernmrsdarcy.com/271-episode/), [Book Riot](https://bookriot.com/do-goodreads-and-storygraph-users-rate-books-differently/).

---

## Round 1: logging flow and form design

A short pass done before implementation (October 2026), using web search only. I didn't sign up for any of the products. Each point is labelled:
**[Verified]** means it's backed by the product's own documentation or several independent sources. **[Reported]** means a single third-party source says so. **[Assumption]** means I'm inferring it and haven't confirmed it.

## Comparison

| | Letterboxd | Day One | The StoryGraph |
|---|---|---|---|
| **First-time onboarding** | Account required. [Assumption] The first-run experience centres on finding films and following people, not on the diary. | [Reported] Lands on a "Today" page from which you can start an entry. The first "welcome" entry also promotes upgrading, and a paywall follows. Reviewers say it shows too many features too early. | [Reported] Onboarding strongly features importing your Goodreads history. No source described any other first-run steps. |
| **Core logging flow** | [Verified] A persistent "+ Log" button (web) or "+" (app) records that you watched a film *on a date*, and each log builds the Diary. | [Assumption] A single "new entry" action opens a blank, free-form writing space. | [Reported] Marking a book "read" offers a review, which you can skip. |
| **Form design** | [Reported] Rating from 0.5 to 5 stars, a watch date, and an optional review text, all in one dialog. | [Assumption] Almost no structure: text first, with metadata (date, location) filled in automatically. | [Reported] Quarter-star ratings plus structured questions about mood, pace and characters. That gives rich data, but it's a long form. |
| **Feedback after saving** | [Assumption] The dialog closes and the entry appears in your Diary and activity feed. | [Assumption] The entry appears in the timeline straight away. | [Assumption] You land back on the book page, which now shows a "read" status. |

## Actionable findings → how they shape After the Credits

1. **Logging should be one action that's always visible.** Letterboxd's "+ Log" sits in the global navigation. → The header always shows **"Log a film"**, and on first visit the hero CTA *is* the logging action. There's no separate tour.
2. **Date is part of what makes it a diary.** Letterboxd's log is "watched *on a particular date*". → Date watched is required and **defaults to today**, so most users never need to change it.
3. **Keep the required fields few and make reflection optional.** StoryGraph's skippable review and Letterboxd's optional review both keep logging fast, and StoryGraph's many structured questions show what it costs to ask for more. → Only title, date and rating are required, and reflection is optional with a gentle prompt. We **don't** copy half or quarter stars yet; whole stars 1–5 are faster and easier to use with assistive tech.
4. **Onboarding shouldn't upsell or overwhelm.** Reviewers criticised Day One for putting the upgrade link in the welcome entry and introducing too many features at once. → The empty state does the onboarding: one sentence about what the diary is, one privacy note, one button. Nothing else appears until the first entry exists.
5. **Show the result straight away, in context.** [Assumption, based on common pattern] All three take you back to the place where the record lives. → After saving, go back to the diary with a confirmation banner and the new entry highlighted, instead of a separate "success" page.

## Sources
- [Letterboxd FAQ](https://letterboxd.com/about/faq/)
- [Digital Citizen: Letterboxd guide](https://www.digitalcitizen.life/letterboxd-how-to-find-and-review-movies-online/)
- [ScreensDesign: Day One showcase](https://screensdesign.com/showcase/day-one-journal-private-diary)
- [Pratt IXD: Design critique of Day One](https://ixd.prattsi.org/2026/09/design-critique-day-one-iphone-app/)
- [Book Riot: Goodreads vs StoryGraph ratings](https://bookriot.com/do-goodreads-and-storygraph-users-rate-books-differently/)
- [TCK Publishing: StoryGraph review](https://www.tckpublishing.com/storygraph-review/)
