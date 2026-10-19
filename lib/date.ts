// Dates are stored as local calendar days ("YYYY-MM-DD"), never as UTC
// timestamps, so an evening viewing doesn't drift to the next day.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localToday(): string {
  return toDayString(new Date());
}

/** Parses "YYYY-MM-DD" as a local date. Returns null for malformed or impossible dates. */
export function parseDay(value: string): Date | null {
  const match = ISO_DAY.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function formatWatchedOn(value: string): string {
  const date = parseDay(value);
  if (!date) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
