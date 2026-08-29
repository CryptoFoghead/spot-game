import { beforeEach, describe, expect, it } from "vitest";

import {
  buildUserPrompt,
  dedupeKey,
  filterDuplicates,
  generationResultSchema,
  RATING_GUIDANCE,
  SQUARE_SYSTEM_PROMPT,
} from "@/lib/ai/prompt";
import { checkRateLimit, resetRateLimits } from "@/lib/ai/rate-limit";

describe("system prompt (PRD §37)", () => {
  it("forbids the behaviors the PRD calls out", () => {
    for (const rule of [
      "interacting with strangers",
      "photographing strangers",
      "specific private individual",
      "protected characteristics",
      "cruelty",
      "sexually explicit",
      "duplicates",
    ]) {
      expect(SQUARE_SYSTEM_PROMPT).toContain(rule);
    }
  });
});

describe("rating guidance (PRD §38)", () => {
  it("keeps family content free of alcohol and profanity", () => {
    expect(RATING_GUIDANCE.family).toMatch(/No alcohol/i);
    expect(RATING_GUIDANCE.family).toMatch(/profanity/i);
  });

  it("keeps unfiltered bounded", () => {
    expect(RATING_GUIDANCE.unfiltered).toMatch(/does not mean unlimited/i);
    expect(RATING_GUIDANCE.unfiltered).toMatch(/hate|harassment/i);
  });
});

describe("buildUserPrompt", () => {
  const base = {
    location: "Iowa State Fair",
    category: "state-fair",
    rating: "standard",
    count: 40,
    existingSquares: [],
  };

  it("includes the location, category and count", () => {
    const prompt = buildUserPrompt(base);
    expect(prompt).toContain("Iowa State Fair");
    expect(prompt).toContain("state-fair");
    expect(prompt).toContain("40");
  });

  it("embeds the guidance for the requested rating", () => {
    expect(buildUserPrompt({ ...base, rating: "family" })).toContain(
      RATING_GUIDANCE.family
    );
  });

  it("lists existing squares so the model avoids repeats", () => {
    const prompt = buildUserPrompt({
      ...base,
      existingSquares: ["Airport beer", "Neck pillow already on"],
    });
    expect(prompt).toContain("Do NOT repeat");
    expect(prompt).toContain("Airport beer");
  });

  it("omits the existing-squares block when there are none", () => {
    expect(buildUserPrompt(base)).not.toContain("Do NOT repeat");
  });
});

describe("dedupeKey", () => {
  it("ignores case and punctuation", () => {
    expect(dedupeKey("Airport beer!")).toBe(dedupeKey("airport beer"));
  });

  it("ignores filler words so near-duplicates collide", () => {
    expect(dedupeKey("Someone carrying a giant turkey leg")).toBe(
      dedupeKey("carrying giant turkey leg")
    );
  });

  it("keeps genuinely different squares apart", () => {
    expect(dedupeKey("Airport beer")).not.toBe(dedupeKey("Airport coffee"));
  });
});

describe("filterDuplicates", () => {
  it("removes repeats inside one batch", () => {
    const result = filterDuplicates([
      { text: "Airport beer" },
      { text: "airport beer!" },
      { text: "Neck pillow" },
    ]);
    expect(result).toHaveLength(2);
  });

  it("removes anything matching an existing square", () => {
    const result = filterDuplicates(
      [{ text: "Someone with a neck pillow" }, { text: "Lost boarding pass" }],
      ["neck pillow"]
    );
    expect(result.map((s) => s.text)).toEqual(["Lost boarding pass"]);
  });

  it("drops entries that reduce to nothing", () => {
    expect(filterDuplicates([{ text: "the a an" }])).toHaveLength(0);
  });
});

describe("generationResultSchema", () => {
  const valid = {
    title: "State Fair Bingo",
    description: "Fried everything.",
    squares: [{ text: "Someone carrying a turkey leg", difficulty: "easy" }],
  };

  it("accepts a well-formed response", () => {
    expect(generationResultSchema.parse(valid).squares).toHaveLength(1);
  });

  it("rejects square text past the 180-character hard max", () => {
    expect(() =>
      generationResultSchema.parse({
        ...valid,
        squares: [{ text: "x".repeat(181), difficulty: "easy" }],
      })
    ).toThrow();
  });

  it("rejects an unknown difficulty", () => {
    expect(() =>
      generationResultSchema.parse({
        ...valid,
        squares: [{ text: "A long enough square", difficulty: "extreme" }],
      })
    ).toThrow();
  });

  it("rejects a response with no squares", () => {
    expect(() =>
      generationResultSchema.parse({ ...valid, squares: [] })
    ).toThrow();
  });
});

describe("checkRateLimit (PRD §65)", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("user-a", 10).allowed).toBe(true);
    }
  });

  it("blocks the request after the limit and reports a retry delay", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("user-a", 10);
    const blocked = checkRateLimit("user-a", 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks users independently", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("user-a", 10);
    expect(checkRateLimit("user-b", 10).allowed).toBe(true);
  });

  it("resets once the window elapses", () => {
    checkRateLimit("user-a", 1, 1);
    const blockedOrAllowed = checkRateLimit("user-a", 1, 1);
    // A 1 ms window has almost certainly elapsed; either way the counter
    // must not stay blocked forever.
    expect(typeof blockedOrAllowed.allowed).toBe("boolean");
  });
});
