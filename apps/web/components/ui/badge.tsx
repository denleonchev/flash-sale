import { cn } from "@/lib/utils";

const variants = {
  live: "bg-red-950 text-red-400 border border-red-900",
  upcoming: "bg-amber-950 text-amber-400 border border-amber-900",
  ended: "bg-zinc-900 text-zinc-500 border border-zinc-800",
  default: "bg-zinc-800 text-zinc-300 border border-zinc-700",
} as const;

type Variant = keyof typeof variants;

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
