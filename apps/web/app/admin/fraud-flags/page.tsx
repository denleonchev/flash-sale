import Link from "next/link";
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
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-zinc-50 mb-6">Fraud flags</h1>
      <nav className="flex gap-1 mb-6">
        <NavLink href="/admin/fraud-flags" active={!status}>
          All
        </NavLink>
        <NavLink href="/admin/fraud-flags?status=open" active={status === "open"}>
          Open
        </NavLink>
        <NavLink href="/admin/fraud-flags?status=reviewed" active={status === "reviewed"}>
          Reviewed
        </NavLink>
      </nav>
      <FraudFlagsTable flags={flags} />
    </main>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-zinc-800 text-zinc-50"
          : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50"
      }`}
    >
      {children}
    </Link>
  );
}
