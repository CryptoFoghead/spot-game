import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildUserPrompt,
  filterDuplicates,
  generationResultSchema,
  SQUARE_SYSTEM_PROMPT,
} from "@/lib/ai/prompt";
import { claimAiGeneration } from "@/lib/ai/rate-limit";
import { serverEnv } from "@/lib/env";
import { reportError, reportWarning } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

/**
 * AI square generation (PRD §36-§38).
 *
 * Server-only: the AI key never reaches the browser. Authenticated creators
 * only, rate limited, and the model's output is validated before it is
 * returned — the model is never trusted to respect the schema on its own.
 */

const requestSchema = z.object({
  location: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(60),
  rating: z.enum(["family", "standard", "unfiltered"]),
  count: z.number().int().min(1).max(40),
  existingSquares: z.array(z.string()).max(200).default([]),
});

export async function POST(request: Request) {
  // 1. Authenticated creators only (PRD §65: never allow unauthenticated AI).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to generate ideas." },
      { status: 401 }
    );
  }

  // 2. Validate the request before anything is spent on it — a malformed
  //    request must not consume the caller's quota.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // 3. The key is required only when this endpoint is actually used, so the
  //    rest of the app still builds and runs without it configured. Checked
  //    before claiming so a misconfigured deploy doesn't burn anyone's quota.
  let apiKey: string;
  try {
    const env = serverEnv();
    if (!env.AI_API_KEY) throw new Error("AI_API_KEY is not set");
    apiKey = env.AI_API_KEY;
  } catch {
    return NextResponse.json(
      { error: "AI generation isn't configured yet." },
      { status: 503 }
    );
  }

  // 4. Claim a generation against the shared, database-backed limits.
  //    Claimed immediately before the model call, so the count reflects
  //    requests that actually reach the API.
  const limit = await claimAiGeneration(supabase);
  if (!limit.allowed) {
    if (limit.reason === "global_limit") {
      // Worth knowing about: the cost guard is holding back real users.
      reportWarning("ai.global_limit", "Daily AI generation cap reached", {
        userId: user.id,
      });
    }
    const message =
      limit.reason === "global_limit"
        ? "The idea generator is resting for today. Try again tomorrow."
        : limit.reason === "error"
          ? "Couldn't check your usage. Try again in a moment."
          : "You've hit the generation limit. Try again later.";
    return NextResponse.json(
      { error: message },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SQUARE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      output_config: { format: zodOutputFormat(generationResultSchema) },
    });

    // Refusals return 200 with no parsed output — handle before reading it.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "That theme couldn't be generated. Try rephrasing it." },
        { status: 422 }
      );
    }

    const result = response.parsed_output;
    if (!result) {
      return NextResponse.json(
        { error: "The generator returned something unusable. Try again." },
        { status: 502 }
      );
    }

    // 5. Validate and dedupe server-side before returning (PRD §36).
    const squares = filterDuplicates(result.squares, input.existingSquares).slice(
      0,
      input.count
    );

    if (squares.length === 0) {
      return NextResponse.json(
        { error: "No new ideas came back — try a different theme." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title: result.title,
      description: result.description,
      squares,
      remaining: limit.remaining,
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "The idea generator is busy. Try again in a moment." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      reportError("ai.auth", error, { hint: "check AI_API_KEY" });
      return NextResponse.json(
        { error: "AI generation isn't configured correctly." },
        { status: 503 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      reportError("ai.api", error, { status: error.status ?? 0 });
      return NextResponse.json(
        { error: "The idea generator had a problem. Try again." },
        { status: 502 }
      );
    }
    reportError("ai.unexpected", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
