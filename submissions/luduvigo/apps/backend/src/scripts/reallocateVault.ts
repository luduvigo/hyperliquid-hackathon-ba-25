import { ethers } from "ethers";
import dotenv from "dotenv";
import { connectDatabase } from "../services/database";
import { getLatestApy } from "../services/apyTracker";

dotenv.config();

// Vault configuration
const VAULT_ADDRESS =
  process.env.VAULT_ADDRESS || "0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD";
const ASSET_TOKEN =
  process.env.ASSET_TOKEN || "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";
const RPC_URL = process.env.HYPEREVM_RPC_URL || "https://rpc.hypurrscan.io";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Minimum APY difference to trigger reallocation (in percentage points)
const MIN_APY_DIFFERENCE = parseFloat(process.env.MIN_APY_DIFFERENCE || "0.5");

// Minimum amount to keep in vault as liquidity buffer (in wei)
const LIQUIDITY_BUFFER = ethers.utils.parseUnits(
  process.env.LIQUIDITY_BUFFER || "100",
  18
);

// OptimizerVault ABI (minimal for reallocate function)
const VAULT_ABI = [
  "function reallocate(address vault, uint256 amount) external",
  "function withdrawFromVault(address vault, uint256 amount) external",
  "function totalAssets() external view returns (uint256)",
  "function vaultAllocations(address) external view returns (uint256)",
  "function whitelistEnabled() external view returns (bool)",
  "function OWNER() external view returns (address)",
  "function ASSET() external view returns (address)",
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

interface ReallocationPlan {
  currentPool?: string;
  currentApy: number;
  targetPool: string;
  targetApy: number;
  amountToReallocate: string;
  shouldReallocate: boolean;
  reason: string;
}

/**
 * Get the best pool from database
 */
async function getBestPool(): Promise<any> {
  const latestApy = await getLatestApy();

  if (latestApy.length === 0) {
    throw new Error("No APY data available");
  }

  // Filter pools for the correct asset token
  const relevantPools = latestApy.filter(
    (pool) => pool.input_token?.toLowerCase() === ASSET_TOKEN.toLowerCase()
  );

  if (relevantPools.length === 0) {
    throw new Error(`No pools found for asset ${ASSET_TOKEN}`);
  }

  // Return pool with highest APY
  return relevantPools[0]; // Already sorted by total_apy descending
}

/**
 * Get current allocation status
 */
async function getCurrentAllocation(
  vault: ethers.Contract
): Promise<{ pool: string; amount: ethers.BigNumber } | null> {
  // Get all tracked pools
  const latestApy = await getLatestApy();
  const poolAddresses = latestApy.map((p) => p.pool_address.toLowerCase());

  // Check allocations for each pool
  for (const poolAddress of poolAddresses) {
    const allocation = await vault.vaultAllocations(poolAddress);
    if (allocation.gt(0)) {
      return {
        pool: poolAddress,
        amount: allocation,
      };
    }
  }

  return null;
}

/**
 * Calculate reallocation plan
 */
async function calculateReallocationPlan(
  vault: ethers.Contract
): Promise<ReallocationPlan> {
  // Get best pool
  const bestPool = await getBestPool();
  console.log(`\n🎯 Best pool: ${bestPool.description}`);
  console.log(`   Address: ${bestPool.pool_address}`);
  console.log(`   APY: ${bestPool.total_apy.toFixed(2)}%`);

  // Get current allocation
  const currentAllocation = await getCurrentAllocation(vault);

  if (!currentAllocation) {
    // No current allocation - allocate idle funds
    const totalAssets = await vault.totalAssets();
    const amountToAllocate = totalAssets.sub(LIQUIDITY_BUFFER);

    if (amountToAllocate.lte(0)) {
      return {
        targetPool: bestPool.pool_address,
        targetApy: bestPool.total_apy,
        currentApy: 0,
        amountToReallocate: "0",
        shouldReallocate: false,
        reason: "No idle funds available (after liquidity buffer)",
      };
    }

    return {
      targetPool: bestPool.pool_address,
      targetApy: bestPool.total_apy,
      currentApy: 0,
      amountToReallocate: amountToAllocate.toString(),
      shouldReallocate: true,
      reason: "Initial allocation to best pool",
    };
  }

  // Already allocated - check if reallocation is beneficial
  console.log(`\nCurrent allocation: ${currentAllocation.pool}`);
  console.log(
    `   Amount: ${ethers.utils.formatUnits(currentAllocation.amount, 18)}`
  );

  // If already in best pool, no reallocation needed
  if (
    currentAllocation.pool.toLowerCase() === bestPool.pool_address.toLowerCase()
  ) {
    return {
      currentPool: currentAllocation.pool,
      currentApy: bestPool.total_apy,
      targetPool: bestPool.pool_address,
      targetApy: bestPool.total_apy,
      amountToReallocate: "0",
      shouldReallocate: false,
      reason: "Already allocated to best pool",
    };
  }

  // Find current pool's APY
  const latestApy = await getLatestApy();
  const currentPoolData = latestApy.find(
    (p) => p.pool_address.toLowerCase() === currentAllocation.pool.toLowerCase()
  );

  const currentApy = currentPoolData?.total_apy || 0;
  const apyDifference = bestPool.total_apy - currentApy;

  console.log(`   Current APY: ${currentApy.toFixed(2)}%`);
  console.log(`   Best APY: ${bestPool.total_apy.toFixed(2)}%`);
  console.log(`   Difference: ${apyDifference.toFixed(2)}%`);

  // Check if reallocation is worth it
  if (apyDifference < MIN_APY_DIFFERENCE) {
    return {
      currentPool: currentAllocation.pool,
      currentApy,
      targetPool: bestPool.pool_address,
      targetApy: bestPool.total_apy,
      amountToReallocate: "0",
      shouldReallocate: false,
      reason: `APY difference (${apyDifference.toFixed(
        2
      )}%) below threshold (${MIN_APY_DIFFERENCE}%)`,
    };
  }

  // Reallocate from current pool to best pool
  return {
    currentPool: currentAllocation.pool,
    currentApy,
    targetPool: bestPool.pool_address,
    targetApy: bestPool.total_apy,
    amountToReallocate: currentAllocation.amount.toString(),
    shouldReallocate: true,
    reason: `APY improvement: ${apyDifference.toFixed(2)}%`,
  };
}

/**
 * Execute reallocation
 */
async function executeReallocation(
  vault: ethers.Contract,
  plan: ReallocationPlan
): Promise<void> {
  if (!plan.shouldReallocate) {
    console.log(`\nNo reallocation needed: ${plan.reason}`);
    return;
  }

  console.log(`\nExecuting reallocation...`);
  console.log(`   Reason: ${plan.reason}`);
  console.log(`   Target pool: ${plan.targetPool}`);
  console.log(
    `   Amount: ${ethers.utils.formatUnits(plan.amountToReallocate, 18)}`
  );

  try {
    // Step 1: Withdraw from current pool if needed
    if (plan.currentPool) {
      console.log(`\nWithdrawing from current pool...`);
      const withdrawTx = await vault.withdrawFromVault(
        plan.currentPool,
        plan.amountToReallocate
      );
      console.log(`   Tx hash: ${withdrawTx.hash}`);
      await withdrawTx.wait();
      console.log(`   Withdrawal confirmed`);
    }

    // Step 2: Allocate to target pool
    console.log(`\nAllocating to target pool...`);
    const allocateTx = await vault.reallocate(
      plan.targetPool,
      plan.amountToReallocate
    );
    console.log(`   Tx hash: ${allocateTx.hash}`);
    await allocateTx.wait();
    console.log(`   Allocation confirmed`);

    console.log(`\nReallocation completed successfully!`);
    console.log(`   New APY: ${plan.targetApy.toFixed(2)}%`);
  } catch (error: any) {
    console.error(`\nReallocation failed:`, error.message);
    throw error;
  }
}

/**
 * Main reallocation function
 */
async function reallocateVault(dryRun: boolean = false): Promise<void> {
  console.log("\nStarting vault reallocation process...");
  console.log(`   Vault: ${VAULT_ADDRESS}`);
  console.log(`   Asset: ${ASSET_TOKEN}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  try {
    // Connect to database
    await connectDatabase();

    // Setup provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    if (!PRIVATE_KEY && !dryRun) {
      throw new Error("PRIVATE_KEY not set in environment variables");
    }

    const wallet = PRIVATE_KEY
      ? new ethers.Wallet(PRIVATE_KEY, provider)
      : null;

    // Connect to vault
    const vault = wallet
      ? new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet)
      : new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

    // Verify vault configuration
    const vaultOwner = await vault.OWNER();
    const vaultAsset = await vault.ASSET();
    const whitelistEnabled = await vault.whitelistEnabled();

    console.log(`\nVault Configuration:`);
    console.log(`   Owner: ${vaultOwner}`);
    console.log(`   Asset: ${vaultAsset}`);
    console.log(
      `   Whitelist Mode: ${whitelistEnabled ? "ENABLED" : "DISABLED"}`
    );

    if (wallet) {
      console.log(`   Wallet: ${wallet.address}`);

      if (vaultOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error(
          `Wallet ${wallet.address} is not the vault owner (${vaultOwner})`
        );
      }
    }

    // Calculate reallocation plan
    console.log(`\nCalculating reallocation plan...`);
    const plan = await calculateReallocationPlan(vault);

    console.log(`\nReallocation Plan:`);
    console.log(`   Current Pool: ${plan.currentPool || "None"}`);
    console.log(`   Current APY: ${plan.currentApy.toFixed(2)}%`);
    console.log(`   Target Pool: ${plan.targetPool}`);
    console.log(`   Target APY: ${plan.targetApy.toFixed(2)}%`);
    console.log(
      `   Amount: ${ethers.utils.formatUnits(
        plan.amountToReallocate || "0",
        18
      )}`
    );
    console.log(
      `   Should Reallocate: ${plan.shouldReallocate ? "YES" : "NO"}`
    );
    console.log(`   Reason: ${plan.reason}`);

    // Execute reallocation (unless dry run)
    if (!dryRun && wallet) {
      await executeReallocation(vault, plan);
    } else if (dryRun) {
      console.log(`\nDRY RUN - No transactions executed`);
    }
  } catch (error: any) {
    console.error(`\nError:`, error.message);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");

  reallocateVault(dryRun)
    .then(() => {
      console.log("\nDone!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nFailed:", error);
      process.exit(1);
    });
}

export { reallocateVault, calculateReallocationPlan };
