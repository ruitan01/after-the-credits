import { parseDay } from "./date";

export const TITLE_MAX = 120;
export const REFLECTION_MAX = 500;
export const EARLIEST_DAY = "1888-01-01";

export type EntryFormValues = {
  title: string;
  watchedOn: string;
  rating: string; // "" until a star is chosen
  reflection: string;
};

export type EntryField = keyof EntryFormValues;
export type EntryErrors = Partial<Record<EntryField, string>>;

/** Field order matters: it decides which invalid field receives focus first. */
export const FIELD_ORDER: EntryField[] = ["title", "watchedOn", "rating", "reflection"];

export function validateTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) return "Enter the film's title.";
  if (trimmed.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
}

export function validateWatchedOn(watchedOn: string, today: string): string | undefined {
  if (!watchedOn) return "Choose the date you watched it.";
  if (!parseDay(watchedOn)) return "Enter a real date, like 12/10/2026.";
  // Same-format day strings compare correctly as plain strings.
  if (watchedOn > today) return "That date hasn't happened yet.";
  if (watchedOn < EARLIEST_DAY) return "Films didn't exist before 1888. Check the year.";
}

export function validateRating(rating: string): string | undefined {
  const n = Number(rating);
  if (!rating || !Number.isInteger(n) || n < 1 || n > 5) return "Choose a rating from 1 to 5.";
}

export function validateReflection(reflection: string): string | undefined {
  const length = reflection.length;
  if (length > REFLECTION_MAX) {
    return `Keep your reflection under ${REFLECTION_MAX} characters (you're at ${length}).`;
  }
}

export function validateField(
  field: EntryField,
  values: EntryFormValues,
  today: string,
): string | undefined {
  switch (field) {
    case "title":
      return validateTitle(values.title);
    case "watchedOn":
      return validateWatchedOn(values.watchedOn, today);
    case "rating":
      return validateRating(values.rating);
    case "reflection":
      return validateReflection(values.reflection);
  }
}

export function validateEntry(values: EntryFormValues, today: string): EntryErrors {
  const errors: EntryErrors = {};
  for (const field of FIELD_ORDER) {
    const message = validateField(field, values, today);
    if (message) errors[field] = message;
  }
  return errors;
}
