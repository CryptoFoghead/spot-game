"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyLinkButton({
  value,
  label = "Copy link",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked (insecure context or denied) — the link is
          // visible on screen for manual copying.
        }
      }}
    >
      {copied ? (
        <Check data-icon="inline-start" aria-hidden />
      ) : (
        <Copy data-icon="inline-start" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
