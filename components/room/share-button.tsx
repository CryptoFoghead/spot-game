"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Web Share API where supported, clipboard fallback everywhere else (PRD §77).
 */
export function ShareButton({
  gameTitle,
  joinUrl,
  size,
  label = "Share",
}: {
  gameTitle: string;
  joinUrl: string;
  /** Compact form for the play header, where the board is the point. */
  size?: "sm" | "default";
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = `Join my ${gameTitle} game.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: gameTitle, text, url: joinUrl });
        return;
      } catch {
        // Cancelled or unsupported — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${joinUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the link is on screen to copy manually.
    }
  }

  return (
    <Button type="button" onClick={share} variant="secondary" size={size}>
      {copied ? (
        <Check data-icon="inline-start" aria-hidden />
      ) : (
        <Share2 data-icon="inline-start" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
