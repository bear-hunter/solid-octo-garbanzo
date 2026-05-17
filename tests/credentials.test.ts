import { describe, expect, it } from "vitest";
import { createAcademicCredential, generateIdentity, hashHex, signCredential, verifyCredential, verifyCredentialJwt } from "@acme/credentials";

describe("academic credential verification", () => {
  it("signs and verifies a valid academic credential", async () => {
    const issuer = await generateIdentity("University");
    const student = await generateIdentity("Student");
    const credential = createAcademicCredential({ issuerDid: issuer.did, subject: { id: student.did, studentId: "S1", name: "Ada", degree: "BS", major: "CS", graduationDate: "2026-05-17", gpa: 4 } });
    const jwt = await signCredential(credential, issuer.privateKeyJwk);
    await expect(verifyCredentialJwt(jwt, issuer.publicKeyJwk)).resolves.toMatchObject({ id: credential.id });
    const result = await verifyCredential({ jwt, issuer: { did: issuer.did, name: "University", active: true, publicKeyJwk: issuer.publicKeyJwk }, cid: "cid1", expectedCid: "cid1", storedHash: hashHex(credential) });
    expect(result.status).toBe("valid");
    expect(result.score).toBe(100);
  });

  it("detects revocation and tampering", async () => {
    const issuer = await generateIdentity("University");
    const student = await generateIdentity("Student");
    const credential = createAcademicCredential({ issuerDid: issuer.did, subject: { id: student.did, studentId: "S1", name: "Ada", degree: "BS", major: "CS", graduationDate: "2026-05-17" } });
    const revoked = await verifyCredential({ credential, issuer: { did: issuer.did, name: "University", active: true, publicKeyJwk: issuer.publicKeyJwk }, storedHash: hashHex(credential), revoked: true });
    expect(revoked.status).toBe("revoked");
    const tampered = await verifyCredential({ credential: { ...credential, credentialSubject: { ...credential.credentialSubject, degree: "PhD" } }, issuer: { did: issuer.did, name: "University", active: true, publicKeyJwk: issuer.publicKeyJwk }, storedHash: hashHex(credential) });
    expect(tampered.status).toBe("tampered");
  });
});
