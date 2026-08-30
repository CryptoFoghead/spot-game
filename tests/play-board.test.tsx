// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardSquare } from "@/components/game/bingo-board";
import { PlayBoard } from "@/components/game/play-board";

const toggleSquare = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/play", () => ({ toggleSquare }));
vi.mock("@/lib/room-refresh", () => ({ useRoomRefresh: () => () => {} }));

function card(): CardSquare[] {
  return Array.from({ length: 25 }, (_, position) => ({
    id: `square-${position}`,
    position,
    text: position === 12 ? "FREE" : `Square ${position}`,
    isFree: position === 12,
    marked: false,
  }));
}

function tile(position: number) {
  return screen.getByRole("button", { name: new RegExp(`^Square ${position}`) });
}

/**
 * The optimistic marking path (PRD §28). These exist because of B-20: a tap on
 * a dead network left the tile showing "spotted" while the database had no
 * mark, and left the square pending forever, so it could not be tapped again
 * for the rest of the game. Unit and integration tests could not have caught
 * it — the defect was entirely in how the client handled a rejected call.
 */
describe("PlayBoard marking", () => {
  beforeEach(() => toggleSquare.mockReset());
  afterEach(() => cleanup());

  function board() {
    return render(
      <PlayBoard initialSquares={card()} roomCode="4307" interactive />
    );
  }

  it("marks the tile immediately, before the server answers", async () => {
    let release: (value: unknown) => void = () => {};
    toggleSquare.mockReturnValue(new Promise((resolve) => (release = resolve)));

    board();
    fireEvent.click(tile(0));

    // The whole point of optimistic marking: it does not wait.
    await waitFor(() =>
      expect(tile(0).getAttribute("aria-pressed")).toBe("true")
    );

    release({ ok: true, marked: true });
  });

  it("keeps the mark the server reports, not the one it guessed", async () => {
    toggleSquare.mockResolvedValue({ ok: true, marked: false });

    board();
    fireEvent.click(tile(0));

    await waitFor(() =>
      expect(tile(0).getAttribute("aria-pressed")).toBe("false")
    );
  });

  it("reverts and explains when the server refuses", async () => {
    toggleSquare.mockResolvedValue({ ok: false, error: "That isn't your card." });

    board();
    fireEvent.click(tile(0));

    await screen.findByText("That isn't your card.");
    expect(tile(0).getAttribute("aria-pressed")).toBe("false");
  });

  it("reverts and explains when the network is gone (B-20)", async () => {
    // A server action REJECTS on a dead network — it does not return {ok:false}.
    //
    // Only the first call rejects. The component calls it exactly once either
    // way (measured), but a *persistently* rejecting mock surfaces an unhandled
    // rejection that fails the test — a harness artefact, not the component.
    toggleSquare.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });

    board();
    fireEvent.click(tile(0));

    await screen.findByText(/didn't save/);
    // The board must not claim a mark the database does not have.
    expect(tile(0).getAttribute("aria-pressed")).toBe("false");
  });

  it("lets you tap again after a failed tap (B-20)", async () => {
    toggleSquare.mockImplementationOnce(() =>
      Promise.reject(new TypeError("Failed to fetch"))
    );

    board();
    fireEvent.click(tile(0));
    await screen.findByText(/didn't save/);

    // Previously the square stayed pending forever, so this second tap — the
    // obvious thing a player does when the network comes back — did nothing.
    toggleSquare.mockResolvedValue({ ok: true, marked: true });
    fireEvent.click(tile(0));

    await waitFor(() =>
      expect(tile(0).getAttribute("aria-pressed")).toBe("true")
    );
    expect(toggleSquare).toHaveBeenCalledTimes(2);
  });

  it("never sends the FREE square", () => {
    board();
    fireEvent.click(screen.getByRole("button", { name: /FREE/ }));
    expect(toggleSquare).not.toHaveBeenCalled();
  });

  it("ignores a second tap while the first is still in flight", async () => {
    // Released at the end: a promise that never settles keeps the component
    // pending through teardown and hangs the next hook.
    let release: (value: unknown) => void = () => {};
    toggleSquare.mockReturnValue(new Promise((resolve) => (release = resolve)));

    board();
    fireEvent.click(tile(0));
    fireEvent.click(tile(0));

    await waitFor(() => expect(toggleSquare).toHaveBeenCalledTimes(1));

    release({ ok: true, marked: true });
    await waitFor(() =>
      expect(tile(0).getAttribute("aria-pressed")).toBe("true")
    );
  });

  it("does not mark at all when the board is not interactive", () => {
    render(
      <PlayBoard
        initialSquares={card()}
        roomCode="4307"
        interactive={false}
      />
    );
    fireEvent.click(tile(0));
    expect(toggleSquare).not.toHaveBeenCalled();
  });
});
