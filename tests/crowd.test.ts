import { describe, expect, it } from "vitest";

import { assignHues, hueFor } from "@/lib/crowd";

describe("assignHues", () => {
  it("gives every player in a small room a different hue", () => {
    const ids = ["a", "b", "c", "d"];
    const hues = assignHues(ids);
    const fills = ids.map((id) => hues.get(id)!.fill);
    expect(new Set(fills).size).toBe(4);
  });

  it("fills the whole palette before repeating", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const fills = [...assignHues(ids).values()].map((h) => h.fill);
    expect(new Set(fills).size).toBe(5);
  });

  it("is stable regardless of the order players are passed in", () => {
    const a = assignHues(["x", "y", "z"]);
    const b = assignHues(["z", "x", "y"]);
    for (const id of ["x", "y", "z"]) {
      expect(a.get(id)!.fill).toBe(b.get(id)!.fill);
    }
  });

  it("wraps past the palette size rather than failing", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const hues = assignHues(ids);
    expect(hues.size).toBe(12);
    for (const id of ids) expect(hues.get(id)?.fill).toBeTruthy();
  });

  it("never pairs white text with a hue that fails contrast", () => {
    // Only the violet is dark enough for white; the rest carry ink.
    const ids = Array.from({ length: 5 }, (_, i) => `p${i}`);
    for (const hue of assignHues(ids).values()) {
      if (hue.on === "white") expect(hue.fill).toBe("var(--spot)");
    }
  });
});

describe("hueFor", () => {
  it("is stable for the same key", () => {
    expect(hueFor("airport").fill).toBe(hueFor("airport").fill);
  });

  it("spreads different categories across the palette", () => {
    const keys = ["airport", "bar", "wedding", "tailgate", "grocery-store"];
    const fills = keys.map((k) => hueFor(k).fill);
    expect(new Set(fills).size).toBeGreaterThan(1);
  });
});
