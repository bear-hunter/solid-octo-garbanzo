import { NextResponse } from "next/server";
import { revokeCredential } from "../../_store";
export async function POST(req: Request){ const { id, reason = "Revoked by institution" } = await req.json(); const row = revokeCredential(id, reason); if(!row) return NextResponse.json({ error: "not found" }, { status: 404 }); return NextResponse.json({ id, revoked: true, reason }); }
