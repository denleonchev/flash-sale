import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 text-center">
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
      </div>
    </main>
  );
}
