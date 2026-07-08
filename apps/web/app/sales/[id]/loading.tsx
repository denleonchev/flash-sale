import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="max-w-2xl mx-auto py-10 flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </main>
  );
}
