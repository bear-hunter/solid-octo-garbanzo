import { NextResponse, type NextRequest } from "next/server";
import { getService } from "../../../../lib/service-instance";
import type { CredentialFilter, CredentialSort } from "../../../../lib/services";

const PAGE_PARAMS = ["q", "status", "page", "pageSize", "sort", "includeJwt"] as const;

export async function GET(request: NextRequest) {
  const service = await getService();
  const { searchParams } = new URL(request.url);
  const subjectDid = searchParams.get("subjectDid") ?? undefined;
  const usesPaginated = PAGE_PARAMS.some((name) => searchParams.has(name));
  if (!usesPaginated) {
    return NextResponse.json(service.holderDashboard(subjectDid));
  }
  const includeJwt = searchParams.get("includeJwt") !== "false";
  const filter: CredentialFilter = {
    q: searchParams.get("q") ?? undefined,
    status: (searchParams.get("status") as CredentialFilter["status"]) ?? undefined,
    subjectDid,
  };
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
  const sort = (searchParams.get("sort") as CredentialSort | null) ?? "createdAt:desc";
  const credPage = service.listCredentialsPage({
    filter,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    sort,
    includeJwt,
  });
  const activeTotal = service.listCredentialsPage({ filter: { ...filter, status: "active" }, page: 1, pageSize: 1 }).total;
  const revokedTotal = service.listCredentialsPage({ filter: { ...filter, status: "revoked" }, page: 1, pageSize: 1 }).total;
  return NextResponse.json({
    metrics: {
      held: credPage.total,
      active: activeTotal,
      revoked: revokedTotal,
    },
    credentials: credPage.rows,
    meta: {
      credentials: {
        page: credPage.page,
        pageSize: credPage.pageSize,
        total: credPage.total,
        hasMore: credPage.hasMore,
        sort: credPage.sort,
        filter: credPage.filter,
      },
    },
  });
}
