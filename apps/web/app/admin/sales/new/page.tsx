import { CreateSaleForm } from "./create-sale-form";

export default function NewSalePage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-zinc-50 mb-8">Create sale</h1>
      <CreateSaleForm />
    </main>
  );
}
