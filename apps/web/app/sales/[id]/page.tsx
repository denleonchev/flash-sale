import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Countdown } from "./countdown";
import { EndNowButton } from "./end-now-button";
import { getSale } from "./get-sale";
import { LiveStock } from "./live-stock";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/json-ld";
import { buildSaleDescription } from "@/lib/seo/build-sale-description";
import { buildSaleJsonLd } from "@/lib/seo/build-sale-json-ld";
import { buildSalePath, parseSaleIdFromParam } from "@/lib/seo/build-sale-path";
import { SITE_NAME } from "@/lib/seo/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: param } = await params;
  const saleId = parseSaleIdFromParam(param);
  const sale = saleId ? await getSale(saleId) : null;
  if (!sale) return {};

  const description = buildSaleDescription(sale);
  const path = buildSalePath(sale);

  return {
    title: sale.title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, title: sale.title, description, url: path },
  };
}

/**
 * Event (sale) view — S-1.1 (FR-5). SSR server component: fetch the sale on the
 * server, render product, state, stock left and time left. The Buy action and live
 * updates arrive in later cards (S-4.1 / UR-3); here Buy is only enabled/disabled by
 * state.
 */
export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: param } = await params;
  const saleId = parseSaleIdFromParam(param);
  const sale = saleId ? await getSale(saleId) : null;
  if (!sale) {
    notFound();
  }

  const salePath = buildSalePath(sale);
  if (`/sales/${param}` !== salePath) {
    permanentRedirect(`${salePath}${buildQueryString(await searchParams)}`);
  }

  const session = await getSession();
  const isAdmin = session?.isAdmin ?? false;
  const soldOut = sale.state === "ended" && sale.remainingStock <= 0;
  // FR-17: live stock, countdown and Buy for an in-progress sale render client-side
  // (LiveStock) so Socket.IO can keep the number current. The upcoming branch stays
  // server-rendered — nothing is live before the sale starts.
  const priceUsd = (sale.priceCents / 100).toFixed(2);

  return (
    <main className="max-w-2xl mx-auto py-10">
      <JsonLd data={buildSaleJsonLd(sale)} />
      <Link
        href="/sales"
        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-lg sm:text-sm mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sales
      </Link>

      <div className="mb-3">
        {sale.state === "live" && <Badge variant="live">Live</Badge>}
        {sale.state === "upcoming" && <Badge variant="upcoming">Upcoming</Badge>}
        {sale.state === "ended" && <Badge variant="ended">{soldOut ? "Sold out" : "Ended"}</Badge>}
      </div>

      <h1 className="text-4xl font-bold text-zinc-50 mb-2">{sale.title}</h1>
      {sale.description && <p className="text-zinc-400 text-lg mb-6">{sale.description}</p>}
      <p className="text-3xl font-bold text-zinc-50 mb-8">${priceUsd}</p>

      {sale.state === "live" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <LiveStock
            saleId={sale.id}
            initialStock={sale.remainingStock}
            signedIn={!!session}
            endsAt={sale.endsAt}
            serverNow={sale.serverNow}
          />
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-red-400">
                  Admin action
                </p>
                <p className="text-xs text-zinc-500">Ends the sale for every buyer immediately.</p>
              </div>
              <EndNowButton saleId={sale.id} />
            </div>
          )}
        </div>
      )}

      {sale.state === "upcoming" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Starts in</p>
            <p className="font-mono text-3xl font-bold text-zinc-50">
              <Countdown targetAt={sale.startsAt} serverNow={sale.serverNow} />
            </p>
            <p className="text-zinc-500 text-sm mt-1">{new Date(sale.startsAt).toLocaleString()}</p>
          </div>
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-md bg-zinc-800 text-zinc-600 font-semibold cursor-not-allowed"
          >
            Buy
          </button>
        </div>
      )}

      {sale.state === "ended" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-500">
            {soldOut ? "This sale sold out." : "This sale has ended."}
          </p>
        </div>
      )}
    </main>
  );
}

function buildQueryString(searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of [value].flat()) {
      if (item !== undefined) query.append(key, item);
    }
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
