import { NextResponse } from "next/server";
import { getService } from "../../../lib/service-instance";

export async function POST(req: Request) {
  try {
    const { credentialId } = await req.json();
    const service = await getService();
    const share = service.createShareLink(credentialId);
    return NextResponse.json({ ...share, url: `/verify/${share.id}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create share link" },
      { status: 400 },
    );
  }
}
