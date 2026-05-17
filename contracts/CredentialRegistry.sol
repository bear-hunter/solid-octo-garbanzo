// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IInstitutionRegistry { function isAuthorized(string calldata did) external view returns (bool); }

contract CredentialRegistry {
    struct CredentialRecord { bytes32 credentialHash; string cid; string issuerDid; bytes32 subjectDidHash; uint256 issuedAt; bool revoked; string revocationReason; }
    IInstitutionRegistry public institutions;
    mapping(bytes32 => CredentialRecord) private credentials;

    event CredentialIssued(bytes32 indexed credentialHash, string cid, string issuerDid, bytes32 indexed subjectDidHash);
    event CredentialRevoked(bytes32 indexed credentialHash, string reason);

    constructor(address institutionRegistry) { institutions = IInstitutionRegistry(institutionRegistry); }

    function registerCredential(bytes32 credentialHash, string calldata cid, string calldata issuerDid, bytes32 subjectDidHash) external {
        require(institutions.isAuthorized(issuerDid), "issuer not authorized");
        require(credentials[credentialHash].issuedAt == 0, "duplicate");
        credentials[credentialHash] = CredentialRecord(credentialHash, cid, issuerDid, subjectDidHash, block.timestamp, false, "");
        emit CredentialIssued(credentialHash, cid, issuerDid, subjectDidHash);
    }

    function revokeCredential(bytes32 credentialHash, string calldata reason) external {
        require(credentials[credentialHash].issuedAt != 0, "missing");
        require(!credentials[credentialHash].revoked, "already revoked");
        credentials[credentialHash].revoked = true;
        credentials[credentialHash].revocationReason = reason;
        emit CredentialRevoked(credentialHash, reason);
    }

    function getCredential(bytes32 credentialHash) external view returns (CredentialRecord memory) {
        return credentials[credentialHash];
    }
}
