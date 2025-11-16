export interface Vault {
  address: string;
  name: string;
  apy: number;
  tvl: number;
  chain: string;
}

export interface Transaction {
  hash: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
}

export interface UserPosition {
  vaultAddress: string;
  amount: string;
  shares: string;
  entryApy: number;
}
