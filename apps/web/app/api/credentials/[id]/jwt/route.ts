import { NextResponse } from "next/server";
import { getService } from "../../../../../lib/service-instance";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService();
  const jwt = service.getCredentialJwt(id);
  if (!jwt) return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  return NextResponse.json({ id, jwt });
}
