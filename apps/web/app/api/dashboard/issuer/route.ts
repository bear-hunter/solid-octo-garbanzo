import { NextResponse, type NextRequest } from "next/server";
import { getService } from "../../../../lib/service-instance";
import type { CredentialFilter, CredentialSort } from "../../../../lib/services";

const PAGE_PARAMS = ["q", "status", "from", "to", "page", "pageSize", "sort", "auditLimit", "auditBefore"] as const;

export async function GET(request: NextRequest) {
  const service = await getService();
  const { searchParams } = new URL(request.url);
  const usesPaginated = PAGE_PARAMS.some((name) => searchParams.has(name));
  if (!usesPaginated) {
    return NextResponse.json(service.issuerDashboard());
  }
  const filter: CredentialFilter = {
    q: searchParams.get("q") ?? undefined,
    status: (searchParams.get("status") as CredentialFilter["status"]) ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  };
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
  const sort = (searchParams.get("sort") as CredentialSort | null) ?? "createdAt:desc";
  const credPage = service.listCredentialsPage({
    filter,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    sort,
  });
  const auditLimit = Number.parseInt(searchParams.get("auditLimit") ?? "12", 10);
  const audit = service.listAudit({
    limit: Number.isFinite(auditLimit) ? auditLimit : 12,
    before: searchParams.get("auditBefore") ?? undefined,
  });
  return NextResponse.json({
    metrics: service.getMetrics(),
    credentials: credPage.rows,
    auditEvents: audit.events,
    meta: {
      credentials: {
        page: credPage.page,
        pageSize: credPage.pageSize,
        total: credPage.total,
        hasMore: credPage.hasMore,
        sort: credPage.sort,
        filter: credPage.filter,
      },
      audit: { hasMore: audit.hasMore, oldest: audit.oldest },
    },
  });
}
