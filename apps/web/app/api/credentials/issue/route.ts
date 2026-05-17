import { NextResponse } from "next/server";
import { issue } from "../../_store";
export async function POST(req: Request){ try { return NextResponse.json(await issue(await req.json())); } catch(e:any) { return NextResponse.json({ error: e.message }, { status: 400 }); } }
