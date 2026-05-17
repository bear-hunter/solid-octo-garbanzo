# CredVerify — Full Build Design

**Date:** 2026-05-17
**Status:** Approved
**Topic:** Implement the paper's core objectives into the codebase — real blockchain integration, real IPFS storage, and a production-grade frontend/backend.

## Context

The repository (`blockchain-academic-credential-verification`) contains a working
credential/identity/verification engine and standalone, Hardhat-tested Solidity
contracts — but the contracts are **not wired into the running app**. The Next.js
app simulates the chain with an in-memory `Map` (`registryRecords`) and fake CIDs
(`bafy-local-*`). The frontend is a 75-line skeleton with a single line of CSS.

This build closes that gap so the paper's five objectives are literally true in
the code:

1. DID-based identity management.
2. A smart-contract hash registry on a public ledger.
3. A verification program that pulls metadata from IPFS and matches it to on-chain proofs.
4. Evaluation of verification success rate.
5. Verification-latency metrics.

## Approved Decisions

| Area | Decision |
| --- | --- |
| Blockchain | Adapter pattern — local Hardhat default (`CHAIN_MODE=local`), Sepolia behind a flag (`CHAIN_MODE=sepolia`), in-memory fallback (`memory`). |
| Storage | Real local IPFS / Kubo node (`IPFS_MODE=kubo`), deterministic local CID fallback (`IPFS_MODE=local`). |
| Persistence | File-based store refactored into a typed repository layer. On-chain registry is the source of truth for credential status. |
| Design | Academic institutional — ink-navy + parchment, serif display, diploma-style cards, mono for hashes/DIDs. |

## Architecture

```
contracts/
  InstitutionRegistry.sol     unchanged
  CredentialRegistry.sol      unchanged
scripts/
  deploy.ts                   NEW — deploys both contracts, writes deployments.<network>.json
  evaluate.ts                 existing metrics harness
packages/credentials/src/
  index.ts                    existing crypto / VC / verifyCredential engine (core unchanged)
  adapters/                   NEW
    registry-hardhat.ts        ethers v6 -> local Hardhat node
    registry-sepolia.ts        ethers v6 -> Sepolia testnet (env-gated)
    registry-memory.ts         in-memory RegistryAdapter (tests / fallback)
    storage-kubo.ts            real IPFS via Kubo HTTP API
    storage-local.ts           deterministic CID + on-disk JSON fallback
apps/web/
  lib/repository.ts           NEW — file store refactored behind typed repo interface
  lib/chain.ts                NEW — adapter selection from CHAIN_MODE / IPFS_MODE, with fallback
  lib/services.ts             NEW — issue / revoke / verify orchestration
  app/api/...                 existing routes re-backed by services
  app/...                     rebuilt frontend (Issuer / Holder / Verifier)
```

### Adapter selection

- `CHAIN_MODE` = `local` (default) | `sepolia` | `memory`.
- `IPFS_MODE` = `kubo` (default) | `local`.
- On startup, `lib/chain.ts` health-checks the selected backend. If a `local`
  Hardhat node or `kubo` IPFS node is unreachable, it falls back to `memory` /
  `local` and records the degraded mode so the UI can show it. A defense never
  hard-fails.

## Components

### Chain layer

- **`scripts/deploy.ts`** — deploys `InstitutionRegistry`, then
  `CredentialRegistry(institutionRegistryAddress)`. Writes
  `deployments.<network>.json` containing addresses and ABIs.
- **`HardhatRegistryAdapter`** — ethers v6 `JsonRpcProvider` to
  `127.0.0.1:8545`, signs with a Hardhat dev account that owns
  `InstitutionRegistry`. `registerCredential` / `revokeCredential` send real
  transactions; `getCredential` reads on-chain state. Returns `{ txHash,
  blockNumber, gasUsed }` for the UI.
- **`SepoliaRegistryAdapter`** — same `RegistryAdapter` interface; reads RPC URL
  and private key from `.env`. Built but not required to run for the defense.
- **`MemoryRegistryAdapter`** — implements `RegistryAdapter` with an in-memory
  map; used by unit tests and as the no-chain fallback.
- Institution DIDs are registered on-chain via
  `InstitutionRegistry.registerInstitution` when an institution is created, so
  the contract's `isAuthorized` gate is genuinely exercised on issuance.

### Storage layer

- **`KuboStorageAdapter`** — `POST`s the signed credential JSON to Kubo
  `/api/v0/add`, returns the real CID; `getCredential` fetches it back through
  the gateway. Startup health-check.
- **`LocalStorageAdapter`** — deterministic `bafy-local-*` CID with JSON written
  to disk; fallback only.
- Only `hash`, `cid`, `issuerDid`, `subjectDidHash`, and `status` go on-chain.
  The full signed VC JSON lives off-chain in IPFS — matching the paper.

### Repository layer (`apps/web/lib/repository.ts`)

`_store.ts` refactored: same JSON-file persistence, exposed as `repo.credentials`,
`repo.institutions`, `repo.students`, `repo.audit`, `repo.shareLinks` with typed
CRUD. This is the app's index/cache; on-chain registry is the source of truth for
credential status.

### Service layer (`apps/web/lib/services.ts`)

- **issue**: build VC -> sign ES256 JWT -> `storage.add()` (real CID) ->
  `hashHex` -> `registry.registerCredential()` (real tx) -> persist row +
  registry record with tx hash/block -> audit.
- **revoke**: `registry.revokeCredential()` tx -> update row -> audit.
- **verify**: load row -> fetch JSON from IPFS by CID -> recompute hash ->
  `registry.getCredential()` on-chain read -> run existing `verifyCredential()`
  trust-score engine against on-chain truth -> audit.

## API Surface

Existing routes kept, re-backed by services (now genuinely on-chain):

- `POST /api/credentials/issue`
- `POST /api/credentials/revoke`
- `POST /api/credentials/verify`
- `GET  /api/credentials`
- `GET  /api/credentials/:id/audit`
- `GET  /api/identities`, `POST /api/identities/institution`, `POST /api/identities/student`
- `POST /api/share-links`
- `GET  /api/dashboard/issuer`, `GET /api/dashboard/holder`
- `POST /api/demo/reset`

New:

- `GET /api/chain/status` — chain mode, contract addresses, current block
  height, IPFS health. Powers a live infrastructure panel.

## Frontend — Academic Institutional

A real design system replacing the 1-line stylesheet.

- **Palette**: ink-navy `#1a2238`, parchment `#f4efe4`, seal-gold `#a8842c`,
  verified-green, revoked-crimson.
- **Type**: serif display for headings and diploma text, clean sans for UI,
  monospace for hashes / DIDs / tx data.
- **Shell**: top nav — Issuer / Holder / Verifier — plus a live chain-status pill
  (mode, block #, IPFS health).
- **Issuer**: dashboard metrics, issue-credential wizard, credential table with
  revoke action, audit drawer. Shows the real tx hash + block number after
  issuing.
- **Holder**: credentials rendered as diploma cards (seal, guilloché border,
  serif), status badge, copy JWT/CID, share link + QR.
- **Verifier** (public, no login): paste payload / open share link -> trust
  result with the 6-part score bar (schema / issuer / signature / content
  integrity / on-chain / revocation), explainable checklist, audit timeline.
  States: `valid` / `revoked` / `tampered` / `unknownIssuer` / `unavailable`. A
  "verify tampered copy" action demonstrates forgery detection live.
- A guided presentation seed loads realistic starting data.

## Data Flow — issue then verify

1. Issuer creates an institution DID -> registered on-chain in `InstitutionRegistry`.
2. Issuer fills the wizard -> service builds the W3C VC, signs it (ES256 JWT).
3. Service adds the VC JSON to IPFS -> real CID.
4. Service computes `hashHex(credential)` and calls
   `CredentialRegistry.registerCredential` -> real tx (authorized-issuer gate enforced on-chain).
5. Repository stores the row + registry record (tx hash, block).
6. Verifier submits a payload -> service fetches JSON from IPFS, recomputes the
   hash, reads `getCredential` on-chain, runs `verifyCredential` -> trust score
   and explainable breakdown.

## Error Handling

- Unreachable Hardhat / Kubo -> automatic fallback to `memory` / `local`, surfaced
  in the chain-status pill and `GET /api/chain/status`.
- On-chain `registerCredential` revert (duplicate, unauthorized issuer) ->
  surfaced as a typed service error and a clear UI message.
- IPFS fetch failure during verify -> `unavailable` verification status (existing
  engine path).
- Malformed verifier input -> validated, returns a clear error rather than throwing.

## Test Plan

- Unit: `verifyCredential` states (valid / revoked / tampered / unknownIssuer /
  unavailable); adapter behavior against `memory` / `local` adapters.
- Contract: existing Hardhat tests — duplicate prevention, unauthorized issuer
  rejection, revocation, event reads.
- Integration: service flow issue -> IPFS -> chain -> verify -> revoke ->
  re-verify on an in-process Hardhat chain.
- Final gate: `pnpm test`, `pnpm test:contracts`, `pnpm typecheck`, `pnpm build`.

## Out of Scope

- **ZKP selective disclosure** — defined in the paper's terms but marked future
  work in the README; the five objectives do not require it. Left as future work.
- **PostgreSQL / Prisma** — file store chosen; Postgres remains a documented
  future swap (the repository interface makes it a drop-in).
- **Heavyweight Auth.js login** — replaced by a lightweight role selector; the
  Verifier page is genuinely public.

## Assumptions

- Target is thesis-defense / portfolio-MVP quality, not audited production SaaS.
- Default environment is local for reliability: Hardhat + Kubo via the existing
  `docker-compose.yml`, with fallbacks if Docker is unavailable.
- Simulated academic data remains the default; no real student PII is committed.
