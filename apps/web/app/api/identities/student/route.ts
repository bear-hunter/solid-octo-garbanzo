import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  const { name = "Sample Student" } = await req.json().catch(() => ({}));
  const service = await getService();
  return NextResponse.json(await service.makeStudent(name));
}
