import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "@/lib/env";

const validClient = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc123.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
};

describe("parseClientEnv", () => {
  it("accepts a valid client environment", () => {
    expect(parseClientEnv(validClient)).toEqual(validClient);
  });

  it("rejects a missing Supabase URL, naming the variable", () => {
    const rest = { ...validClient, NEXT_PUBLIC_SUPABASE_URL: undefined };
    expect(() => parseClientEnv(rest)).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a malformed site URL", () => {
    expect(() =>
      parseClientEnv({ ...validClient, NEXT_PUBLIC_SITE_URL: "not-a-url" })
    ).toThrowError(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe("parseServerEnv", () => {
  const validServer = { ...validClient, SUPABASE_SECRET_KEY: "sb_secret_abc123" };

  it("accepts a valid server environment", () => {
    expect(parseServerEnv(validServer)).toMatchObject(validServer);
  });

  it("rejects a missing secret key, naming the variable", () => {
    expect(() => parseServerEnv(validClient)).toThrowError(/SUPABASE_SECRET_KEY/);
  });

  it("treats later-phase variables as optional", () => {
    expect(() => parseServerEnv(validServer)).not.toThrow();
  });

  // A blank line waiting for a value ("AI_API_KEY=") means not configured.
  // Treating it as an invalid value would take down every serverEnv() caller,
  // not just the feature that needs the key.
  it("treats a blank optional variable as unset", () => {
    const parsed = parseServerEnv({ ...validServer, AI_API_KEY: "" });
    expect(parsed.AI_API_KEY).toBeUndefined();
  });

  it("treats a whitespace-only optional variable as unset", () => {
    expect(parseServerEnv({ ...validServer, AI_API_KEY: "   " }).AI_API_KEY).toBeUndefined();
  });

  it("still rejects a blank required variable, naming it", () => {
    expect(() =>
      parseServerEnv({ ...validServer, SUPABASE_SECRET_KEY: "" })
    ).toThrowError(/SUPABASE_SECRET_KEY/);
  });
});
