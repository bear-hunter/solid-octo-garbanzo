# Blockchain Academic Credential Verification Prototype

Local TypeScript/Solidity thesis prototype for issuing and verifying W3C-style academic credentials with DID-like identities, signed VC JWTs, IPFS-style CIDs, and EVM registry contracts.

## Commands

- `pnpm install`
- `pnpm dev` - Next.js app/API
- `pnpm chain` - local Hardhat chain
- `pnpm ipfs` - local Kubo through Docker Compose
- `pnpm test` - credential tests
- `pnpm test:contracts` - Solidity tests
- `pnpm evaluate` - verification metrics harness

ZKP selective disclosure is intentionally deferred as future work.
