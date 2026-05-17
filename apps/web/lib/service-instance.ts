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
