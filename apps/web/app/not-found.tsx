import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="max-w-md">
        <p className="text-red-500 text-xs font-semibold tracking-widest uppercase mb-4">404</p>
        <h1 className="text-3xl font-bold text-zinc-50 mb-3">Page not found</h1>
        <p className="text-zinc-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
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
