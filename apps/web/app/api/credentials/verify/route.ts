import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  try {
    const service = await getService();
    return NextResponse.json(await service.verify(await req.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verification failed" }, { status: 400 });
  }
}
