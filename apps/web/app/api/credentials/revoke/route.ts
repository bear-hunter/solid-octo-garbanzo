import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  try {
    const { id, reason = "Revoked by institution" } = await req.json();
    const service = await getService();
    const row = await service.revoke(id, reason);
    if (!row) return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    return NextResponse.json({ id, revoked: true, reason, chain: row.revokeChain });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Revoke failed" }, { status: 400 });
  }
}
