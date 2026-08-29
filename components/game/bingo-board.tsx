import { BingoSquare } from "@/components/game/bingo-square";

export type CardSquare = {
  id: string;
  position: number;
  text: string;
  isFree: boolean;
  marked: boolean;
};

/**
 * 5x5 responsive grid (PRD §31). The whole tile is the tap target — never a
 * small checkbox inside it. Never scrolls horizontally.
 */
export function BingoBoard({
  squares,
  roomCode,
  interactive,
}: {
  squares: CardSquare[];
  roomCode: string;
  interactive: boolean;
}) {
  return (
    <div
      className="grid w-full grid-cols-5 gap-1.5 sm:gap-2"
      role="group"
      aria-label="Your bingo card"
    >
      {squares.map((square) => (
        <BingoSquare
          key={square.id}
          square={square}
          roomCode={roomCode}
          interactive={interactive}
        />
      ))}
    </div>
  );
}
