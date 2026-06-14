import type { SaleDto } from "@flash-sale/shared";
import { SaleSchema } from "./sale.schema";

/**
 * Data access for one sale. Server-only — imported solely by the server component.
 *
 * PHASE A (S-1.1a): the request is **mocked on the Next server** — fixtures keyed by
 * a friendly id. They are run through `SaleSchema.parse`, exactly the parse that stays
 * in phase B; only the data source changes there (a real `fetch` to the Nest api).
 * (web holds no authority — NFR-9; here it just renders what the server says.)
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function buildFixture(now: number): Record<string, SaleDto> {
  const iso = (ms: number) => new Date(ms).toISOString();
  const serverNow = iso(now);
  return {
    live: {
      id: "live",
      title: "Live Drop — Limited Sneakers",
      state: "live",
      remainingStock: 5,
      startsAt: iso(now - HOUR),
      endsAt: iso(now + HOUR),
      serverNow,
    },
    upcoming: {
      id: "upcoming",
      title: "Upcoming Drop — Vintage Watch",
      state: "upcoming",
      remainingStock: 10,
      startsAt: iso(now + HOUR),
      endsAt: iso(now + 2 * HOUR),
      serverNow,
    },
    ended: {
      id: "ended",
      title: "Past Drop — Concert Tickets",
      state: "ended",
      remainingStock: 3,
      startsAt: iso(now - 2 * HOUR),
      endsAt: iso(now - HOUR),
      serverNow,
    },
    soldout: {
      id: "soldout",
      title: "Sold-out Drop — Signed Poster",
      state: "ended",
      remainingStock: 0,
      startsAt: iso(now - HOUR),
      endsAt: iso(now + HOUR),
      serverNow,
    },
  };
}

export async function getSale(id: string): Promise<SaleDto | null> {
  const fixture = buildFixture(Date.now())[id];
  if (!fixture) {
    return null;
  }
  return SaleSchema.parse(fixture);
}
