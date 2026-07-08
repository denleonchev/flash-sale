import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="py-10 flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </main>
  );
}
