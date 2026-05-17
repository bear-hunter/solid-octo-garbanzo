import { createAcademicCredential, generateIdentity, hashHex, signCredential, verifyCredential } from "@acme/credentials";

async function main() {
  const issuer = await generateIdentity("Evaluation University");
  const unknown = await generateIdentity("Unknown University");
  const student = await generateIdentity("Student");
  const credential = createAcademicCredential({ issuerDid: issuer.did, subject: { id: student.did, studentId: "EVAL-1", name: "Eval Student", degree: "BS", major: "CS", graduationDate: "2026-05-17" } });
  const jwt = await signCredential(credential, issuer.privateKeyJwk);
  const cases = [
    ["valid", { jwt, issuer: { did: issuer.did, name: issuer.name, active: true, publicKeyJwk: issuer.publicKeyJwk }, cid: "cid", expectedCid: "cid", storedHash: hashHex(credential) }],
    ["revoked", { credential, issuer: { did: issuer.did, name: issuer.name, active: true, publicKeyJwk: issuer.publicKeyJwk }, storedHash: hashHex(credential), revoked: true }],
    ["unknownIssuer", { credential, issuer: { did: unknown.did, name: unknown.name, active: false, publicKeyJwk: unknown.publicKeyJwk }, storedHash: hashHex(credential) }],
    ["tampered", { credential: { ...credential, credentialSubject: { ...credential.credentialSubject, major: "Math" } }, issuer: { did: issuer.did, name: issuer.name, active: true, publicKeyJwk: issuer.publicKeyJwk }, storedHash: hashHex(credential) }],
    ["unavailable", { unavailable: true }],
  ] as const;
  let falseAccept = 0, falseReject = 0; const latencies: number[] = [];
  for (const [label, input] of cases) { const t = performance.now(); const result = await verifyCredential(input as any); latencies.push(performance.now() - t); if (label !== "valid" && result.valid) falseAccept++; if (label === "valid" && !result.valid) falseReject++; console.log(label, result.status, result.score, result.reasons.join("; ")); }
  latencies.sort((a,b)=>a-b); console.log(JSON.stringify({ total: cases.length, falseAccept, falseReject, accuracy: (cases.length-falseAccept-falseReject)/cases.length, avgLatencyMs: latencies.reduce((a,b)=>a+b,0)/latencies.length, p95LatencyMs: latencies[Math.floor(latencies.length*.95)] }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
