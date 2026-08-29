import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roomCodeSchema } from "@/lib/validation/room";

export const metadata: Metadata = { title: "Join a Room" };

export default async function JoinPage(props: PageProps<"/join">) {
  const searchParams = await props.searchParams;
  const raw = typeof searchParams.code === "string" ? searchParams.code : null;

  if (raw) {
    const parsed = roomCodeSchema.safeParse(raw);
    if (parsed.success) redirect(`/join/${parsed.data}`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Join a Room</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan your host&apos;s QR code, or enter the 4-digit room code.
      </p>
      {raw ? (
        <p className="mt-4 text-sm text-destructive">Room codes are 4 digits.</p>
      ) : null}
      <form action="/join" method="GET" className="mt-6 flex flex-col gap-3">
        <Label htmlFor="code">Room code</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="4827"
            defaultValue={raw ?? ""}
            required
            className="font-mono text-lg tracking-widest"
          />
          <Button type="submit">Join</Button>
        </div>
      </form>
    </div>
  );
}
