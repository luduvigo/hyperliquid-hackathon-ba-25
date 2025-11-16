/**
 * Vault-related types
 */

export interface VaultInfo {
  address: string;
  name: string;
  asset: string;
  totalAssets: string;
  totalShares: string;
  apy: number;
  tvl: number;
}

export interface UserPosition {
  vault_address: string;
  shares: string;
  assets: string;
  entry_timestamp: number;
  entry_apy: number;
}

export interface AllocationStrategy {
  vault_address: string;
  vault_name: string;
  amount: string;
  percentage: number;
  expected_apy: number;
}

export interface OptimalAllocation {
  allocations: AllocationStrategy[];
  total_amount: string;
  weighted_apy: number;
}

export interface RebalanceRequest {
  vault_address: string;
  amount: string;
  from_vault?: string;
  to_vault?: string;
}

export interface RebalanceResponse {
  success: boolean;
  transaction_hash?: string;
  allocation: OptimalAllocation;
  error?: string;
}
