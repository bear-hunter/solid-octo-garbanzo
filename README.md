# CredVerify — Blockchain Academic Credential Verification

Issues W3C-style academic credentials signed by institutional DIDs, stores them on
IPFS, and anchors their hashes on an Ethereum-compatible registry. Credentials are
verified against on-chain proofs with an explainable six-part trust score.

## Architecture

- `contracts/` — `InstitutionRegistry` (DID authorization) and `CredentialRegistry`
  (credential-hash anchor), Solidity 0.8.28.
- `packages/credentials/` — credential crypto/VC engine plus swappable adapters:
  `EthersRegistryAdapter` (Hardhat/Sepolia), `MemoryRegistryAdapter`,
  `KuboStorageAdapter` (IPFS), `LocalStorageAdapter`.
- `apps/web/` — Next.js app: repository layer, service layer, API routes, and the
  Issuer / Holder / Verifier UI.

## Configuration

Copy `.env.example` to `.env`. Key switches:

- `CHAIN_MODE` = `local` (Hardhat, default) | `sepolia` | `memory`
- `IPFS_MODE` = `kubo` (default) | `local`

If a selected backend is unreachable, the app falls back to `memory` / `local`
automatically.

## Commands

- `pnpm install`
- `pnpm chain` — local Hardhat node
- `pnpm deploy` — deploy both contracts to the local node (writes `deployments.localhost.json`)
- `pnpm ipfs` — local Kubo IPFS node via Docker
- `pnpm dev` — Next.js app and API
- `pnpm test` — credential and adapter unit tests
- `pnpm test:contracts` — Solidity contract tests
- `pnpm test:e2e` — service-layer integration test
- `pnpm typecheck` / `pnpm build`
- `pnpm evaluate` — verification metrics harness

## Full local run

```
pnpm install
pnpm chain        # terminal 1
pnpm deploy       # terminal 2, once the node is up
pnpm ipfs         # terminal 3 (optional; falls back to local storage)
pnpm dev          # terminal 4
```

ZKP selective disclosure and a PostgreSQL persistence backend are documented as
future work; the repository interface makes the latter a drop-in swap.
