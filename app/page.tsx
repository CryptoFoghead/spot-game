import { Eye, QrCode, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";

const steps = [
  { icon: Eye, label: "Pick a Game" },
  { icon: Users, label: "Invite your friends" },
  { icon: QrCode, label: "Spot it" },
  { icon: Trophy, label: "Get Bingo" },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-20">
      <section className="flex flex-col items-start gap-6">
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {siteConfig.tagline}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {siteConfig.description}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/explore" />}>
            <Sparkles data-icon="inline-start" aria-hidden />
            Start Playing
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/create" />}>
            Create a Game
          </Button>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          How it works
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {steps.map((step) => (
            <Card key={step.label}>
              <CardContent className="flex flex-col items-start gap-2">
                <step.icon className="size-5 text-primary" aria-hidden />
                <span className="text-sm font-medium">{step.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
