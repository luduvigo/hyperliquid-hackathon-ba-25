// Contract addresses and configuration
export const VAULT_ADDRESS = "0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD";
export const ASSET_TOKEN = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";
export const VAULT_CHAIN = "hyperevm";
export const CHAIN_ID = 999; // HyperEVM chain ID

// Vault ABI - only the functions we need
export const VAULT_ABI = [
  "function deposit(uint256 assets) external returns (uint256 shares)",
  "function withdraw(uint256 shares) external returns (uint256 assets)",
  "function balanceOf(address user) external view returns (uint256)",
  "function userShares(address user) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function ASSET() external view returns (address)",
  "function OWNER() external view returns (address)",
  "function reallocate(address vault, uint256 amount) external",
  "function getWhitelistedVaultsCount() external view returns (uint256)",
  "function whitelistedVaults(uint256) external view returns (address)",
  "function vaultAllocations(address) external view returns (uint256)",
  // Events
  "event Deposit(address indexed user, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed user, uint256 shares, uint256 assets)",
  "event Rebalance(address indexed vault, uint256 amount)",
];

// ERC20 ABI - only the functions we need
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
];
