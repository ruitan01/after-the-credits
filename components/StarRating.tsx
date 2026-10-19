"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  errorId: string;
};

const LABELS = ["", "Not for me", "Had its moments", "Good", "Really good", "Unforgettable"];

export function Star({ filled, className = "" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StarRating({ value, onChange, onBlur, error, errorId }: Props) {
  const [hovered, setHovered] = useState(0);
  const selected = Number(value) || 0;
  const shown = hovered || selected;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-2">
      <legend className="mb-2 font-medium text-ivory">Rating</legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          className="flex"
          // Leaving the group (not moving between stars) counts as a blur.
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur();
          }}
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHovered(n)}
              className="cursor-pointer rounded-md p-1 text-amber has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-amber"
            >
              <input
                type="radio"
                name="rating"
                id={n === 1 ? "rating" : undefined}
                value={n}
                checked={selected === n}
                onChange={() => onChange(String(n))}
                className="sr-only"
              />
              <span className="sr-only">
                {n} out of 5 — {LABELS[n]}
              </span>
              <Star
                filled={n <= shown}
                className={`size-9 transition-transform ${n <= shown ? "" : "text-seam-strong"} ${
                  hovered === n ? "scale-110" : ""
                }`}
              />
            </label>
          ))}
        </div>
        <p className="text-sm text-parchment" aria-hidden="true">
          {shown ? `${shown} / 5 · ${LABELS[shown]}` : "Choose 1 to 5 stars"}
        </p>
      </div>
      {error && <FieldError id={errorId} message={error} />}
    </fieldset>
  );
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="flex items-start gap-2 text-sm font-medium text-ember">
      <span aria-hidden="true" className="mt-px font-bold">
        !
      </span>
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </p>
  );
}
