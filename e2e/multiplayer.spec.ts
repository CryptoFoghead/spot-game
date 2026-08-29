import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * PRD §73 mandatory end-to-end scenario:
 *
 *   host starts a room -> player A joins -> player B joins -> host starts ->
 *   A marks squares -> B sees A's progress live -> A gets bingo ->
 *   B sees the bingo alert -> host ends the room
 *
 * "If this test fails, product is not release-ready."
 *
 * Each participant gets its own browser context, so guest cookies are truly
 * isolated — the thing that cannot be simulated in a single browser profile.
 */

const envPath = path.resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ])
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdRoomIds: string[] = [];

test.afterAll(async () => {
  for (const id of createdRoomIds) {
    await admin.from("rooms").delete().eq("id", id);
  }
  await admin
    .from("game_templates")
    .update({ play_count: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");
});

/**
 * Against a deployment the first request can hit a cold start, and the click
 * must land after hydration or the handler isn't attached yet. Both are far
 * slower than localhost, so navigation waits are explicit and generous.
 */
const NAV_TIMEOUT = 45_000;

/** Starts a room from a public game as an anonymous visitor (PRD §80). */
async function hostStartsRoom(page: Page, nickname: string) {
  await page.goto("/games/airport-bingo");
  await page.getByLabel("Your nickname").fill(nickname);
  await page.getByRole("button", { name: "Start Game" }).click();

  await page.waitForURL(/\/room\/\d{4}\/host/, { timeout: NAV_TIMEOUT });
  const roomCode = page.url().match(/\/room\/(\d{4})\//)![1];

  const { data } = await admin
    .from("rooms")
    .select("id")
    .eq("room_code", roomCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (data) createdRoomIds.push(data.id);

  return roomCode;
}

async function playerJoins(page: Page, roomCode: string, nickname: string) {
  await page.goto(`/join/${roomCode}`);
  await page.getByLabel("Your nickname").fill(nickname);
  await page.getByRole("button", { name: "Join Game" }).click();
  await page.waitForURL(`**/room/${roomCode}/play`, { timeout: NAV_TIMEOUT });
}

function boardTiles(page: Page) {
  return page.getByRole("group", { name: "Your bingo card" }).getByRole("button");
}

test("two players complete a live multiplayer game", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerAContext = await browser.newContext();
  const playerBContext = await browser.newContext();

  const host = await hostContext.newPage();
  const playerA = await playerAContext.newPage();
  const playerB = await playerBContext.newPage();

  // --- Host creates the room (no account) ---
  const roomCode = await hostStartsRoom(host, "HostHannah");
  expect(roomCode).toMatch(/^\d{4}$/);
  await expect(
    host.getByRole("heading", { name: "Airport Bingo" })
  ).toBeVisible();

  // --- Both players join anonymously ---
  await playerJoins(playerA, roomCode, "PlayerAnn");
  await playerJoins(playerB, roomCode, "PlayerBob");

  // Every player gets a full card with a FREE centre.
  await expect(boardTiles(playerA)).toHaveCount(25);
  await expect(boardTiles(playerB)).toHaveCount(25);
  await expect(playerA.getByRole("button", { name: /FREE/ })).toBeDisabled();

  // The host sees both players without reloading (realtime).
  const hostPlayers = host.getByRole("listitem");
  await expect(hostPlayers.filter({ hasText: "PlayerAnn" })).toBeVisible();
  await expect(hostPlayers.filter({ hasText: "PlayerBob" })).toBeVisible();

  // --- Host starts the game ---
  await host.getByRole("button", { name: "Start Game" }).click();
  await expect(host.getByRole("button", { name: "Pause" })).toBeVisible();

  // Players transition to live without a manual refresh.
  await expect(playerA.getByText("● LIVE")).toBeVisible();
  await expect(playerB.getByText("● LIVE")).toBeVisible();

  // --- Player A marks the top row (positions 0-4, never the FREE centre) ---
  const aTiles = boardTiles(playerA);
  for (let i = 0; i < 4; i++) {
    await aTiles.nth(i).click();
    await expect(aTiles.nth(i)).toHaveAttribute("aria-pressed", "true");
  }

  // --- Player B sees A's progress live, without reloading (PRD §87) ---
  await expect(
    playerB.getByRole("listitem").filter({ hasText: "PlayerAnn" })
  ).toContainText("4");

  // --- Player A completes the row: bingo ---
  await aTiles.nth(4).click();

  // --- Both players see the winner (PRD §34) ---
  const aOverlay = playerA.getByRole("dialog", { name: "Bingo" });
  await expect(aOverlay).toBeVisible();
  await expect(aOverlay).toContainText("You got bingo");

  const bOverlay = playerB.getByRole("dialog", { name: "Bingo" });
  await expect(bOverlay).toBeVisible();
  await expect(bOverlay).toContainText("PlayerAnn got bingo");

  // Dismissing keeps the player on their own card, never navigating away.
  await bOverlay.getByRole("button", { name: "Keep Playing" }).click();
  await expect(bOverlay).toBeHidden();
  await expect(boardTiles(playerB)).toHaveCount(25);

  // --- Host ends the room ---
  host.once("dialog", (dialog) => dialog.accept());
  await host.getByRole("button", { name: "End Game" }).click();
  await expect(host.getByText("completed")).toBeVisible();

  // Marking is refused once the room is over.
  await expect(playerA.getByText("This game has ended")).toBeVisible();

  await hostContext.close();
  await playerAContext.close();
  await playerBContext.close();
});

test("a removed player cannot rejoin with the same identity", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();

  const roomCode = await hostStartsRoom(host, "HostHannah");
  await playerJoins(player, roomCode, "Unwanted");

  const removedRow = host.getByRole("listitem").filter({ hasText: "Unwanted" });
  await expect(removedRow).toBeVisible();
  host.once("dialog", (dialog) => dialog.accept());
  await host.getByRole("button", { name: "Remove" }).click();
  await expect(removedRow).toBeHidden();

  await player.goto(`/join/${roomCode}`);
  await player.getByLabel("Your nickname").fill("Unwanted");
  await player.getByRole("button", { name: "Join Game" }).click();
  await expect(
    player.getByText("The host removed you from this game.")
  ).toBeVisible();

  await hostContext.close();
  await playerContext.close();
});

test("an unknown room code is refused with a friendly message", async ({
  page,
}) => {
  await page.goto("/join/0000");
  await expect(page.getByText("We couldn't find that room")).toBeVisible();
});
