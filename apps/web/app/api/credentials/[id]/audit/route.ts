import { NextResponse } from "next/server";
import { getService } from "../../../../../lib/service-instance";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService();
  const events = service.getAudit(id);
  return NextResponse.json({ id, events });
}
