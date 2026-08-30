import { Eye } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { siteConfig } from "@/lib/config";

export async function SiteHeader() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Eye className="size-5" aria-hidden />
          <span className="text-lg">{siteConfig.name}</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/explore" />}>
            Explore
          </Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/create" />}>
            Create
          </Button>
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/games" />}
              >
                My Games
              </Button>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/account" />}
              >
                Account
              </Button>
              <form action={signOut}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
