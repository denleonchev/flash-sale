import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import { mintAdminTicket } from "@/lib/admin-ticket";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as unknown;

  let res: Response;
  try {
    res = await apiFetch("/sales/improve-copy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Ticket": mintAdminTicket(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ message: "Network error" }, { status: 502 });
  }

  const data = (await res.json()) as unknown;
  return NextResponse.json(data, { status: res.status });
}
