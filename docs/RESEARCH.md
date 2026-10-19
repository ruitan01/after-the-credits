# Onboarding research: Letterboxd, Day One, The StoryGraph

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
