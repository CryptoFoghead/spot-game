import type { Metadata } from "next";

import { DeleteAccount } from "@/components/account/delete-account";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { count: gameCount } = await supabase
    .from("game_templates")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
      </div>

      <section>
        <h2 className="text-lg font-bold tracking-tight">Delete account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently removes your account, your{" "}
          {gameCount ?? 0} {gameCount === 1 ? "game" : "games"} and their
          squares. It cannot be undone.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Games currently being played stay running so you don&apos;t end
          someone else&apos;s game — they simply lose their host, and are
          cleaned up automatically afterwards.
        </p>
        <div className="mt-4">
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}
