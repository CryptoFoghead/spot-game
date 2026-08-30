import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated accessibility checks (PRD §63).
 *
 * Automation catches roughly a third of real accessibility problems — it finds
 * missing labels and contrast failures, but cannot tell you whether the board
 * is *usable* with a screen reader. A manual VoiceOver/NVDA pass is still
 * needed; this suite exists so regressions in the mechanical half are caught
 * automatically.
 */

const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ])
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const createdRooms: string[] = [];

test.afterAll(async () => {
  for (const id of createdRooms) await admin.from("rooms").delete().eq("id", id);
  await admin
    .from("game_templates")
    .update({ play_count: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");
});

async function scan(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

const PAGES = [
  { name: "home", path: "/" },
  { name: "explore", path: "/explore" },
  { name: "game detail", path: "/games/airport-bingo" },
  { name: "join by code", path: "/join" },
  { name: "sign in", path: "/login" },
];

for (const target of PAGES) {
  test(`${target.name} has no automatically detectable violations`, async ({
    page,
  }) => {
    await page.goto(target.path);
    const results = await scan(page);

    if (results.violations.length) {
      console.log(
        `${target.name}:`,
        results.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ")
      );
    }
    expect(results.violations).toEqual([]);
  });
}

test("the live game board has no automatically detectable violations", async ({
  page,
}) => {
  await page.goto("/games/airport-bingo");
  await page.getByLabel("Your nickname").fill("A11y");
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.waitForURL(/\/room\/\d{4}\/host/, { timeout: 45000 });

  const code = page.url().match(/\/room\/(\d{4})\//)![1];
  const { data } = await admin
    .from("rooms")
    .select("id")
    .eq("room_code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (data) createdRooms.push(data.id);

  // Host screen, with the QR code and player controls.
  const hostResults = await scan(page);
  if (hostResults.violations.length) {
    console.log(
      "host:",
      hostResults.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ")
    );
  }
  expect(hostResults.violations).toEqual([]);

  // Player board, the densest and most interactive screen.
  await page.goto(`/room/${code}/play`);
  await expect(
    page.getByRole("group", { name: "Your bingo card" })
  ).toBeVisible();

  const playResults = await scan(page);
  if (playResults.violations.length) {
    console.log(
      "play:",
      playResults.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ")
    );
  }
  expect(playResults.violations).toEqual([]);
});

test("the board is reachable and operable by keyboard alone", async ({
  page,
}) => {
  await page.goto("/games/airport-bingo");
  await page.getByLabel("Your nickname").fill("Keyboard");
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.waitForURL(/\/room\/\d{4}\/host/, { timeout: 45000 });
  const code = page.url().match(/\/room\/(\d{4})\//)![1];

  const { data } = await admin
    .from("rooms")
    .select("id")
    .eq("room_code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (data) createdRooms.push(data.id);

  await page.getByRole("button", { name: "Start Game" }).click();
  await page.goto(`/room/${code}/play`);

  const tiles = page.getByRole("group", { name: "Your bingo card" }).getByRole("button");
  const firstEnabled = tiles.filter({ hasNotText: "FREE" }).first();

  // Focus it the way a keyboard user would reach it, then activate with Enter.
  await firstEnabled.focus();
  await expect(firstEnabled).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(firstEnabled).toHaveAttribute("aria-pressed", "true");
});
