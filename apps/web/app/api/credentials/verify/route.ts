import { NextResponse } from "next/server";
import { verifyCredentialRecord } from "../../_store";
export async function POST(req: Request){ return NextResponse.json(await verifyCredentialRecord(await req.json())); }
