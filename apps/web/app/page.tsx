import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { DemoLoginBlock } from "./demo-login-block";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const REPO_URL = "https://github.com/denleonchev/flash-sale";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center pb-10 text-center">
      <div className="max-w-md">
        <p className="text-red-500 text-xs font-semibold tracking-widest uppercase mb-4">
          Flash sales
        </p>
        <h1 className="text-5xl font-bold text-zinc-50 mb-4">Flash Sale</h1>
        <p className="text-zinc-400 mb-8">
          A checkout built for contention: when 50 buyers race for 5 units at the same moment,
          exactly 5 orders are confirmed and nothing oversells.
        </p>
        <Link
          href="/sales"
          className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-md transition-colors"
        >
          Browse sales
        </Link>
        <DemoLoginBlock />
        <div className="mt-8">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Source and architecture notes on GitHub
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </main>
  );
}
