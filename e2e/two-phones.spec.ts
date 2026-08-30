import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Two phones at one table.
 *
 * `multiplayer.spec.ts` proves the PRD §73 scenario in desktop contexts. This
 * file is about the physical situation the app is actually for: two handsets,
 * mobile viewports, touch instead of hover, and — the part no amount of unit
 * testing reaches — a restaurant's network dropping under them.
 *
 * The offline tests here use Playwright's real `context.setOffline()`, which
 * severs the browser's networking the way airplane mode does. B-20 and B-21
 * were found and first fixed against a stubbed `window.fetch`; these re-prove
 * them without the stub, and both were checked by reverting the fix and
 * watching the test fail — a test nobody has seen fail is not evidence.
 *
 * It does NOT replace the phone-to-phone test (G-01). Two emulated Chromiums on
 * one machine share a network stack and a clock. They cannot tell you whether
 * two people on a café's wifi see each other promptly, whether a real iOS
 * socket survives an hour asleep, or whether the game is any fun.
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
});

const NAV_TIMEOUT = 45_000;

/** One phone: mobile viewport, touch, mobile user agent. */
async function phone(
  browser: Browser,
  model: "Pixel 7" | "Galaxy S9+"
): Promise<BrowserContext> {
  return browser.newContext({ ...devices[model] });
}

function tiles(page: Page) {
  return page.getByRole("group", { name: "Your bingo card" }).getByRole("button");
}

/** A tile that can actually be tapped — FREE is disabled, marked ones pressed. */
function openTile(page: Page) {
  return tiles(page)
    .and(page.locator('[aria-pressed="false"]:not([disabled])'))
    .first();
}

/** Creates the room and lands the host on the host screen. It is not live yet. */
async function hostCreatesRoom(page: Page, nickname: string, mode?: string) {
  await page.goto("/games/date-night-bingo");
  await page.getByLabel("Your nickname").fill(nickname);
  if (mode) await page.getByLabel("Mode").selectOption(mode);
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

/** The host taps Start; everyone's board goes live. */
async function startGame(hostPage: Page) {
  await hostPage.getByRole("button", { name: "Start Game" }).click();
  await expect(hostPage.getByRole("button", { name: "Pause" })).toBeVisible();
}

async function joins(page: Page, roomCode: string, nickname: string) {
  await page.goto(`/join/${roomCode}`);
  await page.getByLabel("Your nickname").fill(nickname);
  await page.getByRole("button", { name: "Join Game" }).click();
  await page.waitForURL(`**/room/${roomCode}/play`, { timeout: NAV_TIMEOUT });
}

test("two phones share one card in Together mode", async ({ browser }) => {
  const one = await phone(browser, "Pixel 7");
  const two = await phone(browser, "Galaxy S9+");
  const alex = await one.newPage();
  const sam = await two.newPage();

  const code = await hostCreatesRoom(alex, "Alex", "coop");
  await joins(sam, code, "Sam");
  await startGame(alex);

  await alex.goto(`/room/${code}/play`);
  await expect(alex.getByText(/Together:/)).toBeVisible();

  // The whole promise of the mode: it is one card, not two.
  const alexTexts = await tiles(alex).allInnerTexts();
  const samTexts = await tiles(sam).allInnerTexts();
  expect(samTexts).toEqual(alexTexts);

  // Sam spots something. Alex should see it without touching anything.
  const target = openTile(sam);
  const spotted = (await target.innerText()).trim();
  await target.tap();

  await expect(
    tiles(alex).filter({ hasText: spotted }).first()
  ).toHaveAttribute("aria-pressed", "true");
  await expect(alex.getByText("Together: 1")).toBeVisible();

  // Alex did not spot it, so Alex's own count stays at zero — the bit that
  // keeps both people looking.
  await expect(alex.getByText("You spotted 0")).toBeVisible();

  await one.close();
  await two.close();
});

test("a tap that cannot reach the server says so, and recovers (B-20)", async ({
  browser,
}) => {
  const one = await phone(browser, "Pixel 7");
  const alex = await one.newPage();

  const code = await hostCreatesRoom(alex, "Alex");
  await startGame(alex);
  await alex.goto(`/room/${code}/play`);
  await expect(tiles(alex).first()).toBeVisible();

  const target = openTile(alex);
  const text = (await target.innerText()).trim();

  // Airplane mode, mid-game.
  await one.setOffline(true);
  await target.tap();

  await expect(alex.getByText(/didn't save/)).toBeVisible();
  // It must not claim a mark the database does not have.
  await expect(
    tiles(alex).filter({ hasText: text }).first()
  ).toHaveAttribute("aria-pressed", "false");

  // Signal returns. The same square must still be tappable — it used to be
  // dead for the rest of the game.
  await one.setOffline(false);
  await tiles(alex).filter({ hasText: text }).first().tap();
  await expect(
    tiles(alex).filter({ hasText: text }).first()
  ).toHaveAttribute("aria-pressed", "true");

  await one.close();
});

test("joining with no signal keeps you on the form (B-21)", async ({ browser }) => {
  const one = await phone(browser, "Pixel 7");
  const two = await phone(browser, "Galaxy S9+");
  const alex = await one.newPage();
  const sam = await two.newPage();

  const code = await hostCreatesRoom(alex, "Alex");

  await sam.goto(`/join/${code}`);
  await sam.getByLabel("Your nickname").fill("Sam");

  await two.setOffline(true);
  await sam.getByRole("button", { name: "Join Game" }).click();

  // Not the error boundary, which used to eat the whole page.
  await expect(sam.getByText(/Couldn't reach the game/)).toBeVisible();
  await expect(sam.getByText("Something went wrong")).toHaveCount(0);
  // And the nickname they typed on the network that just failed them survives.
  await expect(sam.getByLabel("Your nickname")).toHaveValue("Sam");

  await two.setOffline(false);
  await sam.getByRole("button", { name: "Join Game" }).click();
  await sam.waitForURL(`**/room/${code}/play`, { timeout: NAV_TIMEOUT });

  await one.close();
  await two.close();
});

/**
 * Deliberately NOT labelled B-22.
 *
 * This asserts the outcome — a phone that missed things while off-network is
 * correct again once it returns — and it passes with the `visibilitychange`
 * and `online` listeners removed, which was checked. The recovery here comes
 * from Supabase resubscribing and the existing resync-on-SUBSCRIBED, because
 * `setOffline` closes the socket cleanly and the client notices.
 *
 * B-22 is about the socket dying *silently*, which this cannot reproduce, so
 * that fix stays defensive and unproven by any automated test. Only a real
 * phone left asleep can settle it — G-01.
 */
test("a phone that lost the network catches up when it returns", async ({
  browser,
}) => {
  const one = await phone(browser, "Pixel 7");
  const two = await phone(browser, "Galaxy S9+");
  const alex = await one.newPage();
  const sam = await two.newPage();

  const code = await hostCreatesRoom(alex, "Alex", "coop");
  await joins(sam, code, "Sam");
  await startGame(alex);
  await alex.goto(`/room/${code}/play`);
  await expect(alex.getByText("Together: 0")).toBeVisible();

  // Alex's phone drops off entirely — socket included.
  await one.setOffline(true);

  const target = openTile(sam);
  const spotted = (await target.innerText()).trim();
  await target.tap();
  await expect(sam.getByText("Together: 1")).toBeVisible();

  // Coming back must resync from the database rather than sitting on a stale
  // board under a "live" indicator.
  await one.setOffline(false);

  await expect(alex.getByText("Together: 1")).toBeVisible();
  await expect(
    tiles(alex).filter({ hasText: spotted }).first()
  ).toHaveAttribute("aria-pressed", "true");

  await one.close();
  await two.close();
});
