// Keyboard rules for the title field's suggestion list (ARIA combobox pattern).
// Focus stays in the input; the highlighted option is tracked by index.

export type ListState = { open: boolean; count: number; active: number };

export type KeyAction =
  | { type: "move"; active: number; prevent: true }
  | { type: "select"; index: number; prevent: true }
  | { type: "close"; prevent: boolean };

/** What a key does to the list, or null to let the browser handle it (e.g. Enter submits the form). */
export function comboboxKey(key: string, { open, count, active }: ListState): KeyAction | null {
  switch (key) {
    case "ArrowDown":
      if (count === 0) return null;
      return { type: "move", active: open ? (active + 1) % count : 0, prevent: true };
    case "ArrowUp":
      if (count === 0) return null;
      return { type: "move", active: open && active > 0 ? active - 1 : count - 1, prevent: true };
    case "Enter":
      // Only a highlighted option is chosen; otherwise Enter submits as before.
      return open && active >= 0 && active < count ? { type: "select", index: active, prevent: true } : null;
    case "Escape":
      return open ? { type: "close", prevent: true } : null;
    case "Tab":
      // Close, but let focus move on normally.
      return open ? { type: "close", prevent: false } : null;
    default:
      return null;
  }
}
