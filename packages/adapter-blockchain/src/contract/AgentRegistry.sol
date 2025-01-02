// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AgentRegistry {
    // Mappings for blobIdx, keyStore, and character.
    mapping(string => string) private blobIdxMapping;
    mapping(string => string) private keyStoreMapping;
    mapping(string => string) private characterMapping;

    // Mapping to store the owner of each agentID
    mapping(string => address) private keyOwners;

    // Events for logging updates and ownership changes
    event BlobIdxUpdated(string indexed agentID, string blobIdx);
    event KeyStoreUpdated(string indexed agentID, string keyStore);
    event CharacterUpdated(string indexed agentID, string character);
    event AgentDeleted(string indexed agentID);
    event OwnershipTransferred(string indexed agentID, address indexed previousOwner, address indexed newOwner);

    // Modifier to ensure the caller is the owner of the agentID
    modifier onlyAgentOwner(string memory agentID) {
        require(keyOwners[agentID] == msg.sender, "Not the owner of this agentID");
        _;
    }

    // Update or register ownership of the agentID (if not already assigned)
    function updateOrRegisterOwnership(string memory agentID) internal {
        if (keyOwners[agentID] == address(0)) {
            keyOwners[agentID] = msg.sender;
        } else {
            require(keyOwners[agentID] == msg.sender, "Not the owner of this agentID");
        }
    }

    // Update or register blobIdx for a given agent
    function updateOrRegisterBlobIdx(string memory agentID, string memory newBlobIdx) external {
        updateOrRegisterOwnership(agentID); // Ensure ownership
        blobIdxMapping[agentID] = newBlobIdx;
        emit BlobIdxUpdated(agentID, newBlobIdx);
    }

    // Update or register keyStore for a given agent
    function updateOrRegisterKeyStore(string memory agentID, string memory newKeyStore) external {
        updateOrRegisterOwnership(agentID); // Ensure ownership
        keyStoreMapping[agentID] = newKeyStore;
        emit KeyStoreUpdated(agentID, newKeyStore);
    }

    // Update or register character for a given agent
    function updateOrRegisterCharacter(string memory agentID, string memory newCharacter) external {
        updateOrRegisterOwnership(agentID); // Ensure ownership
        characterMapping[agentID] = newCharacter;
        emit CharacterUpdated(agentID, newCharacter);
    }

    // Delete an agent with a given agent
    function deleteAgent(string memory agentID) external onlyAgentOwner(agentID) {
        delete blobIdxMapping[agentID];
        delete keyStoreMapping[agentID];
        delete characterMapping[agentID];
        delete keyOwners[agentID];
        emit AgentDeleted(agentID);
    }

    // Transfer ownership of an agentID to a new owner
    function transferOwnership(string memory agentID, address newOwner) external onlyAgentOwner(agentID) {
        require(newOwner != address(0), "New owner cannot be the zero address");
        address previousOwner = keyOwners[agentID];
        keyOwners[agentID] = newOwner;
        emit OwnershipTransferred(agentID, previousOwner, newOwner);
    }

    // Retrieve blobIdx for a given agentID
    function getBlobIdx(string memory agentID) external view returns (string memory) {
        return blobIdxMapping[agentID];
    }

    // Retrieve keyStore for a given agentID
    function getKeyStore(string memory agentID) external view returns (string memory) {
        return keyStoreMapping[agentID];
    }

    // Retrieve character for a given agentID
    function getCharacter(string memory agentID) external view returns (string memory) {
        return characterMapping[agentID];
    }

    // Check if an agentID exists
    function agentExists(string memory agentID) external view returns (bool) {
        return keyOwners[agentID] != address(0);
    }

    // Retrieve the owner of a given agentID
    function getAgentOwner(string memory agentID) external view returns (address) {
        return keyOwners[agentID];
    }
}
