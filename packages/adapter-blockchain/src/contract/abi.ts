export const RegistryABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "AgentDeleted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "blobIdx",
				"type": "string"
			}
		],
		"name": "BlobIdxUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "character",
				"type": "string"
			}
		],
		"name": "CharacterUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "deleteAgent",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "keyStore",
				"type": "string"
			}
		],
		"name": "KeyStoreUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "newBlobIdx",
				"type": "string"
			}
		],
		"name": "updateOrRegisterBlobIdx",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "newCharacter",
				"type": "string"
			}
		],
		"name": "updateOrRegisterCharacter",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "newKeyStore",
				"type": "string"
			}
		],
		"name": "updateOrRegisterKeyStore",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "updateOrRegisterOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "agentExists",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "getAgentOwner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "getBlobIdx",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "getCharacter",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "agentID",
				"type": "string"
			}
		],
		"name": "getKeyStore",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];