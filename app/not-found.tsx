import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold tracking-tight">
        We couldn&apos;t find that
      </h1>
      <p className="text-muted-foreground">
        The page, game, or room you&apos;re after doesn&apos;t exist — or the
        game has already ended.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href="/" />}>
          Go home
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/join" />}
        >
          Enter a room code
        </Button>
      </div>
    </div>
  );
}
