import { describe, expect, it } from "vitest";
import { comboboxKey } from "./combobox";

const list = (active: number, open = true, count = 3) => ({ open, count, active });

describe("comboboxKey", () => {
  it("moves through options with the arrow keys, wrapping at the ends", () => {
    expect(comboboxKey("ArrowDown", list(-1))).toEqual({ type: "move", active: 0, prevent: true });
    expect(comboboxKey("ArrowDown", list(2))).toEqual({ type: "move", active: 0, prevent: true });
    expect(comboboxKey("ArrowUp", list(0))).toEqual({ type: "move", active: 2, prevent: true });
    expect(comboboxKey("ArrowUp", list(-1))).toEqual({ type: "move", active: 2, prevent: true });
  });

  it("reopens a closed list with the arrow keys", () => {
    expect(comboboxKey("ArrowDown", list(1, false))).toEqual({ type: "move", active: 0, prevent: true });
    expect(comboboxKey("ArrowUp", list(1, false))).toEqual({ type: "move", active: 2, prevent: true });
  });

  it("chooses the highlighted option with Enter", () => {
    expect(comboboxKey("Enter", list(1))).toEqual({ type: "select", index: 1, prevent: true });
  });

  it("lets Enter submit the form when nothing is highlighted, so a typed title can always be saved", () => {
    expect(comboboxKey("Enter", list(-1))).toBeNull();
    expect(comboboxKey("Enter", list(1, false))).toBeNull();
    expect(comboboxKey("Enter", { open: true, count: 0, active: -1 })).toBeNull();
  });

  it("leaves the arrow keys alone when there's nothing to choose (no results, or search unavailable)", () => {
    expect(comboboxKey("ArrowDown", { open: true, count: 0, active: -1 })).toBeNull();
    expect(comboboxKey("ArrowUp", { open: false, count: 0, active: -1 })).toBeNull();
  });

  it("closes with Escape, and with Tab without trapping focus", () => {
    expect(comboboxKey("Escape", list(1))).toEqual({ type: "close", prevent: true });
    expect(comboboxKey("Tab", list(1))).toEqual({ type: "close", prevent: false });
    expect(comboboxKey("Escape", list(-1, false))).toBeNull();
    expect(comboboxKey("Tab", list(-1, false))).toBeNull();
  });

  it("ignores other keys, so typing and editing work as usual", () => {
    for (const key of ["a", "Backspace", "Home", "End", "ArrowLeft", "ArrowRight", " "]) {
      expect(comboboxKey(key, list(1))).toBeNull();
    }
  });
});
