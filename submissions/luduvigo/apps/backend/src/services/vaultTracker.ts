import { ethers } from "ethers";
import { VaultHistory } from "../models/VaultHistory";
import { getLatestApy } from "./apyTracker";
import { getDatabaseStatus } from "./database";

// Configuration from environment
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
const ASSET_TOKEN = process.env.ASSET_TOKEN || "";
const RPC_URL = process.env.HYPEREVM_RPC_URL || "https://rpc.hypurrscan.io";

// Vault ABI
const VAULT_ABI = [
  "function totalAssets() external view returns (uint256)",
  "function vaultAllocations(address) external view returns (uint256)",
  "function OWNER() external view returns (address)",
  "function ASSET() external view returns (address)",
];

// ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

// Token decimals (USD₮0 has 6 decimals)
const TOKEN_DECIMALS = 6;

/**
 * Track vault TVL and token distribution
 */
export async function trackVaultTvl(): Promise<void> {
  if (!getDatabaseStatus()) {
    console.error("Skipping vault TVL tracking - database not connected");
    return;
  }

  if (!VAULT_ADDRESS || !ASSET_TOKEN) {
    console.error("Skipping vault TVL tracking - missing configuration");
    return;
  }

  try {
    console.log(`Tracking vault TVL for ${VAULT_ADDRESS}...`);

    // Setup provider and contracts
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const assetToken = new ethers.Contract(ASSET_TOKEN, ERC20_ABI, provider);

    // Get vault state
    const [idleBalanceBN, totalAssetsBN] = await Promise.all([
      assetToken.balanceOf(VAULT_ADDRESS),
      vault.totalAssets(),
    ]);

    // Convert to actual token amounts
    const idleBalance = parseFloat(
      ethers.utils.formatUnits(idleBalanceBN, TOKEN_DECIMALS)
    );
    const totalAssets = parseFloat(
      ethers.utils.formatUnits(totalAssetsBN, TOKEN_DECIMALS)
    );
    
    // TVL = totalAssets (which represents all vault assets)
    // We also track idle balance separately for distribution display

    // Get all tracked pools
    const latestApy = await getLatestApy();
    const tokenPools = latestApy.filter(
      (pool: any) =>
        pool.input_token?.toLowerCase() === ASSET_TOKEN.toLowerCase()
    );

    console.log(`Found ${tokenPools.length} tracked pools for token ${ASSET_TOKEN}`);

    // Get allocations for each pool
    const allocationPromises = tokenPools.map(async (pool: any) => {
      try {
        // Normalize pool address to lowercase for consistency
        const poolAddress = pool.pool_address.toLowerCase();
        
        const allocationBN = await vault.vaultAllocations(poolAddress);
        const amount = parseFloat(
          ethers.utils.formatUnits(allocationBN, TOKEN_DECIMALS)
        );

        if (amount > 0) {
          console.log(
            `  Pool ${pool.description || poolAddress}: $${amount.toFixed(2)}`
          );
        }

        return {
          pool_address: poolAddress,
          pool_description: pool.description || "Unknown Pool",
          amount: amount,
          percentage: 0, // Will calculate after we have total
        };
      } catch (err: any) {
        console.error(
          `  Error getting allocation for pool ${pool.pool_address}:`,
          err.message
        );
        return null;
      }
    });

    const allAllocations = await Promise.all(allocationPromises);
    const allocations = allAllocations
      .filter((alloc) => alloc !== null && alloc.amount > 0)
      .map((alloc) => alloc!);
    
    console.log(`Found ${allocations.length} pools with allocations`);

    // Calculate total allocated
    const totalAllocated = allocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // TVL = idle balance + total allocated (sum of all allocations)
    const totalTvl = idleBalance + totalAllocated;
    
    // Verify against totalAssets from the contract (for debugging)
    if (Math.abs(totalTvl - totalAssets) > 0.01) {
      console.warn(
        `TVL mismatch: totalAssets=${totalAssets.toFixed(2)}, calculated=${totalTvl.toFixed(2)} (idle=${idleBalance.toFixed(2)} + allocated=${totalAllocated.toFixed(2)})`
      );
    }

    // Use the calculated sum for percentage calculation
    // This ensures percentages always add up to 100%
    const baseForPercentages = totalTvl;

    // Calculate percentages for each allocation (based on actual sum)
    // First calculate for pool allocations
    const allocationsWithPercentage = allocations.map((alloc) => ({
      ...alloc,
      percentage: baseForPercentages > 0 ? (alloc.amount / baseForPercentages) * 100 : 0,
    }));
    
    // Also add idle balance as an "allocation" for distribution display
    // This way the distribution always adds up to 100%
    const idlePercentage = baseForPercentages > 0 ? (idleBalance / baseForPercentages) * 100 : 0;
    if (idleBalance > 0 || idlePercentage > 0) {
      allocationsWithPercentage.push({
        pool_address: VAULT_ADDRESS.toLowerCase(),
        pool_description: "Idle Funds (Vault)",
        amount: idleBalance,
        percentage: idlePercentage,
      });
    }
    
    // Verify percentages add up to ~100% (with small tolerance for rounding)
    const totalPercentage = allocationsWithPercentage.reduce(
      (sum, alloc) => sum + alloc.percentage,
      0
    );
    if (Math.abs(totalPercentage - 100) > 0.1) {
      console.warn(
        `Percentage sum is ${totalPercentage.toFixed(2)}%, expected ~100% (sum=${baseForPercentages.toFixed(2)}, idle=${idleBalance.toFixed(2)}, allocated=${totalAllocated.toFixed(2)})`
      );
    }

    // Get best pool info
    let bestPool = null;
    if (tokenPools.length > 0) {
      // Sort by opportunity_score or APY
      const sortedPools = [...tokenPools].sort((a: any, b: any) => {
        const aScore = a.opportunity_score ?? a.total_apy ?? 0;
        const bScore = b.opportunity_score ?? b.total_apy ?? 0;
        return bScore - aScore;
      });

      const best = sortedPools[0];
      bestPool = {
        pool_address: best.pool_address,
        description: best.description || "Unknown Pool",
        apy: best.total_apy || 0,
        opportunity_score: best.opportunity_score || null,
      };
    }

    // Get current APY (from best pool or from current allocation)
    let currentApy: number | null = null;
    if (bestPool) {
      currentApy = bestPool.apy;
    }

    // Save to database
    const vaultRecord = new VaultHistory({
      vault_address: VAULT_ADDRESS.toLowerCase(),
      total_tvl: totalTvl,
      idle_balance: idleBalance,
      total_allocated: totalAllocated,
      allocations: allocationsWithPercentage,
      current_apy: currentApy,
      best_pool: bestPool,
      timestamp: new Date(),
    });

    await vaultRecord.save();

    console.log(
      `Vault TVL tracked: $${totalTvl.toFixed(2)} (Idle: $${idleBalance.toFixed(
        2
      )}, Allocated: $${totalAllocated.toFixed(2)}, Pools: ${allocations.length})`
    );
  } catch (error: any) {
    console.error("Error tracking vault TVL:", error.message);
    // Don't throw - allow cron job to continue
  }
}

/**
 * Get vault TVL history
 */
export async function getVaultTvlHistory(
  vaultAddress: string,
  hours: number = 168
): Promise<any[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await VaultHistory.find({
      vault_address: vaultAddress.toLowerCase(),
      timestamp: { $gte: since },
    })
      .sort({ timestamp: 1 })
      .lean();

    return history;
  } catch (error) {
    console.error("Error fetching vault TVL history:", error);
    throw error;
  }
}

/**
 * Get latest vault TVL
 */
export async function getLatestVaultTvl(vaultAddress: string): Promise<any | null> {
  try {
    const latest = await VaultHistory.findOne({
      vault_address: vaultAddress.toLowerCase(),
    })
      .sort({ timestamp: -1 })
      .lean();

    return latest;
  } catch (error) {
    console.error("Error fetching latest vault TVL:", error);
    throw error;
  }
}

