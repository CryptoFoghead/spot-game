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

export type BingoMode = "classic" | "blackout";

/**
 * Classic wins on any complete line; blackout needs every position.
 * A FREE center counts as marked because it is stored marked.
 */
export function hasBingo(
  markedPositions: Iterable<number>,
  cardSize: number,
  mode: BingoMode = "classic"
): boolean {
  const marked = new Set(markedPositions);

  if (mode === "blackout") {
    return marked.size >= cardSize * cardSize;
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
  if (hasBingo(marked, cardSize, mode)) return false;

  if (mode === "blackout") {
    return cardSize * cardSize - marked.size === 1;
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
