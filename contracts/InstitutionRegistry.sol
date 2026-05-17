// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract InstitutionRegistry {
    struct InstitutionRecord { string did; string name; bool active; uint256 registeredAt; }
    address public owner;
    mapping(bytes32 => InstitutionRecord) private institutions;

    event InstitutionRegistered(bytes32 indexed didHash, string did, string name);
    event InstitutionStatusChanged(bytes32 indexed didHash, bool active);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    constructor() { owner = msg.sender; }

    function registerInstitution(string calldata did, string calldata name) external onlyOwner {
        bytes32 didHash = keccak256(bytes(did));
        require(bytes(institutions[didHash].did).length == 0, "exists");
        institutions[didHash] = InstitutionRecord(did, name, true, block.timestamp);
        emit InstitutionRegistered(didHash, did, name);
    }

    function setActive(string calldata did, bool active) external onlyOwner {
        bytes32 didHash = keccak256(bytes(did));
        require(bytes(institutions[didHash].did).length != 0, "missing");
        institutions[didHash].active = active;
        emit InstitutionStatusChanged(didHash, active);
    }

    function isAuthorized(string calldata did) external view returns (bool) {
        return institutions[keccak256(bytes(did))].active;
    }

    function resolve(string calldata did) external view returns (InstitutionRecord memory) {
        return institutions[keccak256(bytes(did))];
    }
}
