import { NextResponse } from "next/server";
import { makeStudent } from "../../_store";
export async function POST(req: Request){ const { name = "Sample Student" } = await req.json().catch(()=>({})); const id = await makeStudent(name); return NextResponse.json({ did: id.did, name: id.name, publicKeyJwk: id.publicKeyJwk }); }
