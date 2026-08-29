import { describe, expect, it } from "vitest";

import { gameSettingsSchema, squareSchema } from "@/lib/validation/game";

const validSettings = {
  title: "Iowa State Fair Bingo",
  description: "Fried everything.",
  category: "state-fair",
  content_rating: "standard",
  visibility: "public",
};

describe("gameSettingsSchema", () => {
  it("accepts valid settings", () => {
    expect(gameSettingsSchema.parse(validSettings)).toMatchObject({
      title: "Iowa State Fair Bingo",
    });
  });

  it("rejects a 2-character title", () => {
    expect(() =>
      gameSettingsSchema.parse({ ...validSettings, title: "ab" })
    ).toThrow();
  });

  it("rejects an 81-character title", () => {
    expect(() =>
      gameSettingsSchema.parse({ ...validSettings, title: "x".repeat(81) })
    ).toThrow();
  });

  it("trims and accepts a title that fits after trimming", () => {
    const parsed = gameSettingsSchema.parse({
      ...validSettings,
      title: "  abc  ",
    });
    expect(parsed.title).toBe("abc");
  });

  it("turns an empty description into null", () => {
    const parsed = gameSettingsSchema.parse({ ...validSettings, description: "" });
    expect(parsed.description).toBeNull();
  });

  it("rejects a 301-character description", () => {
    expect(() =>
      gameSettingsSchema.parse({ ...validSettings, description: "x".repeat(301) })
    ).toThrow();
  });

  it("rejects an unknown content rating", () => {
    expect(() =>
      gameSettingsSchema.parse({ ...validSettings, content_rating: "explicit" })
    ).toThrow();
  });

  it("rejects an unknown visibility", () => {
    expect(() =>
      gameSettingsSchema.parse({ ...validSettings, visibility: "secret" })
    ).toThrow();
  });
});

describe("squareSchema", () => {
  it("accepts a normal square", () => {
    expect(squareSchema.parse({ text: "Airport beer", difficulty: "easy" })).toEqual({
      text: "Airport beer",
      difficulty: "easy",
    });
  });

  it("rejects 1-character text", () => {
    expect(() => squareSchema.parse({ text: "a", difficulty: "" })).toThrow();
  });

  it("rejects 181-character text", () => {
    expect(() =>
      squareSchema.parse({ text: "x".repeat(181), difficulty: "" })
    ).toThrow();
  });

  it("accepts 180-character text (hard max)", () => {
    expect(squareSchema.parse({ text: "x".repeat(180), difficulty: "" }).text).toHaveLength(
      180
    );
  });

  it("maps empty difficulty to null", () => {
    expect(squareSchema.parse({ text: "ok", difficulty: "" }).difficulty).toBeNull();
  });

  it("rejects an invalid difficulty", () => {
    expect(() => squareSchema.parse({ text: "ok", difficulty: "extreme" })).toThrow();
  });
});
