import axios from "axios";
import { YieldResponse, YieldPool } from "./gluexYields";

const GLUEX_API_BASE = "https://api.gluex.xyz";

export interface AllocationStrategy {
  vaultAddress: string;
  vaultName: string;
  amount: string;
  percentage: number;
  expectedApy: number;
}

export interface OptimalAllocation {
  allocations: AllocationStrategy[];
  totalAmount: string;
  weightedApy: number;
}

/**
 * Calculate optimal allocation across multiple vaults
 * Simple strategy: allocate to top 3 highest APY vaults
 */
export async function calculateOptimalAllocation(
  totalAmount: string,
  yieldData: YieldResponse
): Promise<OptimalAllocation> {
  // Filter out pools without APY and sort by APY (highest first)
  const validPools = yieldData.pools.filter((pool) => pool.apy !== undefined);
  const sortedPools = [...validPools].sort(
    (a, b) => (b.apy ?? 0) - (a.apy ?? 0)
  );

  // Take top 3 vaults
  const topVaults = sortedPools.slice(0, 3);

  if (topVaults.length === 0) {
    throw new Error("No vaults available for allocation");
  }

  // Simple allocation: distribute evenly across top vaults
  const allocation = 1 / topVaults.length;
  const amount = parseFloat(totalAmount);

  const allocations: AllocationStrategy[] = topVaults.map((vault: any) => ({
    vaultAddress: vault.vaultAddress, // Changed from vault_address
    vaultName: vault.vaultName, // Changed from vault_name
    amount: (amount * allocation).toFixed(6),
    percentage: allocation * 100,
    expectedApy: vault.apy ?? 0, // Provide default value if undefined
  }));

  // Calculate weighted APY
  const weightedApy = allocations.reduce(
    (sum, alloc) => sum + (alloc.expectedApy * alloc.percentage) / 100,
    0
  );

  return {
    allocations,
    totalAmount,
    weightedApy,
  };
}

/**
 * Get swap route from GlueX Router API
 */
export async function getSwapRoute(
  fromToken: string,
  toToken: string,
  amount: string,
  slippage: number = 0.5
): Promise<any> {
  try {
    const response = await axios.get(`${GLUEX_API_BASE}/router/route`, {
      params: {
        from_token: fromToken,
        to_token: toToken,
        amount: amount,
        slippage: slippage,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching swap route:", error);
    throw new Error("Failed to get swap route from GlueX Router");
  }
}
