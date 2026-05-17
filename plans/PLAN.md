# Presentation-Grade Full Stack Credential App

## Summary
Transform the current thesis demo into a polished Portfolio MVP with real persistence, role-based workflows, and presentation-reliable blockchain/IPFS integration. The app should feel like a credible academic credential platform for three users: institution admin, student holder, and verifier.

Current baseline is healthy: `pnpm test`, `pnpm typecheck`, `pnpm test:contracts`, and `pnpm build` all pass.

## Key Changes
- Replace the in-memory demo store with PostgreSQL + Prisma:
  - Models: users, institutions, students, credentials, audit events, verification checks, issuer keys, and chain/IPFS registry records.
  - Add Docker Postgres beside the existing IPFS service.
  - Move seed/reset behavior into scripts, not visible primary UX.

- Add real app structure:
  - Auth.js credential login with seeded exam accounts for Institution, Student, and Verifier roles.
  - Protected dashboards for issuer and holder.
  - Public verifier page that works without login.
  - Shared service layer for issuing, revoking, verifying, audit lookup, IPFS storage, and chain registry access.

- Make chain/IPFS presentation-grade:
  - Keep local Hardhat + Kubo as the default reliable exam mode.
  - Add adapters so the same app can later use testnet RPC and real IPFS pinning.
  - Actually register credential hashes/CIDs through the Solidity contracts instead of simulating `local-*` CIDs.
  - Store raw academic credential JSON off-chain only; chain stores hash/CID/status metadata.

- Redesign UX around the full journey:
  - Institution dashboard: overview metrics, issue credential wizard, credential table, revocation flow, audit drawer.
  - Student wallet: credential cards, status badges, share link/QR, JWT/CID copy, human-readable credential view.
  - Verifier portal: paste/upload/share-link input, instant trust result, explainable checklist, audit timeline, “valid/revoked/tampered/unavailable” states.
  - Add a polished presentation mode with preloaded realistic records and a guided flow, but avoid labeling the product as a demo in the UI.

## Public APIs / Interfaces
- Keep and harden existing routes, but back them with services + DB:
  - `POST /api/credentials/issue`
  - `POST /api/credentials/revoke`
  - `POST /api/credentials/verify`
  - `GET /api/credentials/:id/audit`
  - `GET /api/credentials`
  - `GET /api/identities`

- Add:
  - `GET /api/dashboard/issuer`
  - `GET /api/dashboard/holder`
  - `POST /api/share-links`
  - `GET /verify/:shareId`

- Expand shared types:
  - `CredentialRecord`
  - `AuditEvent`
  - `VerificationCheck`
  - `CredentialSharePayload`
  - `RegistryAdapter`
  - `CredentialStorageAdapter`

## Test Plan
- Unit tests for credential schema validation, signing, verification, tamper detection, revocation, issuer mismatch, and malformed payloads.
- Service tests for issue → persist → IPFS add → chain register → verify → revoke → verify again.
- Contract tests for duplicate prevention, unauthorized issuer rejection, revocation, and event reads.
- API tests for role authorization, invalid inputs, missing records, and verifier public access.
- UI smoke tests for issuer, holder, and verifier happy paths.
- Final validation: `pnpm test`, `pnpm test:contracts`, `pnpm typecheck`, `pnpm build`, plus one manual presentation walkthrough.

## Assumptions
- Target is Portfolio MVP / final-exam presentation quality, not audited production SaaS.
- All three personas matter; verifier gets the strongest first impression because it proves trust quickly.
- Default environment stays local for reliability: Postgres, Hardhat, and Kubo via Docker/local commands.
- Testnet/IPFS pinning support is planned behind adapters, but not required for the first polished exam build.
- Simulated academic data remains the default; no real student PII or secrets are committed.
