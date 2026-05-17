import { NextResponse } from "next/server";
import { holderDashboard } from "../../_store";

export async function GET(req: Request) {
  const subjectDid = new URL(req.url).searchParams.get("subjectDid") ?? undefined;
  return NextResponse.json(holderDashboard(subjectDid));
}
