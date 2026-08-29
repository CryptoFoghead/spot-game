import { z } from "zod";

/**
 * Environment variable validation (PRD §66).
 *
 * Client vars are inlined by Next.js at build time and must be referenced
 * literally. Server vars are validated lazily so the app can build without a
 * configured environment; any runtime access with a missing/invalid value
 * fails loudly with the variable name.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  // Later phases — optional until those features ship.
  AI_API_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

type ClientEnv = z.infer<typeof clientSchema>;
type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  const result = clientSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid client environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

let cachedClientEnv: ClientEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

/** Safe in both client and server code. */
export function clientEnv(): ClientEnv {
  cachedClientEnv ??= parseClientEnv({
    // NEXT_PUBLIC_ vars must be referenced literally for bundler inlining.
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cachedClientEnv;
}

/** Server-only: includes secrets. Never import from client components. */
export function serverEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}
