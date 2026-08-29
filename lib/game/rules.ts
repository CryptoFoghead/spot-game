/**
 * Publishing rules (PRD §11): a game needs enough active squares to fill a
 * card — card_size² minus one when the center square is FREE.
 */
export function minimumSquares(cardSize: number, freeCenter: boolean): number {
  const cells = cardSize * cardSize;
  return freeCenter ? cells - 1 : cells;
}

export const RECOMMENDED_SQUARES = 40;
