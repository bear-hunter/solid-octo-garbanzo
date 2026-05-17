import { z } from "zod";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { SignJWT, jwtVerify, importJWK, exportJWK, type JWK } from "jose";

export const CredentialSubjectSchema = z.object({
  id: z.string().startsWith("did:"),
  studentId: z.string(),
  name: z.string(),
  degree: z.string(),
  major: z.string(),
  graduationDate: z.string(),
  gpa: z.number().min(0).max(4).optional(),
});

export const AcademicCredentialSchema = z.object({
  "@context": z.array(z.string()),
  id: z.string(),
  type: z.array(z.string()),
  issuer: z.string().startsWith("did:"),
  issuanceDate: z.string(),
  credentialSubject: CredentialSubjectSchema,
});

export type CredentialSubject = z.infer<typeof CredentialSubjectSchema>;
export type AcademicCredential = z.infer<typeof AcademicCredentialSchema>;
export type VerificationStatus = "valid" | "invalid" | "revoked" | "unknownIssuer" | "tampered" | "unavailable";
export type TrustScoreBreakdown = { schema: number; issuer: number; signature: number; contentIntegrity: number; onChain: number; revocation: number };
export type VerificationResult = { status: VerificationStatus; valid: boolean; score: number; breakdown: TrustScoreBreakdown; reasons: string[]; credential?: AcademicCredential };
export type InstitutionRecord = { did: string; name: string; active: boolean; publicKeyJwk: JWK };
export type CredentialRecord = { id: string; jwt: string; credential: AcademicCredential; cid: string; hash: string; issuerDid: string; subjectDid: string; revoked?: boolean; reason?: string };
export type AuditEvent = { id: string; credentialId: string; type: string; actor: string; note: string; createdAt: string; metadata?: Record<string, unknown> };
export type VerificationCheck = { status: VerificationStatus; score: number; checkedAt: string; reasons: string[] };
export type CredentialSharePayload = { id?: string; cid?: string; jwt?: string; shareId?: string };
export type RegistryAdapter = { registerCredential(record: { credentialHash: string; cid: string; issuerDid: string; subjectDidHash: string }): Promise<void>; revokeCredential(credentialHash: string, reason: string): Promise<void>; getCredential(credentialHash: string): Promise<{ credentialHash: string; cid: string; issuerDid: string; revoked: boolean } | undefined> };
export type CredentialStorageAdapter = { addCredential(credential: AcademicCredential): Promise<{ cid: string; hash: string }>; getCredential(cid: string): Promise<AcademicCredential | undefined> };

const enc = new TextEncoder();
export function canonicalJson(value: unknown): string { return JSON.stringify(value, Object.keys(flattenKeys(value)).sort()); }
function flattenKeys(value: any, acc: Record<string, true> = {}) { if (value && typeof value === "object" && !Array.isArray(value)) for (const [k,v] of Object.entries(value)) { acc[k] = true; flattenKeys(v, acc); } return acc; }
export function hashHex(value: unknown): string { return "0x" + bytesToHex(sha256(enc.encode(typeof value === "string" ? value : canonicalJson(value)))); }
export function didFromJwk(jwk: JWK): string { return `did:example:${hashHex(JSON.stringify(jwk)).slice(2,18)}`; }

export async function generateIdentity(name = "User") {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKeyJwk = await exportJWK(pair.publicKey);
  const privateKeyJwk = await exportJWK(pair.privateKey);
  return { did: didFromJwk(publicKeyJwk), name, publicKeyJwk, privateKeyJwk };
}

export function createAcademicCredential(input: { issuerDid: string; subject: CredentialSubject; id?: string; issuanceDate?: string }): AcademicCredential {
  return AcademicCredentialSchema.parse({
    "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
    id: input.id ?? `urn:uuid:${crypto.randomUUID()}`,
    type: ["VerifiableCredential", "AcademicCredential"],
    issuer: input.issuerDid,
    issuanceDate: input.issuanceDate ?? new Date().toISOString(),
    credentialSubject: input.subject,
  });
}

export async function signCredential(credential: AcademicCredential, privateKeyJwk: JWK): Promise<string> {
  AcademicCredentialSchema.parse(credential);
  const key = await importJWK(privateKeyJwk, "ES256");
  return new SignJWT({ vc: credential }).setProtectedHeader({ alg: "ES256", typ: "JWT" }).setIssuer(credential.issuer).setSubject(credential.credentialSubject.id).setJti(credential.id).setIssuedAt().sign(key);
}

export async function verifyCredentialJwt(jwt: string, publicKeyJwk: JWK): Promise<AcademicCredential> {
  const key = await importJWK(publicKeyJwk, "ES256");
  const { payload } = await jwtVerify(jwt, key);
  return AcademicCredentialSchema.parse(payload.vc);
}

export async function verifyCredential(input: { jwt?: string; credential?: AcademicCredential; issuer?: InstitutionRecord; cid?: string; storedHash?: string; expectedCid?: string; revoked?: boolean; unavailable?: boolean }): Promise<VerificationResult> {
  const breakdown: TrustScoreBreakdown = { schema: 0, issuer: 0, signature: 0, contentIntegrity: 0, onChain: 0, revocation: 0 };
  const reasons: string[] = [];
  let credential = input.credential;
  if (input.unavailable) return { status: "unavailable", valid: false, score: 0, breakdown, reasons: ["Credential content is unavailable"] };
  try {
    if (input.jwt && input.issuer) { credential = await verifyCredentialJwt(input.jwt, input.issuer.publicKeyJwk); breakdown.signature = 20; }
    credential = AcademicCredentialSchema.parse(credential); breakdown.schema = 15;
  } catch { reasons.push("Schema or signature verification failed"); return { status: "invalid", valid: false, score: 0, breakdown, reasons }; }
  if (!input.issuer?.active || input.issuer.did !== credential.issuer) reasons.push("Issuer is not authorized"); else breakdown.issuer = 20;
  const h = hashHex(credential); if (input.storedHash && input.storedHash !== h) reasons.push("Credential content hash does not match registry"); else breakdown.contentIntegrity = 20;
  if (input.expectedCid && input.cid && input.expectedCid !== input.cid) reasons.push("CID does not match registry"); else breakdown.onChain = 15;
  if (input.revoked) reasons.push("Credential has been revoked"); else breakdown.revocation = 10;
  const score = Object.values(breakdown).reduce((a,b)=>a+b,0);
  const status: VerificationStatus = input.revoked ? "revoked" : reasons.some(r=>r.includes("Issuer")) ? "unknownIssuer" : reasons.some(r=>r.includes("hash") || r.includes("CID")) ? "tampered" : reasons.length ? "invalid" : "valid";
  return { status, valid: status === "valid", score, breakdown, reasons, credential };
}
