import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  const { name = "Example University" } = await req.json().catch(() => ({}));
  const service = await getService();
  return NextResponse.json(await service.makeInstitution(name));
}
