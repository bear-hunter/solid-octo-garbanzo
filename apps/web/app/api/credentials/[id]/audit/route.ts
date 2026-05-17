import { NextResponse } from "next/server";
import { credentials, getAudit } from "../../../_store";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }){ const { id } = await params; const row = credentials.get(id); if(!row) return NextResponse.json({ error: "not found" }, { status: 404 }); return NextResponse.json({ id, events: getAudit(id) }); }
