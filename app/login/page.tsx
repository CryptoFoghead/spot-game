import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getUser();
  if (user) redirect("/dashboard/games");

  const searchParams = await props.searchParams;
  const linkError = searchParams.error === "link";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Creators sign in to build and manage games. Players never need an
        account — they just scan and play.
      </p>
      {linkError ? (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That sign-in link didn&apos;t work — it may have expired. Request a
          new one below.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
