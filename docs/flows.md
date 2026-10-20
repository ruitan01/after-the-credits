# User flows

**The main task in one sentence:**
I watch a film → I log it while it's fresh → I come back next week, and it's still in my diary.

```mermaid
flowchart TD
    subgraph F1["1 · First visit"]
        A["Open / with nothing saved"] --> B["Welcome: what it is, plus<br/>'Entries stay in this browser'"]
        B --> C["Log your first film"]
    end

    subgraph F2["2 · Core task: log a film at /log"]
        D["Title focused · date defaults to today"] --> E["Choose a 1–5 star rating<br/>add an optional reflection"]
        E --> F{"Save to diary"}
        F -- "invalid" --> G["Error beside each field and in a summary<br/>focus moves to the first one<br/>everything typed is kept"]
        G --> E
        F -- "valid" --> H["Saved to localStorage<br/>draft cleared"]
        D -. "leave mid-entry" .-> X["Draft kept · restored on return<br/>with a 'Start over' option"]
    end

    subgraph F3["3 · Returning visit"]
        I["Diary: banner '‹Title› is now in your diary'<br/>new entry highlighted"]
        J["Come back days later → / reads localStorage"] --> K["Welcome back: last film logged,<br/>days since, this month's tally"]
        K --> L["Entries newest first · delete with confirmation"]
    end

    C --> D
    H --> I
    I -- "Log another film" --> D
    K -- "Log what you've watched since" --> D
```

| Step | Route | Key states |
|---|---|---|
| First visit | `/` | loading placeholder → welcome (empty state is the onboarding) |
| Log a film | `/log` | empty · restored draft · field errors + summary · saving · storage-write failure |
| Diary | `/` | just-saved banner · welcome back · deleted notice · corrupt data set aside · storage blocked |
