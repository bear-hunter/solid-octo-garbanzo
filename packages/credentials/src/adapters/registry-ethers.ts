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
    // NonceManager tracks the nonce locally so transactions sent back-to-back
    // (e.g. registerInstitution then registerCredential during issuance) each
    // get a sequential nonce instead of racing on the node's pending count.
    const signer = new ethers.NonceManager(new ethers.Wallet(config.privateKey, this.provider));
    this.institutions = new ethers.Contract(config.institutionRegistry, INSTITUTION_ABI, signer);
    this.credentials = new ethers.Contract(config.credentialRegistry, CREDENTIAL_ABI, signer);
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
