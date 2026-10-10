import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-md bg-zinc-800", className)} />;
}
