import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listFraudFlagsAction } from "./actions";
import { FraudFlagsTable } from "./fraud-flags-table";

export default async function FraudFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.isAdmin && !session?.hasRole("moderator")) redirect("/");

  const { status } = await searchParams;
  const flags = await listFraudFlagsAction(status);

  return (
    <main>
      <h1>Fraud flags</h1>
      <nav>
        <a href="/admin/fraud-flags">All</a>
        {" · "}
        <a href="/admin/fraud-flags?status=open">Open</a>
        {" · "}
        <a href="/admin/fraud-flags?status=reviewed">Reviewed</a>
      </nav>
      <FraudFlagsTable flags={flags} />
    </main>
  );
}
