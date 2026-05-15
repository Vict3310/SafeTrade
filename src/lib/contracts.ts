export const SAFETRADE_CONTRACT_ADDRESS = '0xC181C490908341aFCE80Ee337b2347E4A73EB064'

export const SAFETRADE_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_vendor", "type": "address" },
      { "internalType": "bytes32", "name": "_itemHash", "type": "bytes32" }
    ],
    "name": "createDeal",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dealId", "type": "uint256" }],
    "name": "releaseFunds",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dealId", "type": "uint256" }],
    "name": "raiseDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_dealId", "type": "uint256" },
      { "internalType": "address", "name": "_winner", "type": "address" }
    ],
    "name": "resolveDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dealId", "type": "uint256" }],
    "name": "getDeal",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "buyer", "type": "address" },
          { "internalType": "address", "name": "vendor", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "bytes32", "name": "itemHash", "type": "bytes32" },
          { "internalType": "enum SafeTradeEscrow.DealStatus", "name": "status", "type": "uint8" },
          { "internalType": "bool", "name": "buyerConfirmed", "type": "bool" },
          { "internalType": "bool", "name": "vendorConfirmed", "type": "bool" }
        ],
        "internalType": "struct SafeTradeEscrow.Deal",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "dealCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "accumulatedFees",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
