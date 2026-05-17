import { NextResponse } from "next/server";
import { institutions, students } from "../_store";

export async function GET(){
  return NextResponse.json({
    institutions: [...institutions.values()].map(({ privateKeyJwk, ...id }) => id),
    students: [...students.values()].map(({ privateKeyJwk, ...id }) => id),
  });
}
