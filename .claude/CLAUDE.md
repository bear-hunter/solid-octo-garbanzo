# CredVerify · Project Notes

Blockchain academic credential verification. Next.js 15 app at `apps/web` + `@acme/credentials` package + Solidity contracts. Three roles: Issuer / Holder / Verifier. Adapters swap by env: `CHAIN_MODE` = local | sepolia | memory, `IPFS_MODE` = kubo | local. Falls back to memory/local if backend unreachable.

## Local run

Four terminals (chain, deploy, optional ipfs, dev). Or just `pnpm dev` and adapters fall back. After contracts redeploy, restart dev so it picks up new addresses from `deployments.localhost.json`.

`pnpm` lives at `~/.nvm/versions/node/v20.20.2/bin/pnpm` — not on default PATH for non-interactive shells. Prepend that path or use a node v20 shell.

## Lessons Learned

- [FAIL][nextdev-build-collision]: Running `pnpm build` while `pnpm dev` is serving clobbers `.next/`, breaking dev with `Cannot find module './555.js'`. Kill dev before build, or wipe `.next/` and restart dev after.
- [FAIL][pnpm-not-on-path]: Bare `pnpm` fails with exit 127 in non-interactive shells (`pnpm not found`). Use full path `~/.nvm/versions/node/v20.20.2/bin/pnpm` or prefix `PATH=…` inline.
- [WORKS][hardhat-already-listening]: If `pnpm chain` errors `EADDRINUSE: 127.0.0.1:8545`, hardhat is already running. `lsof -i :8545` to confirm; reuse the running node. Only re-deploy if `deployments.localhost.json` is missing.
- [BASELINE][manuscript-vellum-ui]: Full Manuscript Vellum reskin shipped on branch `feat/manuscript-vellum` — fonts via `next/font/google` (Cormorant Garamond + EB Garamond + IM Fell English SC + IM Fell DW Pica), masthead 3-col, illuminated factors, wax-seal diploma, slow-spin seal SVG. Verified on 2026-05-20 — all 4 routes render, API smoke (seed → verify → tampered → share-link) green.
- [WORKS][verify-tampered-payload]: Altering `credential.credentialSubject.degree` and POSTing `{id, credential}` to `/api/credentials/verify` yields `status:"tampered"`, `score:60`, `reasons:["Credential content hash does not match registry"]`.
