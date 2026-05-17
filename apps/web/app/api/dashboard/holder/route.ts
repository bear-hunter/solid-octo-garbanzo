import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function GET(req: Request) {
  const subjectDid = new URL(req.url).searchParams.get("subjectDid") ?? undefined;
  const service = await getService();
  return NextResponse.json(service.holderDashboard(subjectDid));
}
