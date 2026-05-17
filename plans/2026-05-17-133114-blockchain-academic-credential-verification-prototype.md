# Blockchain Academic Credential Verification Prototype

## Summary

Build a greenfield TypeScript monorepo implementing the thesis draft as a working local demo: institutions issue W3C-style academic Verifiable Credentials, credential JSON is stored on local IPFS, proof hashes are registered on a local Ethereum-compatible chain, students hold credential links/JWTs, and verifiers check issuer authorization, signature validity, IPFS content integrity, on-chain proof matching, and revocation status.

Use Next.js + TypeScript + Solidity + Hardhat + local IPFS. ZKP is deferred and documented as future work.

## Draft Analysis

- Core required system: issuer, student/holder, verifier, DID identity, VC credential model, IPFS metadata storage, EVM smart contract registry, verification portal, audit trail, and evaluation metrics.
- The draft sometimes describes "trust scoring" and "heuristic scoring"; implement this as an explainable verification score, but make cryptographic failures decisive.
- Store only hashes/CIDs and registry metadata on-chain, never raw academic records.
- Use simulated academic transcripts only, matching the draft's stated scope and avoiding real PII.
- Treat ZKP as out of scope for v1 because the draft defines it but the main objectives can be fully demonstrated without circuits.

## Key Implementation Changes

- Initialize a pnpm TypeScript workspace with three main parts: Next.js app/API, Solidity contracts with Hardhat, and shared credential/schema utilities.
- Implement identity using local DID-compatible identities:
  - Institutions and students get generated local keypairs.
  - Institution DID records are registered on-chain as authorized issuers.
  - Secrets stay in untracked local env/dev key files.
- Implement Solidity contracts:
  - `InstitutionRegistry`: register, activate/deactivate, and resolve authorized institution DIDs.
  - `CredentialRegistry`: register credential hash/CID, issuer DID, subject DID hash, issued timestamp, and revocation status.
  - Emit issuance and revocation events for audit trails.
- Implement VC issuance:
  - Generate simulated transcript/diploma credentials.
  - Validate payloads with JSON Schema/Zod.
  - Sign credentials as VC-JWT or equivalent W3C-compatible verifiable credential format.
  - Upload signed credential JSON to local IPFS/Kubo.
  - Register the credential content hash and CID on the local chain.
- Implement verifier workflow:
  - Accept credential file, JWT, CID, or share link.
  - Retrieve credential from IPFS when needed.
  - Verify schema, issuer DID authorization, signature, hash match, CID match, and revocation status.
  - Return `valid`, `invalid`, `revoked`, `unknownIssuer`, `tampered`, or `unavailable` with an explainable trust score and failure reasons.
- Implement UI workflows:
  - Institution dashboard for issuing and revoking credentials.
  - Student/holder page for viewing owned credentials and copying verifier links.
  - Verifier page for checking a credential and seeing audit details.
- Implement evaluation harness:
  - Generate fixture batches for valid, tampered, revoked, unknown issuer, malformed, missing IPFS, and delayed gateway scenarios.
  - Report verification accuracy, false accept/reject counts, average latency, p95 latency, and failure categories.

## Public Interfaces

- API routes:
  - `POST /api/identities/institution`
  - `POST /api/identities/student`
  - `POST /api/credentials/issue`
  - `POST /api/credentials/revoke`
  - `POST /api/credentials/verify`
  - `GET /api/credentials/:id/audit`
- Shared types:
  - `AcademicCredential`
  - `CredentialSubject`
  - `VerificationResult`
  - `TrustScoreBreakdown`
  - `InstitutionRecord`
- Local dev commands:
  - `pnpm dev` starts the Next.js app.
  - `pnpm chain` starts the local Hardhat chain.
  - `pnpm ipfs` starts local IPFS through Docker Compose.
  - `pnpm test`, `pnpm test:contracts`, `pnpm test:e2e`, and `pnpm evaluate` validate the implementation.

## Test Plan

- Contract tests for issuer authorization, credential registration, duplicate prevention, revocation, unauthorized issuance, and event emission.
- Credential tests for schema validation, signing, signature verification, tamper detection, DID mismatch, and malformed payloads.
- Integration tests covering issue -> IPFS store -> on-chain register -> verify -> revoke -> verify again.
- UI smoke tests for issuer, holder, and verifier paths.
- Evaluation script tests confirming fixture labels match expected verification outcomes.
- Final validation: lint, typecheck, full test suite, local build, and one manual demo run.

## Assumptions

- First implementation is a thesis/research prototype, not production infrastructure.
- Blockchain target is local Hardhat only; no public testnet/mainnet deployment unless separately requested.
- IPFS target is local Kubo via Docker Compose.
- No real student records, credentials, private keys, seed phrases, RPC tokens, or API tokens are committed.
- ZKP is documented as future work after the DID/VC/IPFS/EVM verification flow is complete.
