"use client";

import { useState } from "react";
import { Star } from "@/components/StarRating";
import { Button } from "@/components/ui";
import { formatWatchedOn } from "@/lib/date";
import type { Entry } from "@/lib/entries";

type Props = {
  entry: Entry;
  highlighted?: boolean;
  onDelete: (entry: Entry) => void;
};

export default function EntryCard({ entry, highlighted = false, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <article
      aria-labelledby={`entry-${entry.id}-title`}
      className={`rounded-xl border border-seam bg-reel/80 p-5 sm:p-6 ${highlighted ? "animate-glow" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`entry-${entry.id}-title`} className="font-serif text-2xl leading-snug tracking-tight text-ivory">
          {entry.title}
        </h2>
        <time dateTime={entry.watchedOn} className="text-sm text-parchment">
          {formatWatchedOn(entry.watchedOn)}
        </time>
      </div>
      <p className="mt-2 flex items-center gap-0.5 text-amber">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= entry.rating} className={`size-4 ${n <= entry.rating ? "" : "text-seam-strong"}`} />
        ))}
        <span className="sr-only">Rated {entry.rating} out of 5</span>
      </p>
      {entry.reflection && (
        <p className="mt-4 border-l-2 border-amber/40 pl-4 font-serif text-lg leading-relaxed whitespace-pre-line text-ivory/90 italic">
          {entry.reflection}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm">
        {confirming ? (
          <>
            <span className="text-parchment">Delete this entry? This can&rsquo;t be undone.</span>
            <Button variant="danger" size="sm" onClick={() => onDelete(entry)}>
              Delete
            </Button>
            <Button
              variant="quiet"
              size="sm"
              // Focusing the replacement button keeps keyboard users in place.
              autoFocus
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded px-1 text-parchment underline-offset-4 hover:text-ivory hover:underline"
          >
            Delete<span className="sr-only"> {entry.title}</span>
          </button>
        )}
      </div>
    </article>
  );
}
