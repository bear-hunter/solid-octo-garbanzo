import { NextResponse } from "next/server";
import { credentials } from "../_store";

export async function GET(){
  return NextResponse.json([...credentials.values()].map(({ jwt, credential, ...row }) => ({ ...row, credential, jwt })));
}
