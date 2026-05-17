import { NextResponse } from "next/server";
import { makeInstitution } from "../../_store";
export async function POST(req: Request){ const { name = "Example University" } = await req.json().catch(()=>({})); const id = await makeInstitution(name); return NextResponse.json({ did: id.did, name: id.name, publicKeyJwk: id.publicKeyJwk }); }
