"use client";

import { cn } from "@/lib/utils";
import { DemoLoginButton } from "./demo-login-button";
import { useSession } from "./session-provider";

export function DemoLoginBlock() {
  const { session, isLoading } = useSession();
  if (session) return null;

  return (
    <div className={cn("mt-8 pt-8 border-t border-zinc-800", isLoading && "invisible")}>
      <DemoLoginButton />
      <p className="mt-3 text-xs text-zinc-500">
        No sign-up. Opens a ready-made buyer account so you can place an order — switch to Moderator
        or Admin from the bar at the bottom.
      </p>
    </div>
  );
}
