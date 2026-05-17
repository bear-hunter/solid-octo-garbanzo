import { NextResponse } from "next/server";
import { seedPresentationRecords } from "../../_store";

export async function POST(){
  const { institution, student, credential, share } = await seedPresentationRecords();
  return NextResponse.json({ institution: { did: institution.did, name: institution.name, publicKeyJwk: institution.publicKeyJwk }, student: { did: student.did, name: student.name, publicKeyJwk: student.publicKeyJwk }, credential, share });
}
