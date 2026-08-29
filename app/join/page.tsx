import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Join a Room" };

export default async function JoinPage(props: PageProps<"/join">) {
  const searchParams = await props.searchParams;
  const code = typeof searchParams.code === "string" ? searchParams.code : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Join a Room</h1>
      {code ? (
        <p className="mt-4 rounded-lg border bg-muted px-3 py-3 text-sm">
          Live rooms aren&apos;t open quite yet — multiplayer arrives in Phase
          3. Hang on to code <span className="font-mono font-bold">{code}</span>.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan a QR code or enter the room code your host shared.
          </p>
          <form action="/join" method="GET" className="mt-6 flex gap-2">
            <Input
              name="code"
              inputMode="numeric"
              placeholder="Room code"
              aria-label="Room code"
              required
            />
            <Button type="submit">Join</Button>
          </form>
        </>
      )}
    </div>
  );
}
