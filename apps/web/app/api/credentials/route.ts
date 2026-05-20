import { NextResponse, type NextRequest } from "next/server";
import { getService } from "../../../lib/service-instance";
import type { CredentialFilter, CredentialSort } from "../../../lib/services";

const PAGE_PARAMS = ["q", "status", "issuerDid", "subjectDid", "from", "to", "page", "pageSize", "sort", "fields"] as const;

export async function GET(request: NextRequest) {
  const service = await getService();
  const { searchParams } = new URL(request.url);
  const usesPaginated = PAGE_PARAMS.some((name) => searchParams.has(name));
  if (!usesPaginated) {
    return NextResponse.json(service.listCredentials());
  }
  const filter: CredentialFilter = {
    q: searchParams.get("q") ?? undefined,
    status: (searchParams.get("status") as CredentialFilter["status"]) ?? undefined,
    issuerDid: searchParams.get("issuerDid") ?? undefined,
    subjectDid: searchParams.get("subjectDid") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  };
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
  const sort = (searchParams.get("sort") as CredentialSort | null) ?? "createdAt:desc";
  const result = service.listCredentialsPage({
    filter,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    sort,
  });
  const fields = (searchParams.get("fields") ?? "")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const rows = fields.length > 0
    ? result.rows.map((row) => Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field as keyof typeof row]])))
    : result.rows;
  return NextResponse.json({
    rows,
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
      sort: result.sort,
      query: result.filter,
    },
  });
}
