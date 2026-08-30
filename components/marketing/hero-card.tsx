"use client";

import { useEffect, useState } from "react";

/**
 * The hero thesis: a card filling in.
 *
 * The most characteristic thing in this product's world isn't a screenshot or
 * a stat — it's the moment a square gets spotted. So the home page opens with
 * that happening, using real observations rather than lorem.
 *
 * Deliberately the only ambient motion in the product: one orchestrated
 * moment, not scattered effects. Fully static under reduced motion.
 */

const SQUARES = [
  "Neck pillow already on",
  "Running toward a gate",
  "Airport beer before 10 AM",
  "Matching family shirts",
  "Someone asleep sitting straight up",
  "Oversized carry-on",
  "Charging outlet competition",
  "Shoes off at the gate",
  "A dog in a carrier",
];

// The order squares get spotted in — irregular, the way real spotting is.
const SEQUENCE = [4, 0, 8, 2, 6, 1, 7, 3, 5];

/**
 * Starts part-filled rather than empty, so the card reads as a real game in
 * progress on first paint — and so reduced-motion visitors get a composed
 * image instead of a blank grid, with no state written from an effect.
 */
const RESTING_STEP = 5;

export function HeroCard() {
  const [step, setStep] = useState(RESTING_STEP);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setStep((current) => (current >= SEQUENCE.length ? 0 : current + 1));
    }, 900);

    return () => clearInterval(timer);
  }, []);

  const spotted = SEQUENCE.slice(0, step);

  return (
    <div
      className="grid w-full max-w-[19rem] grid-cols-3 gap-2"
      aria-hidden
    >
      {SQUARES.map((text, index) => {
        const isSpotted = spotted.includes(index);
        return (
          <div
            key={text}
            className={
              "relative flex aspect-square items-center justify-center rounded-xl border-2 p-2 text-center text-[10px] leading-[1.15] font-medium transition-colors duration-300 " +
              (isSpotted
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground")
            }
          >
            {isSpotted ? (
              <svg
                viewBox="0 0 48 48"
                className="spot-stamp pointer-events-none absolute top-0.5 right-0.5 size-[30%]"
                fill="none"
              >
                <circle
                  cx="24"
                  cy="24"
                  r="22"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray="0.5 7"
                  strokeLinecap="round"
                  opacity="0.75"
                />
                <circle cx="24" cy="24" r="17" fill="currentColor" />
                <path
                  d="M15.5 24.5 L21 30 L32.5 18"
                  stroke="var(--primary)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            <span className="relative line-clamp-3">{text}</span>
          </div>
        );
      })}
    </div>
  );
}
