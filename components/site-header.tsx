import { Eye } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/create", label: "Create" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Eye className="size-5" aria-hidden />
          <span className="text-lg">{siteConfig.name}</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {navLinks.map((link) => (
            <Button key={link.href} variant="ghost" size="sm" nativeButton={false} render={<Link href={link.href} />}>
              {link.label}
            </Button>
          ))}
          <Button size="sm" nativeButton={false} render={<Link href="/join" />}>
            Join a Room
          </Button>
        </nav>
      </div>
    </header>
  );
}
