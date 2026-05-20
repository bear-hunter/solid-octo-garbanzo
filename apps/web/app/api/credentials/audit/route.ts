import { NextResponse, type NextRequest } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function GET(request: NextRequest) {
  const service = await getService();
  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "12", 10);
  const { events, hasMore, oldest } = service.listAudit({
    limit: Number.isFinite(limitParam) ? limitParam : 12,
    before: searchParams.get("before") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    credentialId: searchParams.get("credentialId") ?? undefined,
    issuerDid: searchParams.get("issuerDid") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  return NextResponse.json({ events, meta: { hasMore, oldest } });
}
