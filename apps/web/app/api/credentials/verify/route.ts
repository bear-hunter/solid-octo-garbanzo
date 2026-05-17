import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  const service = await getService();
  return NextResponse.json(await service.verify(await req.json()));
}
