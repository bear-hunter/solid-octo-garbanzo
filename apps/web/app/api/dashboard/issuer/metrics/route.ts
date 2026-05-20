import { NextResponse } from "next/server";
import { getService } from "../../../../../lib/service-instance";

export async function GET() {
  const service = await getService();
  return NextResponse.json({ metrics: service.getMetrics(), asOf: service.getMetricsAsOf() });
}
