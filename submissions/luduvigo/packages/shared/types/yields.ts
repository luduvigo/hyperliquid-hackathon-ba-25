/**
 * Yield-related types shared across frontend and backend
 */

export interface YieldPool {
  vault_address: string;
  vault_name: string;
  apy: number;
  tvl: number;
  chain: string;
  protocol?: string;
}

export interface HistoricalYield {
  timestamp: string;
  apy: number;
}

export interface YieldResponse {
  pools: YieldPool[];
  timestamp: string;
}

export interface HistoricalYieldResponse {
  vault_address: string;
  data: HistoricalYield[];
}
