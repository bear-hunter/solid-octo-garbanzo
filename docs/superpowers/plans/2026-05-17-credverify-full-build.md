# CredVerify Full Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Solidity contracts and a real IPFS node into the running app behind swappable adapters, and rebuild the frontend/backend so the paper's five objectives are literally true in the code.

**Architecture:** Adapter pattern. `packages/credentials` gains `RegistryAdapter` (ethers v6 → Hardhat/Sepolia, plus an in-memory fallback) and `CredentialStorageAdapter` (Kubo IPFS, plus a local fallback) implementations. `apps/web` gets a repository layer (refactored file store), a chain-selection module, a dependency-injected service layer, and a rebuilt academic-institutional UI.

**Tech Stack:** TypeScript, Next.js 15, React 19, Solidity 0.8.28, Hardhat, ethers v6, Kubo IPFS, Vitest, pnpm workspaces.

---

## File Structure

**Create:**
- `scripts/deploy.ts` — deploys both contracts, writes `deployments.<network>.json`
- `packages/credentials/src/adapters/types.ts` — adapter interfaces and shared chain types
- `packages/credentials/src/adapters/index.ts` — adapter barrel export
- `packages/credentials/src/adapters/registry-memory.ts` — in-memory `RegistryAdapter`
- `packages/credentials/src/adapters/registry-ethers.ts` — ethers v6 `RegistryAdapter` (local + sepolia)
- `packages/credentials/src/adapters/storage-local.ts` — deterministic-CID `CredentialStorageAdapter`
- `packages/credentials/src/adapters/storage-kubo.ts` — Kubo IPFS `CredentialStorageAdapter`
- `packages/credentials/src/adapters/registry-memory.test.ts`
- `packages/credentials/src/adapters/storage-local.test.ts`
- `apps/web/lib/repository.ts` — typed file-backed data store
- `apps/web/lib/chain.ts` — adapter selection from env, with health-check fallback
- `apps/web/lib/services.ts` — `createCredentialService` dependency-injected orchestration
- `apps/web/lib/service-instance.ts` — cached default service singleton for API routes
- `apps/web/app/api/chain/status/route.ts` — chain/IPFS status endpoint
- `apps/web/app/components/` — `ChainStatusPill.tsx`, `StatusBadge.tsx`, `ScoreBar.tsx`, `DiplomaCard.tsx`, `CopyButton.tsx`, `RoleNav.tsx`
- `.env.example`
- `tests/integration.test.ts` — full service flow on memory + local adapters

**Modify:**
- `.gitignore` — ignore `deployments.*.json`, `.data/`, `.env`
- `hardhat.config.ts` — declare the `localhost` network explicitly
- `package.json` — add `deploy` script
- `packages/credentials/src/index.ts` — remove old adapter type stubs, re-export `./adapters`
- All 12 API routes under `apps/web/app/api/` — re-back with the service layer
- `apps/web/app/style.css` — full academic-institutional design system
- `apps/web/app/layout.tsx`, `page.tsx`, `issue/IssuePage.tsx`, `holder/HolderPage.tsx`, `verify/VerifyPage.tsx` — rebuilt UI

**Delete:**
- `apps/web/app/api/_store.ts` — replaced by `repository.ts` + `services.ts`
- `apps/web/app/DemoApp.tsx` — unused after rebuild

---

## Task 1: Environment config and contract deploy script

**Files:**
- Modify: `.gitignore`
- Modify: `hardhat.config.ts`
- Modify: `package.json`
- Create: `.env.example`
- Create: `scripts/deploy.ts`

- [ ] **Step 1: Update `.gitignore`**

Append these lines to `.gitignore`:

```
deployments.*.json
.data/
.env
```

- [ ] **Step 2: Declare the localhost network in `hardhat.config.ts`**

Replace the whole file with:

```ts
import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  paths: { sources: "contracts", tests: "test/contracts" },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
  },
};

export default config;
```

- [ ] **Step 3: Create `.env.example`**

```
# Chain adapter: local | sepolia | memory
CHAIN_MODE=local
# IPFS adapter: kubo | local
IPFS_MODE=kubo

# Local Hardhat node
LOCAL_RPC_URL=http://127.0.0.1:8545
# Hardhat dev account #0 (deployer + registry owner) — public test key, safe to commit
LOCAL_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Sepolia (only needed when CHAIN_MODE=sepolia)
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=

# Kubo IPFS RPC + gateway
IPFS_API_URL=http://127.0.0.1:5001
IPFS_GATEWAY_URL=http://127.0.0.1:8080
```

- [ ] **Step 4: Add the `deploy` script to `package.json`**

In the `scripts` object, add after `"chain"`:

```json
"deploy": "hardhat run scripts/deploy.ts --network localhost",
```

- [ ] **Step 5: Create `scripts/deploy.ts`**

```ts
import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const Institutions = await hre.ethers.getContractFactory("InstitutionRegistry");
  const institutions = await Institutions.deploy();
  await institutions.waitForDeployment();
  const institutionRegistry = await institutions.getAddress();

  const Credentials = await hre.ethers.getContractFactory("CredentialRegistry");
  const credentials = await Credentials.deploy(institutionRegistry);
  await credentials.waitForDeployment();
  const credentialRegistry = await credentials.getAddress();

  const network = hre.network.name;
  const file = join(process.cwd(), `deployments.${network}.json`);
  writeFileSync(
    file,
    JSON.stringify({ network, institutionRegistry, credentialRegistry, deployedAt: new Date().toISOString() }, null, 2),
  );
  console.log(`Deployed to ${network}`);
  console.log(`  InstitutionRegistry: ${institutionRegistry}`);
  console.log(`  CredentialRegistry:  ${credentialRegistry}`);
  console.log(`  Wrote ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 6: Verify contracts still compile**

Run: `pnpm exec hardhat compile`
Expected: `Compiled 2 Solidity files successfully` (or "Nothing to compile" if cached).

- [ ] **Step 7: Verify existing contract tests still pass**

Run: `pnpm test:contracts`
Expected: `1 passing` — the `registries` suite.

- [ ] **Step 8: Commit**

```bash
git add .gitignore hardhat.config.ts package.json .env.example scripts/deploy.ts
git commit -m "Add contract deploy script and chain env config"
```

---

## Task 2: Adapter interfaces

**Files:**
- Create: `packages/credentials/src/adapters/types.ts`
- Create: `packages/credentials/src/adapters/index.ts`
- Modify: `packages/credentials/src/index.ts:35-36`

- [ ] **Step 1: Create `packages/credentials/src/adapters/types.ts`**

```ts
import type { AcademicCredential } from "../index";

export type ChainReceipt = {
  mode: string;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  simulated: boolean;
};

export type OnChainCredential = {
  credentialHash: string;
  cid: string;
  issuerDid: string;
  revoked: boolean;
  revocationReason: string;
  issuedAt: number;
};

export type RegistryStatus = {
  mode: string;
  ok: boolean;
  blockNumber?: number;
  addresses?: { institutionRegistry?: string; credentialRegistry?: string };
  detail?: string;
};

export type StorageStatus = {
  mode: string;
  ok: boolean;
  gateway?: string;
  detail?: string;
};

export interface RegistryAdapter {
  readonly mode: string;
  registerInstitution(did: string, name: string): Promise<ChainReceipt>;
  isAuthorized(did: string): Promise<boolean>;
  registerCredential(input: {
    credentialHash: string;
    cid: string;
    issuerDid: string;
    subjectDidHash: string;
  }): Promise<ChainReceipt>;
  revokeCredential(credentialHash: string, reason: string): Promise<ChainReceipt>;
  getCredential(credentialHash: string): Promise<OnChainCredential | undefined>;
  status(): Promise<RegistryStatus>;
}

export interface CredentialStorageAdapter {
  readonly mode: string;
  add(credential: AcademicCredential): Promise<{ cid: string }>;
  get(cid: string): Promise<AcademicCredential | undefined>;
  status(): Promise<StorageStatus>;
}
```

- [ ] **Step 2: Replace the old adapter type stubs in `index.ts`**

In `packages/credentials/src/index.ts`, delete the two type lines (currently lines 35-36) that define `RegistryAdapter` and `CredentialStorageAdapter`:

```ts
export type RegistryAdapter = { registerCredential(record: { credentialHash: string; cid: string; issuerDid: string; subjectDidHash: string }): Promise<void>; revokeCredential(credentialHash: string, reason: string): Promise<void>; getCredential(credentialHash: string): Promise<{ credentialHash: string; cid: string; issuerDid: string; revoked: boolean } | undefined> };
export type CredentialStorageAdapter = { addCredential(credential: AcademicCredential): Promise<{ cid: string; hash: string }>; getCredential(cid: string): Promise<AcademicCredential | undefined> };
```

Then add this line at the very end of `index.ts`:

```ts
export * from "./adapters";
```

- [ ] **Step 3: Create `packages/credentials/src/adapters/index.ts`**

```ts
export * from "./types";
export { MemoryRegistryAdapter } from "./registry-memory";
export { EthersRegistryAdapter } from "./registry-ethers";
export { LocalStorageAdapter } from "./storage-local";
export { KuboStorageAdapter } from "./storage-kubo";
```

Note: this file references modules created in Tasks 3-6. Typecheck in Step 4 will fail until those exist — that is expected; this task ends after the file is written.

- [ ] **Step 4: Commit**

```bash
git add packages/credentials/src/adapters/types.ts packages/credentials/src/adapters/index.ts packages/credentials/src/index.ts
git commit -m "Define RegistryAdapter and CredentialStorageAdapter interfaces"
```

---

## Task 3: In-memory registry adapter

**Files:**
- Create: `packages/credentials/src/adapters/registry-memory.ts`
- Test: `packages/credentials/src/adapters/registry-memory.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/credentials/src/adapters/registry-memory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MemoryRegistryAdapter } from "./registry-memory";

describe("MemoryRegistryAdapter", () => {
  const sample = { credentialHash: "0xabc", cid: "cid1", issuerDid: "did:example:1", subjectDidHash: "0xdef" };

  it("rejects credentials from unauthorized issuers", async () => {
    const reg = new MemoryRegistryAdapter();
    await expect(reg.registerCredential(sample)).rejects.toThrow(/not authorized/);
  });

  it("registers, reads back, and revokes a credential for an authorized issuer", async () => {
    const reg = new MemoryRegistryAdapter();
    await reg.registerInstitution("did:example:1", "Test University");
    expect(await reg.isAuthorized("did:example:1")).toBe(true);

    const receipt = await reg.registerCredential(sample);
    expect(receipt.simulated).toBe(true);

    const record = await reg.getCredential("0xabc");
    expect(record).toMatchObject({ cid: "cid1", revoked: false });

    await reg.revokeCredential("0xabc", "issued in error");
    expect((await reg.getCredential("0xabc"))?.revoked).toBe(true);
  });

  it("rejects duplicate credential hashes", async () => {
    const reg = new MemoryRegistryAdapter();
    await reg.registerInstitution("did:example:1", "Test University");
    await reg.registerCredential(sample);
    await expect(reg.registerCredential(sample)).rejects.toThrow(/duplicate/);
  });

  it("reports ok status", async () => {
    expect((await new MemoryRegistryAdapter().status()).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run packages/credentials/src/adapters/registry-memory.test.ts`
Expected: FAIL — cannot find module `./registry-memory`.

- [ ] **Step 3: Implement `packages/credentials/src/adapters/registry-memory.ts`**

```ts
import type { ChainReceipt, OnChainCredential, RegistryAdapter, RegistryStatus } from "./types";

/**
 * In-process RegistryAdapter. Mirrors the on-chain require() rules of
 * CredentialRegistry.sol so behavior is identical to the real chain. Used for
 * tests and as the fallback when no chain node is reachable.
 */
export class MemoryRegistryAdapter implements RegistryAdapter {
  readonly mode = "memory";
  private institutions = new Set<string>();
  private credentials = new Map<string, OnChainCredential>();

  async registerInstitution(did: string): Promise<ChainReceipt> {
    this.institutions.add(did);
    return { mode: this.mode, simulated: true };
  }

  async isAuthorized(did: string): Promise<boolean> {
    return this.institutions.has(did);
  }

  async registerCredential(input: {
    credentialHash: string;
    cid: string;
    issuerDid: string;
    subjectDidHash: string;
  }): Promise<ChainReceipt> {
    if (!this.institutions.has(input.issuerDid)) throw new Error("issuer not authorized");
    if (this.credentials.has(input.credentialHash)) throw new Error("duplicate credential");
    this.credentials.set(input.credentialHash, {
      credentialHash: input.credentialHash,
      cid: input.cid,
      issuerDid: input.issuerDid,
      revoked: false,
      revocationReason: "",
      issuedAt: Math.floor(Date.now() / 1000),
    });
    return { mode: this.mode, simulated: true };
  }

  async revokeCredential(credentialHash: string, reason: string): Promise<ChainReceipt> {
    const record = this.credentials.get(credentialHash);
    if (!record) throw new Error("missing credential");
    if (record.revoked) throw new Error("already revoked");
    record.revoked = true;
    record.revocationReason = reason;
    return { mode: this.mode, simulated: true };
  }

  async getCredential(credentialHash: string): Promise<OnChainCredential | undefined> {
    const record = this.credentials.get(credentialHash);
    return record ? { ...record } : undefined;
  }

  async status(): Promise<RegistryStatus> {
    return { mode: this.mode, ok: true, detail: "In-memory simulated registry" };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run packages/credentials/src/adapters/registry-memory.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/credentials/src/adapters/registry-memory.ts packages/credentials/src/adapters/registry-memory.test.ts
git commit -m "Add in-memory registry adapter"
```

---

## Task 4: Local storage adapter

**Files:**
- Create: `packages/credentials/src/adapters/storage-local.ts`
- Test: `packages/credentials/src/adapters/storage-local.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/credentials/src/adapters/storage-local.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAcademicCredential } from "../index";
import { LocalStorageAdapter } from "./storage-local";

function sampleCredential() {
  return createAcademicCredential({
    issuerDid: "did:example:issuer",
    subject: { id: "did:example:student", studentId: "S1", name: "Ada", degree: "BS", major: "CS", graduationDate: "2026-05-17" },
  });
}

describe("LocalStorageAdapter", () => {
  it("stores a credential and reads it back by CID", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ipfs-local-"));
    const storage = new LocalStorageAdapter(dir);
    const credential = sampleCredential();

    const { cid } = await storage.add(credential);
    expect(cid).toMatch(/^bafy-local-/);

    const fetched = await storage.get(cid);
    expect(fetched).toEqual(credential);
  });

  it("produces deterministic CIDs for identical content", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ipfs-local-"));
    const storage = new LocalStorageAdapter(dir);
    const credential = sampleCredential();
    const a = await storage.add(credential);
    const b = await storage.add(credential);
    expect(a.cid).toBe(b.cid);
  });

  it("returns undefined for an unknown CID and ok status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ipfs-local-"));
    const storage = new LocalStorageAdapter(dir);
    expect(await storage.get("bafy-local-missing")).toBeUndefined();
    expect((await storage.status()).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run packages/credentials/src/adapters/storage-local.test.ts`
Expected: FAIL — cannot find module `./storage-local`.

- [ ] **Step 3: Implement `packages/credentials/src/adapters/storage-local.ts`**

```ts
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, hashHex, type AcademicCredential } from "../index";
import type { CredentialStorageAdapter, StorageStatus } from "./types";

/**
 * Off-chain storage fallback. Writes credential JSON to disk under a
 * content-derived, deterministic CID. Used when no Kubo IPFS node is reachable.
 */
export class LocalStorageAdapter implements CredentialStorageAdapter {
  readonly mode = "local";

  constructor(private readonly dir: string = join(process.cwd(), ".data", "ipfs-local")) {}

  private cidFor(credential: AcademicCredential): string {
    return `bafy-local-${hashHex(canonicalJson(credential)).slice(2, 34)}`;
  }

  async add(credential: AcademicCredential): Promise<{ cid: string }> {
    mkdirSync(this.dir, { recursive: true });
    const cid = this.cidFor(credential);
    writeFileSync(join(this.dir, `${cid}.json`), canonicalJson(credential));
    return { cid };
  }

  async get(cid: string): Promise<AcademicCredential | undefined> {
    const file = join(this.dir, `${cid}.json`);
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as AcademicCredential;
  }

  async status(): Promise<StorageStatus> {
    return { mode: this.mode, ok: true, detail: "Local disk-backed CID store" };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run packages/credentials/src/adapters/storage-local.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/credentials/src/adapters/storage-local.ts packages/credentials/src/adapters/storage-local.test.ts
git commit -m "Add local-disk storage adapter"
```

---

## Task 5: Ethers registry adapter (Hardhat + Sepolia)

**Files:**
- Create: `packages/credentials/src/adapters/registry-ethers.ts`

This adapter talks to the real Solidity contracts. It cannot be unit-tested without a running node, so verification here is a typecheck plus a graceful-degradation check (its `status()` must report `ok: false` rather than throw when no node is reachable). The real on-chain path is exercised by `pnpm test:contracts` and the integration walkthrough.

- [ ] **Step 1: Implement `packages/credentials/src/adapters/registry-ethers.ts`**

```ts
import { ethers } from "ethers";
import type { ChainReceipt, OnChainCredential, RegistryAdapter, RegistryStatus } from "./types";

const INSTITUTION_ABI = [
  "function registerInstitution(string did, string name) external",
  "function setActive(string did, bool active) external",
  "function isAuthorized(string did) external view returns (bool)",
];

const CREDENTIAL_ABI = [
  "function registerCredential(bytes32 credentialHash, string cid, string issuerDid, bytes32 subjectDidHash) external",
  "function revokeCredential(bytes32 credentialHash, string reason) external",
  "function getCredential(bytes32 credentialHash) external view returns (tuple(bytes32 credentialHash, string cid, string issuerDid, bytes32 subjectDidHash, uint256 issuedAt, bool revoked, string revocationReason))",
];

export type EthersRegistryConfig = {
  mode: string;
  rpcUrl: string;
  privateKey: string;
  institutionRegistry: string;
  credentialRegistry: string;
};

/**
 * RegistryAdapter backed by the real Solidity contracts via ethers v6.
 * Works against any EVM RPC endpoint — local Hardhat (mode "local") or a public
 * testnet (mode "sepolia"). Sends real transactions and reads on-chain state.
 */
export class EthersRegistryAdapter implements RegistryAdapter {
  readonly mode: string;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly institutions: ethers.Contract;
  private readonly credentials: ethers.Contract;

  constructor(private readonly config: EthersRegistryConfig) {
    this.mode = config.mode;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.institutions = new ethers.Contract(config.institutionRegistry, INSTITUTION_ABI, wallet);
    this.credentials = new ethers.Contract(config.credentialRegistry, CREDENTIAL_ABI, wallet);
  }

  private receipt(tx: ethers.ContractTransactionReceipt | null): ChainReceipt {
    return {
      mode: this.mode,
      txHash: tx?.hash,
      blockNumber: tx?.blockNumber,
      gasUsed: tx?.gasUsed?.toString(),
      simulated: false,
    };
  }

  async registerInstitution(did: string, name: string): Promise<ChainReceipt> {
    if (await this.institutions.isAuthorized(did)) return { mode: this.mode, simulated: false };
    const tx = await this.institutions.registerInstitution(did, name);
    return this.receipt(await tx.wait());
  }

  async isAuthorized(did: string): Promise<boolean> {
    return this.institutions.isAuthorized(did);
  }

  async registerCredential(input: {
    credentialHash: string;
    cid: string;
    issuerDid: string;
    subjectDidHash: string;
  }): Promise<ChainReceipt> {
    const tx = await this.credentials.registerCredential(
      input.credentialHash,
      input.cid,
      input.issuerDid,
      input.subjectDidHash,
    );
    return this.receipt(await tx.wait());
  }

  async revokeCredential(credentialHash: string, reason: string): Promise<ChainReceipt> {
    const tx = await this.credentials.revokeCredential(credentialHash, reason);
    return this.receipt(await tx.wait());
  }

  async getCredential(credentialHash: string): Promise<OnChainCredential | undefined> {
    const record = await this.credentials.getCredential(credentialHash);
    if (!record || Number(record.issuedAt) === 0) return undefined;
    return {
      credentialHash: record.credentialHash,
      cid: record.cid,
      issuerDid: record.issuerDid,
      revoked: record.revoked,
      revocationReason: record.revocationReason,
      issuedAt: Number(record.issuedAt),
    };
  }

  async status(): Promise<RegistryStatus> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return {
        mode: this.mode,
        ok: true,
        blockNumber,
        addresses: {
          institutionRegistry: this.config.institutionRegistry,
          credentialRegistry: this.config.credentialRegistry,
        },
      };
    } catch (error) {
      return { mode: this.mode, ok: false, detail: error instanceof Error ? error.message : "RPC unreachable" };
    }
  }
}
```

- [ ] **Step 2: Verify the package typechecks**

Run: `pnpm typecheck`
Expected: PASS — no errors (the `adapters/index.ts` barrel now resolves all modules except `storage-kubo`, created next; if `storage-kubo` errors, that is expected and resolved in Task 6).

If the only errors are about `./storage-kubo`, proceed. Otherwise fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/credentials/src/adapters/registry-ethers.ts
git commit -m "Add ethers-backed registry adapter for Hardhat and Sepolia"
```

---

## Task 6: Kubo IPFS storage adapter

**Files:**
- Create: `packages/credentials/src/adapters/storage-kubo.ts`

The Kubo adapter calls the IPFS HTTP RPC API directly with `fetch` (no SDK dependency). It cannot be unit-tested without a running node; verification is a typecheck plus the graceful-degradation contract (`status()` returns `ok: false` when the node is down).

- [ ] **Step 1: Implement `packages/credentials/src/adapters/storage-kubo.ts`**

```ts
import { canonicalJson, AcademicCredentialSchema, type AcademicCredential } from "../index";
import type { CredentialStorageAdapter, StorageStatus } from "./types";

export type KuboConfig = { apiUrl: string; gatewayUrl: string };

/**
 * CredentialStorageAdapter backed by a real Kubo IPFS node via its HTTP RPC API.
 * Produces genuine content-addressed CIDs. The signed credential JSON lives
 * here off-chain; only its hash and CID are anchored on-chain.
 */
export class KuboStorageAdapter implements CredentialStorageAdapter {
  readonly mode = "kubo";

  constructor(private readonly config: KuboConfig) {}

  async add(credential: AcademicCredential): Promise<{ cid: string }> {
    const form = new FormData();
    form.append("file", new Blob([canonicalJson(credential)], { type: "application/json" }));
    const res = await fetch(`${this.config.apiUrl}/api/v0/add?cid-version=1&pin=true`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`IPFS add failed: ${res.status}`);
    const parsed = JSON.parse(await res.text()) as { Hash: string };
    return { cid: parsed.Hash };
  }

  async get(cid: string): Promise<AcademicCredential | undefined> {
    const res = await fetch(`${this.config.apiUrl}/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
      method: "POST",
    });
    if (!res.ok) return undefined;
    return AcademicCredentialSchema.parse(JSON.parse(await res.text()));
  }

  async status(): Promise<StorageStatus> {
    try {
      const res = await fetch(`${this.config.apiUrl}/api/v0/version`, { method: "POST" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const version = JSON.parse(await res.text()) as { Version: string };
      return { mode: this.mode, ok: true, gateway: this.config.gatewayUrl, detail: `Kubo ${version.Version}` };
    } catch (error) {
      return { mode: this.mode, ok: false, detail: error instanceof Error ? error.message : "IPFS unreachable" };
    }
  }
}
```

- [ ] **Step 2: Verify the whole workspace typechecks**

Run: `pnpm typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Run the full adapter test suite**

Run: `pnpm test`
Expected: PASS — existing credential tests plus the memory + local adapter tests.

- [ ] **Step 4: Commit**

```bash
git add packages/credentials/src/adapters/storage-kubo.ts
git commit -m "Add Kubo IPFS storage adapter"
```

---

## Task 7: Repository layer

**Files:**
- Create: `apps/web/lib/repository.ts`

This refactors the data-store half of `_store.ts` into a typed, file-backed repository. It holds no business logic — issuing/verifying moves to the service layer in Task 9. `_store.ts` is not deleted yet (Task 10 does that, after routes are migrated).

- [ ] **Step 1: Create `apps/web/lib/repository.ts`**

```ts
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AcademicCredential } from "@acme/credentials";
import type { JWK } from "jose";

export type Role = "institution" | "student" | "verifier";
export type UserRecord = { id: string; name: string; email: string; role: Role; did?: string };
export type StudentRecord = { did: string; name: string; publicKeyJwk: JWK; privateKeyJwk: JWK };
export type InstitutionPrivateRecord = {
  did: string;
  name: string;
  active: boolean;
  publicKeyJwk: JWK;
  privateKeyJwk: JWK;
};
export type StoredCredential = {
  id: string;
  jwt: string;
  credential: AcademicCredential;
  cid: string;
  hash: string;
  issuerDid: string;
  subjectDid: string;
  revoked?: boolean;
  reason?: string;
  createdAt: string;
  chain?: { mode: string; txHash?: string; blockNumber?: number; gasUsed?: string; simulated: boolean };
  revokeChain?: { mode: string; txHash?: string; blockNumber?: number; gasUsed?: string; simulated: boolean };
  storageMode?: string;
};
export type AuditEvent = {
  id: string;
  credentialId: string;
  type: string;
  actor: string;
  note: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
export type RegistryRecord = {
  credentialId: string;
  credentialHash: string;
  cid: string;
  issuerDid: string;
  subjectDidHash: string;
  status: "active" | "revoked";
  updatedAt: string;
};
export type ShareLink = { id: string; credentialId: string; createdAt: string };

type PersistedStore = {
  users: UserRecord[];
  institutions: InstitutionPrivateRecord[];
  students: StudentRecord[];
  credentials: StoredCredential[];
  auditEvents: AuditEvent[];
  registryRecords: RegistryRecord[];
  shareLinks: ShareLink[];
};

export type Repository = {
  readonly dbPath: string;
  users: Map<string, UserRecord>;
  institutions: Map<string, InstitutionPrivateRecord>;
  students: Map<string, StudentRecord>;
  credentials: Map<string, StoredCredential>;
  auditEvents: AuditEvent[];
  registryRecords: Map<string, RegistryRecord>;
  shareLinks: Map<string, ShareLink>;
  persist(): void;
  reset(): void;
};

function emptyPersisted(): PersistedStore {
  return { users: [], institutions: [], students: [], credentials: [], auditEvents: [], registryRecords: [], shareLinks: [] };
}

export function createRepository(dbPath: string): Repository {
  const data: PersistedStore = existsSync(dbPath)
    ? (() => {
        try {
          return JSON.parse(readFileSync(dbPath, "utf8")) as PersistedStore;
        } catch {
          return emptyPersisted();
        }
      })()
    : emptyPersisted();

  const repo: Repository = {
    dbPath,
    users: new Map(data.users.map((row) => [row.id, row])),
    institutions: new Map(data.institutions.map((row) => [row.did, row])),
    students: new Map(data.students.map((row) => [row.did, row])),
    credentials: new Map(data.credentials.map((row) => [row.id, row])),
    auditEvents: data.auditEvents,
    registryRecords: new Map(data.registryRecords.map((row) => [row.credentialHash, row])),
    shareLinks: new Map(data.shareLinks.map((row) => [row.id, row])),
    persist() {
      mkdirSync(dirname(dbPath), { recursive: true });
      const snapshot: PersistedStore = {
        users: [...repo.users.values()],
        institutions: [...repo.institutions.values()],
        students: [...repo.students.values()],
        credentials: [...repo.credentials.values()],
        auditEvents: repo.auditEvents,
        registryRecords: [...repo.registryRecords.values()],
        shareLinks: [...repo.shareLinks.values()],
      };
      writeFileSync(dbPath, JSON.stringify(snapshot, null, 2));
    },
    reset() {
      repo.users.clear();
      repo.institutions.clear();
      repo.students.clear();
      repo.credentials.clear();
      repo.auditEvents.splice(0);
      repo.registryRecords.clear();
      repo.shareLinks.clear();
      repo.users.set("verifier", {
        id: "verifier",
        name: "Public Verifier",
        email: "verifier@example.org",
        role: "verifier",
      });
    },
  };
  return repo;
}

const globalStore = globalThis as typeof globalThis & { __credentialRepository?: Repository };

/** Default process-wide repository, persisted to .data/credential-store.json. */
export const repo: Repository = (globalStore.__credentialRepository ??= createRepository(
  join(process.cwd(), ".data", "credential-store.json"),
));
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/repository.ts
git commit -m "Add typed file-backed repository layer"
```

---

## Task 8: Chain adapter selection

**Files:**
- Create: `apps/web/lib/chain.ts`

- [ ] **Step 1: Create `apps/web/lib/chain.ts`**

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EthersRegistryAdapter,
  KuboStorageAdapter,
  LocalStorageAdapter,
  MemoryRegistryAdapter,
  type CredentialStorageAdapter,
  type RegistryAdapter,
} from "@acme/credentials";

const HARDHAT_ACCOUNT_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Deployment = { institutionRegistry: string; credentialRegistry: string };

function readDeployment(network: string): Deployment | undefined {
  const file = join(process.cwd(), `deployments.${network}.json`);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Deployment;
  } catch {
    return undefined;
  }
}

/**
 * Builds the RegistryAdapter selected by CHAIN_MODE. If the requested chain
 * (local Hardhat or Sepolia) is unreachable or undeployed, falls back to the
 * in-memory adapter so the app never hard-fails during a demo.
 */
export async function resolveRegistryAdapter(): Promise<RegistryAdapter> {
  const mode = process.env.CHAIN_MODE ?? "local";

  if (mode === "memory") return new MemoryRegistryAdapter();

  if (mode === "local") {
    const deployment = readDeployment("localhost");
    if (deployment) {
      const adapter = new EthersRegistryAdapter({
        mode: "local",
        rpcUrl: process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545",
        privateKey: process.env.LOCAL_PRIVATE_KEY ?? HARDHAT_ACCOUNT_0,
        institutionRegistry: deployment.institutionRegistry,
        credentialRegistry: deployment.credentialRegistry,
      });
      if ((await adapter.status()).ok) return adapter;
    }
    return new MemoryRegistryAdapter();
  }

  if (mode === "sepolia") {
    const deployment = readDeployment("sepolia");
    if (deployment && process.env.SEPOLIA_RPC_URL && process.env.SEPOLIA_PRIVATE_KEY) {
      const adapter = new EthersRegistryAdapter({
        mode: "sepolia",
        rpcUrl: process.env.SEPOLIA_RPC_URL,
        privateKey: process.env.SEPOLIA_PRIVATE_KEY,
        institutionRegistry: deployment.institutionRegistry,
        credentialRegistry: deployment.credentialRegistry,
      });
      if ((await adapter.status()).ok) return adapter;
    }
    return new MemoryRegistryAdapter();
  }

  return new MemoryRegistryAdapter();
}

/**
 * Builds the CredentialStorageAdapter selected by IPFS_MODE. Falls back to the
 * local disk adapter when the Kubo node is unreachable.
 */
export async function resolveStorageAdapter(): Promise<CredentialStorageAdapter> {
  const mode = process.env.IPFS_MODE ?? "kubo";
  if (mode === "kubo") {
    const adapter = new KuboStorageAdapter({
      apiUrl: process.env.IPFS_API_URL ?? "http://127.0.0.1:5001",
      gatewayUrl: process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8080",
    });
    if ((await adapter.status()).ok) return adapter;
  }
  return new LocalStorageAdapter();
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/chain.ts
git commit -m "Add env-driven chain adapter selection with fallback"
```

---

## Task 9: Service layer

**Files:**
- Create: `apps/web/lib/services.ts`
- Test: `tests/integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

`tests/integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryRegistryAdapter, LocalStorageAdapter } from "@acme/credentials";
import { createRepository } from "../apps/web/lib/repository";
import { createCredentialService } from "../apps/web/lib/services";

function buildService() {
  const dir = mkdtempSync(join(tmpdir(), "credverify-"));
  return createCredentialService({
    repo: createRepository(join(dir, "store.json")),
    registry: new MemoryRegistryAdapter(),
    storage: new LocalStorageAdapter(join(dir, "ipfs")),
  });
}

describe("credential service end-to-end", () => {
  it("issues, verifies, revokes, and re-verifies a credential", async () => {
    const service = buildService();
    const institution = await service.makeInstitution("Northbridge State University");
    const student = await service.makeStudent("Ada Lovelace");

    const issued = await service.issue({
      issuerDid: institution.did,
      subjectDid: student.did,
      subject: { studentId: "NSU-1", degree: "BS", major: "CS", graduationDate: "2026-05-17", gpa: 3.9 },
    });
    expect(issued.cid).toBeTruthy();
    expect(issued.chain?.mode).toBe("memory");

    const ok = await service.verify({ id: issued.id });
    expect(ok.status).toBe("valid");
    expect(ok.score).toBe(100);

    await service.revoke(issued.id, "Issued in error");
    const revoked = await service.verify({ id: issued.id });
    expect(revoked.status).toBe("revoked");
  });

  it("detects a tampered credential", async () => {
    const service = buildService();
    const institution = await service.makeInstitution("Northbridge State University");
    const student = await service.makeStudent("Ada Lovelace");
    const issued = await service.issue({ issuerDid: institution.did, subjectDid: student.did });

    const tampered = {
      ...issued.credential,
      credentialSubject: { ...issued.credential.credentialSubject, degree: "Doctor of Philosophy" },
    };
    const result = await service.verify({ id: issued.id, credential: tampered });
    expect(result.status).toBe("tampered");
  });

  it("seeds presentation records with a verifiable credential", async () => {
    const service = buildService();
    const seeded = await service.seedPresentationRecords();
    const result = await service.verify({ shareId: seeded.share.id });
    expect(result.status).toBe("valid");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/integration.test.ts`
Expected: FAIL — cannot find module `../apps/web/lib/services`.

- [ ] **Step 3: Implement `apps/web/lib/services.ts`**

```ts
import {
  createAcademicCredential,
  generateIdentity,
  hashHex,
  signCredential,
  verifyCredential,
  type AcademicCredential,
  type CredentialStorageAdapter,
  type RegistryAdapter,
  type VerificationResult,
} from "@acme/credentials";
import type { AuditEvent, Repository, StoredCredential } from "./repository";

export type ServiceDeps = {
  repo: Repository;
  registry: RegistryAdapter;
  storage: CredentialStorageAdapter;
};

export type IssueInput = {
  issuerDid: string;
  subjectDid: string;
  subject?: Partial<AcademicCredential["credentialSubject"]>;
};

export type VerifyInput = {
  id?: string;
  cid?: string;
  jwt?: string;
  shareId?: string;
  credential?: AcademicCredential;
};

const now = () => new Date().toISOString();

function audit(
  repo: Repository,
  credentialId: string,
  type: string,
  actor: string,
  note: string,
  metadata?: Record<string, unknown>,
): AuditEvent {
  const event: AuditEvent = { id: crypto.randomUUID(), credentialId, type, actor, note, createdAt: now(), metadata };
  repo.auditEvents.push(event);
  return event;
}

export function createCredentialService(deps: ServiceDeps) {
  const { repo, registry, storage } = deps;

  async function makeInstitution(name: string) {
    const id = await generateIdentity(name);
    repo.institutions.set(id.did, { ...id, active: true });
    repo.users.set(`user-${id.did}`, {
      id: `user-${id.did}`,
      name,
      email: "issuer@example.edu",
      role: "institution",
      did: id.did,
    });
    await registry.registerInstitution(id.did, name);
    repo.persist();
    return { did: id.did, name: id.name, publicKeyJwk: id.publicKeyJwk };
  }

  async function makeStudent(name: string) {
    const id = await generateIdentity(name);
    repo.students.set(id.did, id);
    repo.users.set(`user-${id.did}`, {
      id: `user-${id.did}`,
      name,
      email: "student@example.edu",
      role: "student",
      did: id.did,
    });
    repo.persist();
    return { did: id.did, name: id.name, publicKeyJwk: id.publicKeyJwk };
  }

  async function issue(input: IssueInput): Promise<StoredCredential> {
    const issuer = repo.institutions.get(input.issuerDid);
    if (!issuer?.active) throw new Error("Unknown or inactive issuer");
    const student = repo.students.get(input.subjectDid);
    const credential = createAcademicCredential({
      issuerDid: issuer.did,
      subject: {
        id: input.subjectDid,
        studentId: "SIM-001",
        name: student?.name ?? "Sample Student",
        degree: "Bachelor of Science",
        major: "Computer Science",
        graduationDate: "2026-05-17",
        gpa: 3.8,
        ...input.subject,
      },
    });
    const jwt = await signCredential(credential, issuer.privateKeyJwk);
    const hash = hashHex(credential);
    const subjectDidHash = hashHex(input.subjectDid);

    const { cid } = await storage.add(credential);
    const receipt = await registry.registerCredential({ credentialHash: hash, cid, issuerDid: issuer.did, subjectDidHash });

    const row: StoredCredential = {
      id: credential.id,
      jwt,
      credential,
      cid,
      hash,
      issuerDid: issuer.did,
      subjectDid: input.subjectDid,
      createdAt: now(),
      chain: receipt,
      storageMode: storage.mode,
    };
    repo.credentials.set(credential.id, row);
    repo.registryRecords.set(hash, {
      credentialId: credential.id,
      credentialHash: hash,
      cid,
      issuerDid: issuer.did,
      subjectDidHash,
      status: "active",
      updatedAt: row.createdAt,
    });
    audit(repo, credential.id, "issued", issuer.did, `Stored on IPFS (${storage.mode}) and anchored on-chain (${receipt.mode}).`, {
      hash,
      cid,
      txHash: receipt.txHash,
      blockNumber: receipt.blockNumber,
    });
    repo.persist();
    return row;
  }

  async function revoke(id: string, reason = "Revoked by institution"): Promise<StoredCredential | undefined> {
    const row = repo.credentials.get(id);
    if (!row) return undefined;
    const receipt = await registry.revokeCredential(row.hash, reason);
    row.revoked = true;
    row.reason = reason;
    row.revokeChain = receipt;
    const registryRecord = repo.registryRecords.get(row.hash);
    if (registryRecord) {
      registryRecord.status = "revoked";
      registryRecord.updatedAt = now();
    }
    audit(repo, id, "revoked", row.issuerDid, reason, { txHash: receipt.txHash, blockNumber: receipt.blockNumber });
    repo.persist();
    return row;
  }

  async function verify(input: VerifyInput): Promise<VerificationResult> {
    const shared = input.shareId ? repo.shareLinks.get(input.shareId) : undefined;
    const id = input.id ?? shared?.credentialId;
    const row = id
      ? repo.credentials.get(id)
      : [...repo.credentials.values()].find((item) => item.cid === input.cid || item.jwt === input.jwt);
    if (!row) {
      return { status: "unavailable", valid: false, score: 0, breakdown: emptyBreakdown(), reasons: ["Credential was not found"] };
    }

    const issuer = repo.institutions.get(row.issuerDid);
    const onChain = await registry.getCredential(row.hash);
    const offChain = input.credential ?? (await storage.get(row.cid)) ?? row.credential;

    const result = await verifyCredential({
      jwt: input.credential ? undefined : input.jwt ?? row.jwt,
      credential: offChain,
      issuer: issuer ? { did: issuer.did, name: issuer.name, active: issuer.active, publicKeyJwk: issuer.publicKeyJwk } : undefined,
      cid: input.cid ?? row.cid,
      expectedCid: onChain?.cid ?? row.cid,
      storedHash: onChain?.credentialHash ?? row.hash,
      revoked: row.revoked || onChain?.revoked === true,
      unavailable: !offChain,
    });

    audit(repo, row.id, "verified", "verifier", `Verification completed with status ${result.status}.`, {
      status: result.status,
      score: result.score,
      onChain: Boolean(onChain),
    });
    repo.persist();
    return result;
  }

  function createShareLink(credentialId: string) {
    if (!repo.credentials.has(credentialId)) throw new Error("Credential not found");
    const existing = [...repo.shareLinks.values()].find((link) => link.credentialId === credentialId);
    if (existing) return existing;
    const link = { id: crypto.randomUUID().slice(0, 8), credentialId, createdAt: now() };
    repo.shareLinks.set(link.id, link);
    audit(repo, credentialId, "shared", "holder", "Holder created a verifier share link.", { shareId: link.id });
    repo.persist();
    return link;
  }

  function getAudit(id: string) {
    return repo.auditEvents.filter((event) => event.credentialId === id);
  }

  function listCredentials() {
    return [...repo.credentials.values()];
  }

  function listIdentities() {
    return {
      institutions: [...repo.institutions.values()].map(({ privateKeyJwk, ...rest }) => rest),
      students: [...repo.students.values()].map(({ privateKeyJwk, ...rest }) => rest),
    };
  }

  function issuerDashboard() {
    const rows = listCredentials();
    return {
      metrics: {
        issued: rows.length,
        active: rows.filter((row) => !row.revoked).length,
        revoked: rows.filter((row) => row.revoked).length,
        verificationChecks: repo.auditEvents.filter((event) => event.type === "verified").length,
      },
      credentials: rows,
      auditEvents: repo.auditEvents.slice(-12).reverse(),
    };
  }

  function holderDashboard(subjectDid?: string) {
    const rows = listCredentials().filter((row) => !subjectDid || row.subjectDid === subjectDid);
    return {
      metrics: {
        held: rows.length,
        active: rows.filter((row) => !row.revoked).length,
        revoked: rows.filter((row) => row.revoked).length,
      },
      credentials: rows.map((row) => ({
        ...row,
        share: [...repo.shareLinks.values()].find((link) => link.credentialId === row.id),
      })),
    };
  }

  async function seedPresentationRecords() {
    repo.reset();
    const institution = await makeInstitution("Northbridge State University");
    const student = await makeStudent("Ada Lovelace");
    const credential = await issue({
      issuerDid: institution.did,
      subjectDid: student.did,
      subject: {
        studentId: "NSU-2026-001",
        name: "Ada Lovelace",
        degree: "Bachelor of Science",
        major: "Computer Science",
        graduationDate: "2026-05-17",
        gpa: 3.92,
      },
    });
    const share = createShareLink(credential.id);
    repo.persist();
    return { institution, student, credential, share };
  }

  async function chainStatus() {
    const [registryStatus, storageStatus] = await Promise.all([registry.status(), storage.status()]);
    return { registry: registryStatus, storage: storageStatus };
  }

  return {
    makeInstitution,
    makeStudent,
    issue,
    revoke,
    verify,
    createShareLink,
    getAudit,
    listCredentials,
    listIdentities,
    issuerDashboard,
    holderDashboard,
    seedPresentationRecords,
    chainStatus,
  };
}

function emptyBreakdown() {
  return { schema: 0, issuer: 0, signature: 0, contentIntegrity: 0, onChain: 0, revocation: 0 };
}

export type CredentialService = ReturnType<typeof createCredentialService>;
```

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `pnpm exec vitest run tests/integration.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/services.ts tests/integration.test.ts
git commit -m "Add dependency-injected credential service layer"
```

---

## Task 10: Service singleton, API routes, and chain status endpoint

**Files:**
- Create: `apps/web/lib/service-instance.ts`
- Create: `apps/web/app/api/chain/status/route.ts`
- Modify: all 12 route files under `apps/web/app/api/`
- Delete: `apps/web/app/api/_store.ts`

- [ ] **Step 1: Create `apps/web/lib/service-instance.ts`**

```ts
import { resolveRegistryAdapter, resolveStorageAdapter } from "./chain";
import { repo } from "./repository";
import { createCredentialService, type CredentialService } from "./services";

let cached: Promise<CredentialService> | undefined;

/** Lazily builds and caches the default service wired to env-selected adapters. */
export function getService(): Promise<CredentialService> {
  cached ??= (async () => {
    const [registry, storage] = await Promise.all([resolveRegistryAdapter(), resolveStorageAdapter()]);
    return createCredentialService({ repo, registry, storage });
  })();
  return cached;
}
```

- [ ] **Step 2: Rewrite `apps/web/app/api/credentials/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../lib/service-instance";

export async function GET() {
  const service = await getService();
  return NextResponse.json(service.listCredentials());
}
```

- [ ] **Step 3: Rewrite `apps/web/app/api/credentials/issue/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  try {
    const service = await getService();
    return NextResponse.json(await service.issue(await req.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Issue failed" }, { status: 400 });
  }
}
```

- [ ] **Step 4: Rewrite `apps/web/app/api/credentials/revoke/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  try {
    const { id, reason = "Revoked by institution" } = await req.json();
    const service = await getService();
    const row = await service.revoke(id, reason);
    if (!row) return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    return NextResponse.json({ id, revoked: true, reason, chain: row.revokeChain });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Revoke failed" }, { status: 400 });
  }
}
```

- [ ] **Step 5: Rewrite `apps/web/app/api/credentials/verify/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  const service = await getService();
  return NextResponse.json(await service.verify(await req.json()));
}
```

- [ ] **Step 6: Rewrite `apps/web/app/api/credentials/[id]/audit/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../../lib/service-instance";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService();
  const events = service.getAudit(id);
  return NextResponse.json({ id, events });
}
```

- [ ] **Step 7: Rewrite `apps/web/app/api/identities/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../lib/service-instance";

export async function GET() {
  const service = await getService();
  return NextResponse.json(service.listIdentities());
}
```

- [ ] **Step 8: Rewrite `apps/web/app/api/identities/institution/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  const { name = "Example University" } = await req.json().catch(() => ({}));
  const service = await getService();
  return NextResponse.json(await service.makeInstitution(name));
}
```

- [ ] **Step 9: Rewrite `apps/web/app/api/identities/student/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST(req: Request) {
  const { name = "Sample Student" } = await req.json().catch(() => ({}));
  const service = await getService();
  return NextResponse.json(await service.makeStudent(name));
}
```

- [ ] **Step 10: Rewrite `apps/web/app/api/share-links/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../lib/service-instance";

export async function POST(req: Request) {
  try {
    const { credentialId } = await req.json();
    const service = await getService();
    const share = service.createShareLink(credentialId);
    return NextResponse.json({ ...share, url: `/verify/${share.id}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create share link" },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 11: Rewrite `apps/web/app/api/dashboard/issuer/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function GET() {
  const service = await getService();
  return NextResponse.json(service.issuerDashboard());
}
```

- [ ] **Step 12: Rewrite `apps/web/app/api/dashboard/holder/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function GET(req: Request) {
  const subjectDid = new URL(req.url).searchParams.get("subjectDid") ?? undefined;
  const service = await getService();
  return NextResponse.json(service.holderDashboard(subjectDid));
}
```

- [ ] **Step 13: Rewrite `apps/web/app/api/demo/reset/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function POST() {
  const service = await getService();
  return NextResponse.json(await service.seedPresentationRecords());
}
```

- [ ] **Step 14: Create `apps/web/app/api/chain/status/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getService } from "../../../../lib/service-instance";

export async function GET() {
  const service = await getService();
  return NextResponse.json(await service.chainStatus());
}
```

- [ ] **Step 15: Delete the old store**

```bash
git rm apps/web/app/api/_store.ts
```

- [ ] **Step 16: Verify the workspace typechecks and builds**

Run: `pnpm typecheck`
Expected: PASS — no errors. (If errors mention `DemoApp.tsx`, that file is removed in Task 12; for now confirm no errors come from `lib/` or `api/`.)

Run: `pnpm build`
Expected: `Compiled successfully` and all routes listed.

- [ ] **Step 17: Commit**

```bash
git add apps/web/lib/service-instance.ts apps/web/app/api
git commit -m "Re-back API routes with the service layer; add chain status route"
```

---

## Task 11: Academic-institutional design system

**Files:**
- Modify: `apps/web/app/style.css`

- [ ] **Step 1: Replace the entire contents of `apps/web/app/style.css`**

```css
:root {
  --ink: #1a2238;
  --ink-soft: #3b465e;
  --parchment: #f4efe4;
  --parchment-deep: #eae2d0;
  --paper: #fffdf8;
  --gold: #a8842c;
  --gold-soft: #cbb277;
  --rule: #d8cfb8;
  --verified: #2f6b46;
  --revoked: #9a2333;
  --tampered: #b0641d;
  --muted: #6c7488;
  --serif: Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif;
  --sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", "Consolas", monospace;
  --shadow: 0 18px 40px -24px rgba(26, 34, 56, 0.45);
}

* { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  font-family: var(--sans);
  color: var(--ink);
  background: var(--parchment);
  background-image: radial-gradient(circle at 12% -8%, rgba(168, 132, 44, 0.1), transparent 38%);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { font-family: var(--serif); font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }
h1 { font-size: clamp(2rem, 4vw, 2.7rem); margin: 0 0 0.3rem; }
h2 { font-size: 1.35rem; margin: 0 0 0.9rem; }
h3 { font-size: 1.05rem; margin: 1.4rem 0 0.5rem; }
p { margin: 0 0 0.8rem; }
a { color: var(--gold); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ---- App shell ---- */
.shell { max-width: 1140px; margin: 0 auto; padding: 0 1.4rem 5rem; }

.topbar {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 1.1rem 1.4rem; max-width: 1140px; margin: 0 auto;
  border-bottom: 1px solid var(--rule);
}
.brand { font-family: var(--serif); font-size: 1.3rem; font-weight: 600; display: flex; align-items: center; gap: 0.55rem; }
.brand-mark {
  width: 1.7rem; height: 1.7rem; border-radius: 50%;
  border: 2px solid var(--gold); display: grid; place-items: center;
  font-size: 0.85rem; color: var(--gold);
}
.nav { display: flex; gap: 0.4rem; margin-left: auto; }
.nav a {
  padding: 0.42rem 0.95rem; border-radius: 999px; color: var(--ink-soft);
  font-size: 0.92rem; font-weight: 500;
}
.nav a:hover { background: var(--parchment-deep); text-decoration: none; }
.nav a.active { background: var(--ink); color: var(--paper); }

.intro { padding: 2.4rem 0 1.6rem; max-width: 60ch; }
.intro p { color: var(--ink-soft); font-size: 1.05rem; }

/* ---- Cards ---- */
.card {
  background: var(--paper); border: 1px solid var(--rule);
  border-radius: 14px; padding: 1.5rem; box-shadow: var(--shadow);
}
.grid { display: grid; gap: 1.1rem; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.grid.cols-4 { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.stack > * + * { margin-top: 1.1rem; }

/* ---- Metrics ---- */
.metric { background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 1.15rem 1.3rem; }
.metric b { font-family: var(--serif); display: block; font-size: 2.1rem; line-height: 1; }
.metric span { color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; }

/* ---- Forms ---- */
label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--ink-soft); margin: 0.7rem 0 0.25rem; }
input, select, textarea {
  width: 100%; font: inherit; padding: 0.6rem 0.7rem;
  border: 1px solid var(--rule); border-radius: 9px; background: var(--paper); color: var(--ink);
}
input:focus, select:focus, textarea:focus { outline: 2px solid var(--gold-soft); border-color: var(--gold); }
textarea { min-height: 130px; font-family: var(--mono); font-size: 0.85rem; resize: vertical; }

button {
  font: inherit; font-weight: 600; cursor: pointer;
  padding: 0.58rem 1.1rem; border-radius: 9px;
  border: 1px solid var(--ink); background: var(--ink); color: var(--paper);
  transition: transform 0.05s ease, opacity 0.15s ease;
}
button:hover { opacity: 0.9; }
button:active { transform: translateY(1px); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
button.ghost { background: transparent; color: var(--ink); }
button.gold { background: var(--gold); border-color: var(--gold); }
button.danger { background: var(--revoked); border-color: var(--revoked); }
.btn-row { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 0.4rem; }

/* ---- Notices ---- */
.notice {
  border-left: 3px solid var(--gold); background: var(--parchment-deep);
  padding: 0.75rem 1rem; border-radius: 0 9px 9px 0; margin: 1rem 0; font-size: 0.93rem;
}

/* ---- Mono / hashes ---- */
.mono { font-family: var(--mono); font-size: 0.82rem; word-break: break-all; }
.muted { color: var(--muted); }
pre {
  font-family: var(--mono); font-size: 0.8rem; background: var(--ink); color: #e8e4d6;
  padding: 0.9rem 1rem; border-radius: 10px; overflow: auto; max-height: 340px;
}

/* ---- Badges ---- */
.badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.25rem 0.7rem; border-radius: 999px;
  font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
}
.badge::before { content: ""; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; }
.badge.valid { color: var(--verified); background: rgba(47, 107, 70, 0.12); }
.badge.revoked { color: var(--revoked); background: rgba(154, 35, 51, 0.12); }
.badge.tampered, .badge.unknownIssuer { color: var(--tampered); background: rgba(176, 100, 29, 0.12); }
.badge.unavailable, .badge.invalid { color: var(--muted); background: rgba(108, 116, 136, 0.14); }

/* ---- Chain status pill ---- */
.pill {
  display: inline-flex; align-items: center; gap: 0.45rem;
  font-size: 0.78rem; font-family: var(--mono);
  padding: 0.3rem 0.7rem; border: 1px solid var(--rule); border-radius: 999px; background: var(--paper);
}
.dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; }
.dot.up { background: var(--verified); }
.dot.down { background: var(--tampered); }

/* ---- Diploma card ---- */
.diploma {
  position: relative; background: var(--paper);
  border: 2px solid var(--gold); border-radius: 6px;
  padding: 2rem 2.2rem; box-shadow: var(--shadow);
  background-image: repeating-linear-gradient(45deg, rgba(168,132,44,0.04) 0 10px, transparent 10px 20px);
}
.diploma::before {
  content: ""; position: absolute; inset: 7px;
  border: 1px solid var(--gold-soft); border-radius: 3px; pointer-events: none;
}
.diploma .seal {
  position: absolute; top: 1.4rem; right: 1.6rem;
  width: 3.4rem; height: 3.4rem; border-radius: 50%;
  border: 2px solid var(--gold); display: grid; place-items: center;
  font-family: var(--serif); color: var(--gold); font-size: 0.7rem; text-align: center;
}
.diploma .issuer { font-family: var(--serif); font-size: 0.82rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); }
.diploma .degree { font-family: var(--serif); font-size: 1.7rem; margin: 0.5rem 0 0.1rem; }
.diploma .holder { font-family: var(--serif); font-size: 1.15rem; font-style: italic; color: var(--ink-soft); }
.diploma .rule { border: none; border-top: 1px solid var(--rule); margin: 1.1rem 0; }
.diploma .meta { display: flex; flex-wrap: wrap; gap: 1.2rem 2rem; font-size: 0.85rem; }
.diploma .meta span { display: block; color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; }

/* ---- Score bar ---- */
.score-head { display: flex; align-items: baseline; gap: 0.6rem; }
.score-head b { font-family: var(--serif); font-size: 2.4rem; }
.score-row { display: grid; grid-template-columns: 9rem 1fr 2.6rem; align-items: center; gap: 0.7rem; margin: 0.4rem 0; font-size: 0.85rem; }
.score-track { height: 0.55rem; border-radius: 999px; background: var(--parchment-deep); overflow: hidden; }
.score-fill { height: 100%; background: var(--verified); border-radius: 999px; }
.score-fill.partial { background: var(--tampered); }

/* ---- Timeline ---- */
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li { position: relative; padding: 0 0 1rem 1.3rem; border-left: 1px solid var(--rule); }
.timeline li::before { content: ""; position: absolute; left: -0.34rem; top: 0.3rem; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--gold); }
.timeline .when { font-size: 0.75rem; color: var(--muted); }

/* ---- Table ---- */
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--rule); }
th { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }

/* ---- Home hero ---- */
.hero { padding: 3rem 0 1.5rem; }
.hero h1 { font-size: clamp(2.4rem, 5vw, 3.4rem); }
.role-cards a { display: block; color: inherit; }
.role-cards a:hover { text-decoration: none; }
.role-card { transition: transform 0.12s ease; }
.role-card:hover { transform: translateY(-3px); }
.role-card .step { font-family: var(--mono); color: var(--gold); font-size: 0.8rem; }
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `pnpm build`
Expected: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/style.css
git commit -m "Add academic-institutional design system"
```

---

## Task 12: App shell, shared components, and home page

**Files:**
- Create: `apps/web/app/components/RoleNav.tsx`
- Create: `apps/web/app/components/ChainStatusPill.tsx`
- Create: `apps/web/app/components/StatusBadge.tsx`
- Create: `apps/web/app/components/ScoreBar.tsx`
- Create: `apps/web/app/components/DiplomaCard.tsx`
- Create: `apps/web/app/components/CopyButton.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Delete: `apps/web/app/DemoApp.tsx`

- [ ] **Step 1: Create `apps/web/app/components/RoleNav.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  { href: "/issuer", label: "Issuer" },
  { href: "/holder", label: "Holder" },
  { href: "/verify", label: "Verifier" },
];

export default function RoleNav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/components/ChainStatusPill.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

type Status = {
  registry: { mode: string; ok: boolean; blockNumber?: number };
  storage: { mode: string; ok: boolean };
};

export default function ChainStatusPill() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/chain/status")
        .then((res) => res.json())
        .then((data) => active && setStatus(data))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!status) return <span className="pill">chain: …</span>;
  const chainUp = status.registry.ok;
  const block = status.registry.blockNumber;
  return (
    <span className="pill" title={`Registry: ${status.registry.mode} · Storage: ${status.storage.mode}`}>
      <span className={`dot ${chainUp ? "up" : "down"}`} />
      {status.registry.mode}
      {block !== undefined ? ` #${block}` : ""}
      <span className={`dot ${status.storage.ok ? "up" : "down"}`} />
      ipfs:{status.storage.mode}
    </span>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/components/StatusBadge.tsx`**

```tsx
const LABELS: Record<string, string> = {
  valid: "Verified",
  revoked: "Revoked",
  tampered: "Tampered",
  unknownIssuer: "Unknown Issuer",
  unavailable: "Unavailable",
  invalid: "Invalid",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{LABELS[status] ?? status}</span>;
}
```

- [ ] **Step 4: Create `apps/web/app/components/ScoreBar.tsx`**

```tsx
type Breakdown = Record<string, number>;

const MAX: Breakdown = { schema: 15, issuer: 20, signature: 20, contentIntegrity: 20, onChain: 15, revocation: 10 };
const LABELS: Record<string, string> = {
  schema: "Schema",
  issuer: "Issuer",
  signature: "Signature",
  contentIntegrity: "Content hash",
  onChain: "On-chain CID",
  revocation: "Revocation",
};

export default function ScoreBar({ score, breakdown }: { score: number; breakdown?: Breakdown }) {
  return (
    <div>
      <div className="score-head">
        <b>{score}</b>
        <span className="muted">/ 100 trust score</span>
      </div>
      {breakdown &&
        Object.entries(MAX).map(([key, max]) => {
          const value = breakdown[key] ?? 0;
          const full = value >= max;
          return (
            <div className="score-row" key={key}>
              <span>{LABELS[key]}</span>
              <span className="score-track">
                <span className={`score-fill ${full ? "" : "partial"}`} style={{ width: `${(value / max) * 100}%` }} />
              </span>
              <span className="mono">
                {value}/{max}
              </span>
            </div>
          );
        })}
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/app/components/DiplomaCard.tsx`**

```tsx
import StatusBadge from "./StatusBadge";

type Credential = {
  issuer: string;
  credentialSubject: { name: string; degree: string; major: string; graduationDate: string; gpa?: number };
};

export default function DiplomaCard({
  credential,
  hash,
  status,
  blockNumber,
}: {
  credential: Credential;
  hash: string;
  status: string;
  blockNumber?: number;
}) {
  const subject = credential.credentialSubject;
  return (
    <div className="diploma">
      <div className="seal">SEAL</div>
      <div className="issuer">Issued under {credential.issuer.slice(0, 22)}…</div>
      <div className="degree">{subject.degree}</div>
      <div className="muted" style={{ marginBottom: "0.6rem" }}>
        in {subject.major}
      </div>
      <div className="holder">Conferred upon {subject.name}</div>
      <hr className="rule" />
      <div className="meta">
        <div>
          <span>Graduation</span>
          {subject.graduationDate}
        </div>
        {subject.gpa !== undefined && (
          <div>
            <span>GPA</span>
            {subject.gpa.toFixed(2)}
          </div>
        )}
        <div>
          <span>Credential hash</span>
          <span className="mono">{hash.slice(0, 18)}…</span>
        </div>
        {blockNumber !== undefined && (
          <div>
            <span>Anchored block</span>#{blockNumber}
          </div>
        )}
      </div>
      <div style={{ marginTop: "1rem" }}>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/app/components/CopyButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
```

- [ ] **Step 7: Rewrite `apps/web/app/layout.tsx`**

```tsx
import "./style.css";
import Link from "next/link";
import RoleNav from "./components/RoleNav";
import ChainStatusPill from "./components/ChainStatusPill";

export const metadata = {
  title: "CredVerify — Academic Credential Verification",
  description: "Blockchain-anchored, self-sovereign academic credential issuance and verification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark">CV</span>
            CredVerify
          </Link>
          <ChainStatusPill />
          <RoleNav />
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Rewrite `apps/web/app/page.tsx`**

```tsx
import Link from "next/link";

const ROLES = [
  { href: "/issuer", step: "01", title: "Institution", body: "Register an issuer DID, then sign and anchor academic credentials on-chain." },
  { href: "/holder", step: "02", title: "Holder", body: "Hold your credential as a portable diploma, copy its JWT/CID, and share a verifier link." },
  { href: "/verify", step: "03", title: "Verifier", body: "Check any credential against its on-chain proof and get an explainable trust score." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Academic credentials, verifiable by anyone.</h1>
        <p className="intro" style={{ padding: 0 }}>
          CredVerify issues W3C-style verifiable credentials signed by institutional DIDs, stores them on IPFS,
          and anchors their hashes on an Ethereum-compatible registry — so a degree can be verified without
          ever contacting the issuing university.
        </p>
      </section>
      <section className="grid cols-3 role-cards">
        {ROLES.map((role) => (
          <Link key={role.href} href={role.href}>
            <div className="card role-card stack">
              <div className="step">{role.step}</div>
              <h2 style={{ margin: 0 }}>{role.title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {role.body}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
```

- [ ] **Step 9: Delete the unused demo component**

```bash
git rm apps/web/app/DemoApp.tsx
```

- [ ] **Step 10: Verify typecheck and build**

Run: `pnpm typecheck`
Expected: PASS (errors from `issue/`, `holder/`, `verify/` pages are expected — those are rewritten in Tasks 13-15; confirm no errors in `components/`, `layout.tsx`, `page.tsx`).

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/components apps/web/app/layout.tsx apps/web/app/page.tsx
git commit -m "Add app shell, shared UI components, and home page"
```

---

## Task 13: Issuer page

**Files:**
- Create: `apps/web/app/issuer/page.tsx`
- Create: `apps/web/app/issuer/IssuerPage.tsx`
- Delete: `apps/web/app/issue/page.tsx`, `apps/web/app/issue/IssuePage.tsx`

- [ ] **Step 1: Create `apps/web/app/issuer/page.tsx`**

```tsx
import IssuerPage from "./IssuerPage";

export default function Page() {
  return <IssuerPage />;
}
```

- [ ] **Step 2: Create `apps/web/app/issuer/IssuerPage.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";

type Identity = { did: string; name: string };
type CredentialRow = {
  id: string;
  hash: string;
  revoked?: boolean;
  credential: { credentialSubject: { name: string; degree: string } };
  chain?: { mode: string; txHash?: string; blockNumber?: number };
};
type AuditEvent = { id: string; type: string; note: string; createdAt: string };

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function IssuerPage() {
  const [institutions, setInstitutions] = useState<Identity[]>([]);
  const [students, setStudents] = useState<Identity[]>([]);
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState({ issued: 0, active: 0, revoked: 0, verificationChecks: 0 });
  const [issuerName, setIssuerName] = useState("Northbridge State University");
  const [studentName, setStudentName] = useState("Grace Hopper");
  const [issuerDid, setIssuerDid] = useState("");
  const [studentDid, setStudentDid] = useState("");
  const [form, setForm] = useState({ studentId: "NSU-2026-014", degree: "Bachelor of Science", major: "Computer Science", graduationDate: "2026-05-17", gpa: "3.85" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const ids = await api("/api/identities");
    const dash = await api("/api/dashboard/issuer");
    setInstitutions(ids.institutions);
    setStudents(ids.students);
    setRows(dash.credentials);
    setEvents(dash.auditEvents);
    setMetrics(dash.metrics);
    setIssuerDid((v) => v || ids.institutions[0]?.did || "");
    setStudentDid((v) => v || ids.students[0]?.did || "");
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : label + " failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="intro">
        <h1>Institution Dashboard</h1>
        <p>Register issuer and student DIDs, then issue credentials that are signed, stored on IPFS, and anchored on-chain.</p>
      </section>

      {message && <div className="notice">{message}</div>}

      <div className="btn-row">
        <button className="gold" disabled={busy} onClick={() => run("Seed", async () => { await api("/api/demo/reset", {}); await refresh(); setMessage("Presentation records loaded."); })}>
          Load Presentation Records
        </button>
      </div>

      <section className="grid cols-4" style={{ marginTop: "1.1rem" }}>
        <div className="metric"><b>{metrics.issued}</b><span>Issued</span></div>
        <div className="metric"><b>{metrics.active}</b><span>Active</span></div>
        <div className="metric"><b>{metrics.revoked}</b><span>Revoked</span></div>
        <div className="metric"><b>{metrics.verificationChecks}</b><span>Verifier checks</span></div>
      </section>

      <section className="grid cols-2" style={{ marginTop: "1.1rem" }}>
        <div className="card">
          <h2>Issuer Identity</h2>
          <label>Institution name</label>
          <input value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
          <div className="btn-row">
            <button disabled={busy} onClick={() => run("Create institution", async () => { const id = await api("/api/identities/institution", { name: issuerName }); await refresh(); setIssuerDid(id.did); setMessage("Institution DID registered on-chain: " + id.did); })}>
              Register Institution DID
            </button>
          </div>
          <label>Active issuer</label>
          <select value={issuerDid} onChange={(e) => setIssuerDid(e.target.value)}>
            {institutions.map((i) => (<option key={i.did} value={i.did}>{i.name}</option>))}
          </select>
          <p className="mono muted">{issuerDid}</p>
        </div>

        <div className="card">
          <h2>Student Holder</h2>
          <label>Student name</label>
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          <div className="btn-row">
            <button disabled={busy} onClick={() => run("Create student", async () => { const id = await api("/api/identities/student", { name: studentName }); await refresh(); setStudentDid(id.did); setMessage("Student DID created: " + id.did); })}>
              Create Student DID
            </button>
          </div>
          <label>Recipient</label>
          <select value={studentDid} onChange={(e) => setStudentDid(e.target.value)}>
            {students.map((s) => (<option key={s.did} value={s.did}>{s.name}</option>))}
          </select>
          <p className="mono muted">{studentDid}</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1.1rem" }}>
        <h2>Issue Credential</h2>
        <div className="grid cols-3">
          <div><label>Student ID</label><input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /></div>
          <div><label>Degree</label><input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} /></div>
          <div><label>Major</label><input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} /></div>
          <div><label>Graduation date</label><input type="date" value={form.graduationDate} onChange={(e) => setForm({ ...form, graduationDate: e.target.value })} /></div>
          <div><label>GPA</label><input value={form.gpa} onChange={(e) => setForm({ ...form, gpa: e.target.value })} /></div>
        </div>
        <div className="btn-row">
          <button
            disabled={busy || !issuerDid || !studentDid}
            onClick={() =>
              run("Issue", async () => {
                const student = students.find((s) => s.did === studentDid);
                const row = await api("/api/credentials/issue", {
                  issuerDid,
                  subjectDid: studentDid,
                  subject: { ...form, name: student?.name ?? "Student", gpa: Number(form.gpa) },
                });
                await refresh();
                const tx = row.chain?.txHash ? ` · tx ${row.chain.txHash.slice(0, 12)}…` : "";
                setMessage(`Credential issued and anchored (${row.chain?.mode})${tx}.`);
              })
            }
          >
            Sign &amp; Anchor Credential
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1.1rem" }}>
        <h2>Issued Credentials</h2>
        {rows.length === 0 ? (
          <p className="muted">No credentials issued yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Holder</th><th>Degree</th><th>On-chain</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.credential.credentialSubject.name}</td>
                  <td>{row.credential.credentialSubject.degree}</td>
                  <td className="mono">{row.chain?.blockNumber !== undefined ? `#${row.chain.blockNumber}` : row.chain?.mode ?? "—"}</td>
                  <td><StatusBadge status={row.revoked ? "revoked" : "valid"} /></td>
                  <td>
                    {!row.revoked && (
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => run("Revoke", async () => { await api("/api/credentials/revoke", { id: row.id, reason: "Revoked by institution" }); await refresh(); setMessage("Credential revoked on-chain."); })}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" style={{ marginTop: "1.1rem" }}>
        <h2>Audit Trail</h2>
        {events.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <div className="when">{new Date(event.createdAt).toLocaleString()} · {event.type}</div>
                {event.note}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 3: Delete the old issue page**

```bash
git rm apps/web/app/issue/page.tsx apps/web/app/issue/IssuePage.tsx
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: `Compiled successfully`; route list includes `/issuer`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/issuer
git commit -m "Rebuild issuer dashboard"
```

---

## Task 14: Holder page

**Files:**
- Create: `apps/web/app/holder/HolderPage.tsx` (overwrite existing)
- Modify: `apps/web/app/holder/page.tsx`

- [ ] **Step 1: Overwrite `apps/web/app/holder/HolderPage.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import DiplomaCard from "../components/DiplomaCard";
import CopyButton from "../components/CopyButton";

type CredentialRow = {
  id: string;
  jwt: string;
  cid: string;
  hash: string;
  revoked?: boolean;
  credential: { issuer: string; credentialSubject: { name: string; degree: string; major: string; graduationDate: string; gpa?: number } };
  chain?: { mode: string; blockNumber?: number };
  storageMode?: string;
};

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function HolderPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    setSelectedId((v) => v || data[0]?.id || "");
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  const row = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);

  async function makeShare() {
    if (!row) return;
    const share = await api("/api/share-links", { credentialId: row.id });
    const url = `${location.origin}${share.url}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url);
    setMessage("Verifier link copied to clipboard.");
  }

  return (
    <>
      <section className="intro">
        <h1>Credential Wallet</h1>
        <p>Your credentials live here as portable, self-sovereign diplomas. Share a verifier link — no university lookup required.</p>
      </section>

      {message && <div className="notice">{message}</div>}

      <div className="btn-row">
        <button className="gold" onClick={() => api("/api/demo/reset", {}).then(refresh).then(() => setMessage("Presentation records loaded."))}>
          Load Presentation Records
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ marginTop: "1.1rem" }}>
          <p className="muted">No credentials yet. Issue one from the Issuer dashboard or load presentation records.</p>
        </div>
      ) : (
        <section className="grid cols-2" style={{ marginTop: "1.1rem", alignItems: "start" }}>
          <div className="stack">
            <div className="card">
              <label>Select credential</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.credential.credentialSubject.name} — {r.credential.credentialSubject.degree} {r.revoked ? "(revoked)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {row && (
              <DiplomaCard
                credential={row.credential}
                hash={row.hash}
                status={row.revoked ? "revoked" : "valid"}
                blockNumber={row.chain?.blockNumber}
              />
            )}
          </div>

          {row && (
            <div className="card stack">
              <h2>Portable Proof</h2>
              <div>
                <label>IPFS CID ({row.storageMode ?? "local"})</label>
                <p className="mono">{row.cid}</p>
              </div>
              <div>
                <label>Credential hash</label>
                <p className="mono">{row.hash}</p>
              </div>
              <div>
                <label>Signed credential (JWT)</label>
                <p className="mono">{row.jwt.slice(0, 96)}…</p>
              </div>
              <div className="btn-row">
                <CopyButton value={row.jwt} label="Copy JWT" />
                <CopyButton value={row.cid} label="Copy CID" />
                <button onClick={makeShare}>Create Verifier Link</button>
              </div>
              {shareUrl && (
                <div>
                  <label>Shareable verification link</label>
                  <p className="mono">{shareUrl}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Confirm `apps/web/app/holder/page.tsx`**

It should read exactly:

```tsx
import HolderPage from "./HolderPage";

export default function Page() {
  return <HolderPage />;
}
```

If it differs, overwrite it with the above.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/holder
git commit -m "Rebuild holder credential wallet"
```

---

## Task 15: Verifier page

**Files:**
- Create: `apps/web/app/verify/VerifyPage.tsx` (overwrite existing)
- Modify: `apps/web/app/verify/page.tsx`, `apps/web/app/verify/[shareId]/page.tsx`

- [ ] **Step 1: Overwrite `apps/web/app/verify/VerifyPage.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import ScoreBar from "../components/ScoreBar";

type VerifyResult = {
  status: string;
  valid: boolean;
  score: number;
  reasons: string[];
  breakdown?: Record<string, number>;
  credential?: { credentialSubject: { name: string; degree: string; major: string } };
};
type AuditEvent = { id: string; type: string; note: string; createdAt: string };
type CredentialRow = { id: string; credential: { credentialSubject: { name: string } } };

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function VerifyPage({ shareId }: { shareId?: string }) {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [payload, setPayload] = useState(shareId ? JSON.stringify({ shareId }, null, 2) : "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data: CredentialRow[] = await api("/api/credentials");
    setRows(data);
    if (!payload && !shareId && data[0]) setPayload(JSON.stringify({ id: data[0].id }, null, 2));
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    if (shareId) verify({ shareId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  async function verify(body: unknown) {
    setBusy(true);
    try {
      const res: VerifyResult = await api("/api/credentials/verify", body);
      setResult(res);
      const id = (body as { id?: string }).id;
      if (id) setEvents((await api(`/api/credentials/${id}/audit`)).events);
      else setEvents([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTampered() {
    const first = rows[0];
    if (!first) return;
    const full = await api("/api/credentials");
    const target = full.find((r: { id: string }) => r.id === first.id);
    const tampered = { ...target.credential, credentialSubject: { ...target.credential.credentialSubject, degree: "Doctor of Philosophy" } };
    await verify({ id: first.id, credential: tampered });
    setMessage("Submitted an altered copy — the verifier should flag it as tampered.");
  }

  return (
    <>
      <section className="intro">
        <h1>Verifier Portal</h1>
        <p>Paste a credential reference or open a holder share link. CredVerify checks the signature, the issuer&apos;s authorization, the content hash, and the on-chain anchor.</p>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2>Credential Input</h2>
          <p className="muted">Accepts {"{ \"id\": … }"}, {"{ \"cid\": … }"}, {"{ \"jwt\": … }"}, or {"{ \"shareId\": … }"}.</p>
          <textarea value={payload} onChange={(e) => setPayload(e.target.value)} placeholder='{"id":"urn:uuid:…"}' />
          <div className="btn-row">
            <button disabled={busy} onClick={() => { try { verify(JSON.parse(payload || "{}")); } catch { setMessage("Input is not valid JSON."); } }}>
              Verify Credential
            </button>
            <button className="ghost" disabled={busy || rows.length === 0} onClick={verifyTampered}>
              Demo: Verify Tampered Copy
            </button>
            <button className="ghost" onClick={() => api("/api/demo/reset", {}).then(refresh).then(() => setMessage("Presentation records loaded."))}>
              Load Records
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Trust Result</h2>
          {!result ? (
            <p className="muted">No verification run yet.</p>
          ) : (
            <>
              <div>
                <StatusBadge status={result.status} />
              </div>
              <ScoreBar score={result.score} breakdown={result.breakdown} />
              <div>
                <h3>Explainable checklist</h3>
                {result.reasons.length === 0 ? (
                  <p className="muted">All six checks passed.</p>
                ) : (
                  <ul>
                    {result.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
              {result.credential && (
                <p className="muted">
                  {result.credential.credentialSubject.name} — {result.credential.credentialSubject.degree},{" "}
                  {result.credential.credentialSubject.major}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {events.length > 0 && (
        <section className="card" style={{ marginTop: "1.1rem" }}>
          <h2>Audit Timeline</h2>
          <ul className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <div className="when">{new Date(event.createdAt).toLocaleString()} · {event.type}</div>
                {event.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Confirm `apps/web/app/verify/page.tsx`**

It should read exactly:

```tsx
import VerifyPage from "./VerifyPage";

export default function Page() {
  return <VerifyPage />;
}
```

If it differs, overwrite it with the above.

- [ ] **Step 3: Confirm `apps/web/app/verify/[shareId]/page.tsx`**

It should read exactly:

```tsx
import VerifyPage from "../VerifyPage";

export default async function Page({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <VerifyPage shareId={shareId} />;
}
```

If it differs, overwrite it with the above.

- [ ] **Step 4: Verify typecheck and build**

Run: `pnpm typecheck`
Expected: PASS — no errors anywhere.

Run: `pnpm build`
Expected: `Compiled successfully`; routes include `/`, `/issuer`, `/holder`, `/verify`, `/verify/[shareId]`, and all `/api/*`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/verify
git commit -m "Rebuild verifier portal"
```

---

## Task 16: README, full verification gate, and walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Overwrite `README.md`**

```markdown
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
```

- [ ] **Step 2: Run the full verification gate**

Run each and confirm:

- `pnpm test` → Expected: PASS — all credential + adapter unit tests.
- `pnpm test:contracts` → Expected: PASS — `1 passing`.
- `pnpm test:e2e` → Expected: PASS — 3 integration tests.
- `pnpm typecheck` → Expected: PASS — no errors.
- `pnpm build` → Expected: `Compiled successfully`.

If any fails, fix it before continuing — do not commit a red gate.

- [ ] **Step 3: Manual on-chain walkthrough (real Hardhat path)**

In separate terminals:

```bash
pnpm chain
pnpm deploy
pnpm dev
```

Then in a browser at `http://localhost:3000`:
1. Issuer → Load Presentation Records. Confirm the chain-status pill shows `local #<n>`.
2. Issue a credential. Confirm the success message shows a real `tx …` hash and the
   table shows an `#<block>` number.
3. Holder → confirm the diploma card renders with the anchored block number.
4. Holder → Create Verifier Link, open it.
5. Verifier → confirm status `Verified`, score `100/100`.
6. Verifier → Demo: Verify Tampered Copy → confirm status `Tampered`.
7. Issuer → Revoke the credential; re-verify → confirm status `Revoked`.

Document any deviations as follow-up issues.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Update README for the integrated build"
```

---

## Self-Review Notes

- **Spec coverage:** adapter pattern with local/sepolia/memory (Tasks 3,5,8); real IPFS + fallback (Tasks 4,6,8); repository refactor (Task 7); service orchestration (Task 9); re-backed API + `chain/status` (Task 10); academic-institutional UI (Tasks 11-15); deploy script (Task 1); test plan + final gate (Tasks 3,4,9,16). ZKP and Postgres are explicitly out of scope per the spec.
- **Type consistency:** `RegistryAdapter` / `CredentialStorageAdapter` defined once in `adapters/types.ts` (Task 2) and implemented unchanged in Tasks 3-6; `ChainReceipt` shape flows into `StoredCredential.chain` (Task 7) and is read by the issuer UI (Task 13); `createCredentialService` deps and method names are fixed in Task 9 and consumed verbatim in Task 10.
```
