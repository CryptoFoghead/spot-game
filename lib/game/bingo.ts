/**
 * Bingo geometry (PRD §24).
 *
 * The database is authoritative for official win state; this module exists so
 * the client can show the same result instantly and so the rules are unit
 * tested. Both implementations must agree.
 */

/** All winning position sets for a card: rows, columns, both diagonals. */
export function winningSets(cardSize: number): number[][] {
  const sets: number[][] = [];

  for (let row = 0; row < cardSize; row++) {
    sets.push(
      Array.from({ length: cardSize }, (_, col) => row * cardSize + col)
    );
  }
  for (let col = 0; col < cardSize; col++) {
    sets.push(
      Array.from({ length: cardSize }, (_, row) => row * cardSize + col)
    );
  }
  sets.push(Array.from({ length: cardSize }, (_, i) => i * cardSize + i));
  sets.push(
    Array.from({ length: cardSize }, (_, i) => i * cardSize + (cardSize - 1 - i))
  );

  return sets;
}

export type BingoMode =
  | "classic"
  | "blackout"
  | "double"
  | "four_corners"
  | "points"
  | "timed";

/** Corner positions of a card, used by four-corners mode. */
export function cornerPositions(cardSize: number): number[] {
  const last = cardSize - 1;
  return [0, last, last * cardSize, last * cardSize + last];
}

/**
 * Win conditions by mode (PRD §13, §24). A FREE center counts as marked
 * because it is stored marked. Mirrors `card_has_bingo` in SQL.
 *
 * Points mode wins on a line like classic; only its scoring differs.
 */
export function hasBingo(
  markedPositions: Iterable<number>,
  cardSize: number,
  mode: BingoMode = "classic"
): boolean {
  const marked = new Set(markedPositions);

  // Timed rounds are won on score at the deadline, never on a line — a line
  // win would end a ten-minute game in ninety seconds.
  if (mode === "timed") return false;

  if (mode === "blackout") {
    return marked.size >= cardSize * cardSize;
  }
  if (mode === "four_corners") {
    return cornerPositions(cardSize).every((position) => marked.has(position));
  }
  if (mode === "double") {
    return completedSets(marked, cardSize).length >= 2;
  }
  return winningSets(cardSize).some((set) =>
    set.every((position) => marked.has(position))
  );
}

/** Completed lines — used to highlight the winning line(s) in the UI. */
export function completedSets(
  markedPositions: Iterable<number>,
  cardSize: number
): number[][] {
  const marked = new Set(markedPositions);
  return winningSets(cardSize).filter((set) =>
    set.every((position) => marked.has(position))
  );
}

/**
 * True when some line is one square from complete (PRD §32's 🔥).
 *
 * This is a property of the lines, not the score: "one away" means a row,
 * column or diagonal has exactly one unmarked cell. Blackout is one away when
 * a single cell anywhere remains. Mirrors `card_is_one_away` in SQL.
 */
export function isOneAway(
  markedPositions: Iterable<number>,
  cardSize: number,
  mode: BingoMode = "classic"
): boolean {
  const marked = new Set(markedPositions);
  if (mode === "timed") return false;
  if (hasBingo(marked, cardSize, mode)) return false;

  if (mode === "blackout") {
    return cardSize * cardSize - marked.size === 1;
  }
  if (mode === "four_corners") {
    return (
      cornerPositions(cardSize).filter((position) => !marked.has(position))
        .length === 1
    );
  }
  if (mode === "double") {
    // One line already complete, and another a single square short.
    const complete = completedSets(marked, cardSize).length;
    const nearlyComplete = winningSets(cardSize).some(
      (set) => set.filter((position) => !marked.has(position)).length === 1
    );
    return complete === 1 && nearlyComplete;
  }
  return winningSets(cardSize).some(
    (set) => set.filter((position) => !marked.has(position)).length === 1
  );
}

/** Score = marked squares excluding the FREE center (PRD §50). */
export function scoreFrom(
  squares: Array<{ marked: boolean; isFree: boolean }>
): number {
  return squares.filter((square) => square.marked && !square.isFree).length;
}
