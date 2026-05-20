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
export type VerificationCheckStatus = "verified" | "warning" | "failed" | "unavailable" | "not_applicable";
export type VerificationCheckKey = keyof TrustScoreBreakdown;
export type VerificationCheckDetail = { key: VerificationCheckKey; status: VerificationCheckStatus; message: string };
export type VerificationResult = { status: VerificationStatus; valid: boolean; score: number; breakdown: TrustScoreBreakdown; checks: VerificationCheckDetail[]; reasons: string[]; credential?: AcademicCredential };
export type InstitutionRecord = { did: string; name: string; active: boolean; publicKeyJwk: JWK };
export type CredentialRecord = { id: string; jwt: string; credential: AcademicCredential; cid: string; hash: string; issuerDid: string; subjectDid: string; revoked?: boolean; reason?: string };
export type AuditEvent = { id: string; credentialId: string; type: string; actor: string; note: string; createdAt: string; metadata?: Record<string, unknown> };
export type VerificationCheck = { status: VerificationStatus; score: number; checkedAt: string; reasons: string[] };
export type CredentialSharePayload = { id?: string; cid?: string; jwt?: string; shareId?: string };

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
  if (input.unavailable) return { status: "unavailable", valid: false, score: 0, breakdown, checks: makeChecks("unavailable", breakdown, ["Credential content is unavailable"]), reasons: ["Credential content is unavailable"] };
  try {
    if (input.jwt && input.issuer) { credential = await verifyCredentialJwt(input.jwt, input.issuer.publicKeyJwk); breakdown.signature = 20; }
    credential = AcademicCredentialSchema.parse(credential); breakdown.schema = 15;
  } catch { reasons.push("Schema or signature verification failed"); return { status: "invalid", valid: false, score: 0, breakdown, checks: makeChecks("invalid", breakdown, reasons), reasons }; }
  if (!input.issuer?.active || input.issuer.did !== credential.issuer) reasons.push("Issuer is not authorized"); else breakdown.issuer = 20;
  const h = hashHex(credential); if (input.storedHash && input.storedHash !== h) reasons.push("Credential content hash does not match registry"); else breakdown.contentIntegrity = 20;
  if (input.expectedCid && input.cid && input.expectedCid !== input.cid) reasons.push("CID does not match registry"); else breakdown.onChain = 15;
  if (input.revoked) reasons.push("Credential has been revoked"); else breakdown.revocation = 10;
  const score = Object.values(breakdown).reduce((a,b)=>a+b,0);
  const status: VerificationStatus = input.revoked ? "revoked" : reasons.some(r=>r.includes("Issuer")) ? "unknownIssuer" : reasons.some(r=>r.includes("hash") || r.includes("CID")) ? "tampered" : reasons.length ? "invalid" : "valid";
  return { status, valid: status === "valid", score, breakdown, checks: makeChecks(status, breakdown, reasons), reasons, credential };
}

function makeChecks(status: VerificationStatus, breakdown: TrustScoreBreakdown, reasons: string[]): VerificationCheckDetail[] {
  const failed = (text: string) => reasons.some((reason) => reason.toLowerCase().includes(text));
  if (status === "unavailable") {
    return (["signature", "issuer", "onChain", "revocation", "contentIntegrity", "schema"] as VerificationCheckKey[]).map((key) => ({
      key,
      status: "unavailable",
      message: "This check could not be completed because credential content or registry evidence was unavailable.",
    }));
  }
  return [
    { key: "signature", status: breakdown.signature > 0 ? "verified" : "failed", message: breakdown.signature > 0 ? "Signature matches the credential payload." : "Signature verification failed or was not available." },
    { key: "issuer", status: breakdown.issuer > 0 ? "verified" : "failed", message: breakdown.issuer > 0 ? "Issuer DID is active and matches the credential." : "Issuer DID is missing, inactive, or does not match the credential." },
    { key: "onChain", status: breakdown.onChain > 0 ? "verified" : "failed", message: breakdown.onChain > 0 ? "Credential anchor matches the registry record." : "Credential anchor or CID does not match the registry." },
    { key: "revocation", status: breakdown.revocation > 0 ? "verified" : "failed", message: breakdown.revocation > 0 ? "Credential is not revoked." : "Credential has been revoked." },
    { key: "contentIntegrity", status: breakdown.contentIntegrity > 0 ? "verified" : "failed", message: breakdown.contentIntegrity > 0 ? "Credential content matches the anchored hash." : "Credential content hash does not match the registry." },
    { key: "schema", status: breakdown.schema > 0 && !failed("schema") ? "verified" : "failed", message: breakdown.schema > 0 && !failed("schema") ? "Credential is well-formed." : "Credential schema or validity verification failed." },
  ];
}

export * from "./adapters";
