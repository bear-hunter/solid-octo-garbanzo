import { NextResponse } from "next/server";
import { createShareLink } from "../_store";

export async function POST(req: Request) {
  try {
    const { credentialId } = await req.json();
    const share = createShareLink(credentialId);
    return NextResponse.json({ ...share, url: `/verify/${share.id}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create share link" }, { status: 400 });
  }
}
