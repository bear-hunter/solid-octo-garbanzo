import { NextResponse } from "next/server";
import { issuerDashboard } from "../../_store";

export async function GET() {
  return NextResponse.json(issuerDashboard());
}
