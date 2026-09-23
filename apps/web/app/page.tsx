import Link from "next/link";
import { getSession } from "@/lib/session";
import { DemoLoginButton } from "./demo-login-button";

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="flex-1 flex flex-col items-center justify-center pb-10 text-center">
      <div className="max-w-md">
        <p className="text-red-500 text-xs font-semibold tracking-widest uppercase mb-4">
          Flash sales
        </p>
        <h1 className="text-5xl font-bold text-zinc-50 mb-4">Flash Sale</h1>
        <p className="text-zinc-400 mb-8">The best deals, gone in seconds.</p>
        <Link
          href="/sales"
          className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-md transition-colors"
        >
          Browse sales
        </Link>
        {!session && (
          <div className="mt-8 pt-8 border-t border-zinc-800">
            <DemoLoginButton />
            <p className="mt-3 text-xs text-zinc-500">
              No sign-up. Opens a ready-made buyer account so you can place an order — switch to
              Moderator or Admin from the bar at the bottom.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
