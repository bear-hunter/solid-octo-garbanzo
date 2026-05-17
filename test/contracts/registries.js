const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("registries", () => {
  it("authorizes issuers, registers credentials, and revokes", async () => {
    const Institutions = await ethers.getContractFactory("InstitutionRegistry");
    const institutions = await Institutions.deploy();
    await institutions.registerInstitution("did:example:issuer", "University");
    expect(await institutions.isAuthorized("did:example:issuer")).to.equal(true);

    const Credentials = await ethers.getContractFactory("CredentialRegistry");
    const credentials = await Credentials.deploy(await institutions.getAddress());
    const hash = ethers.keccak256(ethers.toUtf8Bytes("credential"));
    await expect(credentials.registerCredential(hash, "bafy...", "did:example:issuer", ethers.keccak256(ethers.toUtf8Bytes("student")))).to.emit(credentials, "CredentialIssued");
    await expect(credentials.revokeCredential(hash, "error")).to.emit(credentials, "CredentialRevoked");
    expect((await credentials.getCredential(hash)).revoked).to.equal(true);
  });
});
