import { describe, expect, it } from "vitest";

import {
  completedSets,
  hasBingo,
  scoreFrom,
  winningSets,
} from "@/lib/game/bingo";

// PRD §72 mandatory unit tests: every row, every column, both diagonals,
// no false bingo, FREE center, blackout.

const SIZE = 5;
const FREE_CENTER = 12;
const ALL = Array.from({ length: 25 }, (_, i) => i);

describe("winningSets (5x5)", () => {
  it("has 12 sets: 5 rows, 5 columns, 2 diagonals", () => {
    expect(winningSets(SIZE)).toHaveLength(12);
  });

  it("matches the position sets from the PRD", () => {
    const sets = winningSets(SIZE);
    expect(sets[0]).toEqual([0, 1, 2, 3, 4]);
    expect(sets[4]).toEqual([20, 21, 22, 23, 24]);
    expect(sets[5]).toEqual([0, 5, 10, 15, 20]);
    expect(sets[9]).toEqual([4, 9, 14, 19, 24]);
    expect(sets[10]).toEqual([0, 6, 12, 18, 24]);
    expect(sets[11]).toEqual([4, 8, 12, 16, 20]);
  });

  it("every set is exactly card-size long", () => {
    for (const set of winningSets(SIZE)) expect(set).toHaveLength(SIZE);
  });
});

describe("hasBingo — rows", () => {
  for (let row = 0; row < SIZE; row++) {
    it(`detects row ${row}`, () => {
      const positions = Array.from({ length: SIZE }, (_, c) => row * SIZE + c);
      expect(hasBingo(positions, SIZE)).toBe(true);
    });
  }
});

describe("hasBingo — columns", () => {
  for (let col = 0; col < SIZE; col++) {
    it(`detects column ${col}`, () => {
      const positions = Array.from({ length: SIZE }, (_, r) => r * SIZE + col);
      expect(hasBingo(positions, SIZE)).toBe(true);
    });
  }
});

describe("hasBingo — diagonals", () => {
  it("detects the top-left to bottom-right diagonal", () => {
    expect(hasBingo([0, 6, 12, 18, 24], SIZE)).toBe(true);
  });

  it("detects the top-right to bottom-left diagonal", () => {
    expect(hasBingo([4, 8, 12, 16, 20], SIZE)).toBe(true);
  });
});

describe("hasBingo — no false positives", () => {
  it("is false for an empty card", () => {
    expect(hasBingo([], SIZE)).toBe(false);
  });

  it("is false for four of five in a row", () => {
    expect(hasBingo([0, 1, 2, 3], SIZE)).toBe(false);
  });

  it("is false for four of five in a column", () => {
    expect(hasBingo([0, 5, 10, 15], SIZE)).toBe(false);
  });

  it("is false for a broken diagonal", () => {
    expect(hasBingo([0, 6, 18, 24], SIZE)).toBe(false);
  });

  it("is false for scattered marks that touch every line", () => {
    expect(hasBingo([0, 6, 13, 19, 20, 2, 8], SIZE)).toBe(false);
  });

  // Leaving the anti-diagonal unmarked breaks all 12 lines, so 20 of 25
  // squares can be marked with no bingo. (24 of 25 always wins — removing a
  // single square cannot break every line.)
  it("is false for 20 of 25 marked when the anti-diagonal is empty", () => {
    const antiDiagonal = new Set([4, 8, 12, 16, 20]);
    const marks = ALL.filter((p) => !antiDiagonal.has(p));
    expect(marks).toHaveLength(20);
    expect(hasBingo(marks, SIZE)).toBe(false);
  });
});

describe("hasBingo — FREE center", () => {
  it("counts the FREE center toward the middle row", () => {
    expect(hasBingo([10, 11, FREE_CENTER, 13, 14], SIZE)).toBe(true);
  });

  it("counts the FREE center toward a diagonal", () => {
    expect(hasBingo([0, 6, FREE_CENTER, 18, 24], SIZE)).toBe(true);
  });

  it("does not win on the FREE center alone", () => {
    expect(hasBingo([FREE_CENTER], SIZE)).toBe(false);
  });
});

describe("hasBingo — blackout", () => {
  it("needs every position", () => {
    expect(hasBingo(ALL, SIZE, "blackout")).toBe(true);
  });

  it("is false with one square missing", () => {
    expect(hasBingo(ALL.filter((p) => p !== 24), SIZE, "blackout")).toBe(false);
  });

  it("is false for a single completed line", () => {
    expect(hasBingo([0, 1, 2, 3, 4], SIZE, "blackout")).toBe(false);
  });
});

describe("hasBingo — other card sizes", () => {
  it("works on a 3x3 card", () => {
    expect(hasBingo([0, 4, 8], 3)).toBe(true);
    expect(hasBingo([0, 4], 3)).toBe(false);
  });

  it("works on a 7x7 card", () => {
    const row = Array.from({ length: 7 }, (_, c) => c);
    expect(hasBingo(row, 7)).toBe(true);
    expect(hasBingo(row.slice(0, 6), 7)).toBe(false);
  });
});

describe("completedSets", () => {
  it("returns each completed line", () => {
    const marks = [0, 1, 2, 3, 4, 5, 10, 15, 20];
    const sets = completedSets(marks, SIZE);
    expect(sets).toHaveLength(2); // top row + left column
  });

  it("returns nothing when no line is complete", () => {
    expect(completedSets([0, 1, 2], SIZE)).toHaveLength(0);
  });
});

describe("scoreFrom", () => {
  it("excludes the FREE square", () => {
    const squares = [
      { marked: true, isFree: true },
      { marked: true, isFree: false },
      { marked: true, isFree: false },
      { marked: false, isFree: false },
    ];
    expect(scoreFrom(squares)).toBe(2);
  });

  it("is zero for a fresh card with only FREE marked", () => {
    expect(scoreFrom([{ marked: true, isFree: true }])).toBe(0);
  });
});
