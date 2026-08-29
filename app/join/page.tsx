import type { Metadata } from "next";

export const metadata: Metadata = { title: "Join a Room" };

export default function JoinPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Join a Room</h1>
      <p className="mt-2 text-muted-foreground">
        Room joining arrives in Phase 3. You&apos;ll scan a QR code or enter a
        room code here.
      </p>
    </div>
  );
}
