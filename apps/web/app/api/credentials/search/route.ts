import { NextResponse, type NextRequest } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function GET(request: NextRequest) {
  const service = await getService();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "10", 10);
  const { rows, total } = service.searchCredentials(q, Number.isFinite(pageSize) ? pageSize : 10);
  return NextResponse.json({ rows, meta: { total, query: q } });
}
