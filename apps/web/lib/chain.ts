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
