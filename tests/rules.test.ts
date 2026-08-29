import { describe, expect, it } from "vitest";

import { minimumSquares } from "@/lib/game/rules";
import { slugify, slugSuffix } from "@/lib/slug";

describe("minimumSquares", () => {
  it("is 24 for a 5x5 card with a FREE center", () => {
    expect(minimumSquares(5, true)).toBe(24);
  });

  it("is 25 for a 5x5 card without a FREE center", () => {
    expect(minimumSquares(5, false)).toBe(25);
  });

  it("scales with card size", () => {
    expect(minimumSquares(3, true)).toBe(8);
    expect(minimumSquares(7, false)).toBe(49);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Iowa State Fair Bingo")).toBe("iowa-state-fair-bingo");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Bar & Brewery  Bingo!")).toBe("bar-brewery-bingo");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Wedding--  ")).toBe("wedding");
  });

  it("caps length at 60 characters without a trailing hyphen", () => {
    const slug = slugify("word ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugSuffix", () => {
  it("produces short url-safe suffixes", () => {
    for (let i = 0; i < 20; i++) {
      expect(slugSuffix()).toMatch(/^[a-z0-9]{1,4}$/);
    }
  });
});
