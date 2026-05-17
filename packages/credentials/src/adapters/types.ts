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
