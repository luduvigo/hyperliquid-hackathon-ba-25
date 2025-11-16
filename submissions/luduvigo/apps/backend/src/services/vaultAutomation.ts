import { ethers } from "ethers";
import { getLatestApy } from "./apyTracker";
import {
  AutomationHistory,
  IAutomationHistory,
} from "../models/AutomationHistory";
import { getDatabaseStatus } from "./database";

// Configuration from environment
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
const ASSET_TOKEN = process.env.ASSET_TOKEN || "";
const RPC_URL = process.env.HYPEREVM_RPC_URL || "https://rpc.hypurrscan.io";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// Vault ABI
const VAULT_ABI = [
  "function reallocate(address vault, uint256 amount) external",
  "function withdrawFromVault(address vault, uint256 amount) external",
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

/**
 * Get all current vault allocations
 */
async function getAllCurrentAllocations(
  vault: ethers.Contract,
  provider: ethers.providers.Provider
): Promise<Array<{ pool: string; amount: ethers.BigNumber }>> {
  const latestApy = await getLatestApy();
  const tokenPools = latestApy.filter(
    (pool: any) => pool.input_token?.toLowerCase() === ASSET_TOKEN.toLowerCase()
  );

  const allocations: Array<{ pool: string; amount: ethers.BigNumber }> = [];

  // Check allocations for each pool
  for (const pool of tokenPools) {
    const allocation = await vault.vaultAllocations(pool.pool_address);
    if (allocation.gt(0)) {
      allocations.push({
        pool: pool.pool_address,
        amount: allocation,
      });
    }
  }

  return allocations;
}

/**
 * Wait for funds to be available in idle balance
 */
async function waitForIdleFunds(
  assetToken: ethers.Contract,
  expectedAmount: ethers.BigNumber,
  maxWaitTime: number = 30000, // 30 seconds
  checkInterval: number = 2000 // 2 seconds
): Promise<ethers.BigNumber> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const currentIdle = await assetToken.balanceOf(VAULT_ADDRESS);
    if (currentIdle.gte(expectedAmount)) {
      return currentIdle;
    }
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  // Return whatever is available after max wait time
  return await assetToken.balanceOf(VAULT_ADDRESS);
}

/**
 * Get vault state
 */
async function getVaultState(
  vault: ethers.Contract,
  assetToken: ethers.Contract,
  provider: ethers.providers.Provider
) {
  const [idleBalance, totalAssets, allAllocations] = await Promise.all([
    assetToken.balanceOf(VAULT_ADDRESS),
    vault.totalAssets(),
    getAllCurrentAllocations(vault, provider),
  ]);

  const allocatedAmount = allAllocations.reduce(
    (sum, alloc) => sum.add(alloc.amount),
    ethers.BigNumber.from(0)
  );

  return {
    idle_balance: idleBalance.toString(),
    total_assets: totalAssets.toString(),
    allocated_amount: allocatedAmount.toString(),
  };
}

/**
 * Run automation for the vault
 */
export async function runVaultAutomation(): Promise<void> {
  if (!getDatabaseStatus()) {
    console.error("Skipping automation - database not connected");
    return;
  }

  if (!VAULT_ADDRESS || !ASSET_TOKEN || !PRIVATE_KEY) {
    console.error("Skipping automation - missing configuration");
    return;
  }

  const startTime = Date.now();
  console.log("Starting vault automation...");

  let automationRecord: Partial<IAutomationHistory> = {
    vault_address: VAULT_ADDRESS.toLowerCase(),
    timestamp: new Date(),
    decision: "error",
    better_pool_found: false,
    opportunity_score_difference: 0,
    success: false,
  };

  try {
    // Setup provider and contracts
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet);
    const assetToken = new ethers.Contract(ASSET_TOKEN, ERC20_ABI, provider);

    // Verify we're the owner
    const owner = await vault.OWNER();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Wallet is not the vault owner");
    }

    // Get latest APY data
    const latestApy = await getLatestApy();
    const tokenPools = latestApy.filter(
      (pool: any) =>
        pool.input_token?.toLowerCase() === ASSET_TOKEN.toLowerCase()
    );

    if (tokenPools.length === 0) {
      throw new Error("No pools found for asset token");
    }

    // Sort by opportunity score (prefer opportunity score over APY)
    const sortedPools = [...tokenPools].sort((a: any, b: any) => {
      const aScore = a.opportunity_score ?? a.total_apy ?? 0;
      const bScore = b.opportunity_score ?? b.total_apy ?? 0;
      return bScore - aScore;
    });

    const bestPool = sortedPools[0];

    // Get all current allocations
    const allCurrentAllocations = await getAllCurrentAllocations(
      vault,
      provider
    );
    const currentPool =
      allCurrentAllocations.length > 0
        ? sortedPools.find((p: any) =>
            allCurrentAllocations.some(
              (alloc) =>
                alloc.pool.toLowerCase() === p.pool_address.toLowerCase()
            )
          )
        : null;

    // Get vault state
    const vaultState = await getVaultState(vault, assetToken, provider);
    const idleBalanceBN = ethers.BigNumber.from(vaultState.idle_balance);
    const hasIdleFunds = idleBalanceBN.gt(0);

    console.log(
      `Vault State - Idle: ${ethers.utils.formatUnits(
        idleBalanceBN,
        6
      )}, Total Assets: ${ethers.utils.formatUnits(
        vaultState.total_assets,
        6
      )}, Allocated: ${ethers.utils.formatUnits(
        vaultState.allocated_amount,
        6
      )}`
    );
    console.log(`Current Allocations: ${allCurrentAllocations.length} pool(s)`);
    console.log(
      `Best Pool: ${bestPool.description} (Score: ${
        bestPool.opportunity_score?.toFixed(2) || "N/A"
      }, APY: ${bestPool.total_apy?.toFixed(2)}%)`
    );

    // Prepare automation record data
    automationRecord.best_pool = {
      pool_address: bestPool.pool_address,
      description: bestPool.description || "Unknown Pool",
      opportunity_score: bestPool.opportunity_score ?? null,
      apy: bestPool.total_apy || 0,
      tvl_usd: bestPool.tvl_usd || 0,
    };

    automationRecord.available_pools = sortedPools.map((pool: any) => ({
      pool_address: pool.pool_address,
      description: pool.description || "Unknown Pool",
      opportunity_score: pool.opportunity_score ?? null,
      apy: pool.total_apy || 0,
      tvl_usd: pool.tvl_usd || 0,
    }));

    automationRecord.vault_state = vaultState;

    if (currentPool && allCurrentAllocations.length > 0) {
      const totalAllocated = allCurrentAllocations.reduce(
        (sum, alloc) => sum.add(alloc.amount),
        ethers.BigNumber.from(0)
      );
      automationRecord.current_pool = {
        pool_address: currentPool.pool_address,
        description: currentPool.description || "Unknown Pool",
        opportunity_score: currentPool.opportunity_score ?? null,
        apy: currentPool.total_apy || 0,
        tvl_usd: currentPool.tvl_usd || 0,
        allocated_amount: totalAllocated.toString(),
      };
    }

    // Determine if better pool found
    const betterPoolFound =
      currentPool &&
      bestPool.pool_address.toLowerCase() !==
        currentPool.pool_address.toLowerCase() &&
      (bestPool.opportunity_score ?? bestPool.total_apy ?? 0) >
        (currentPool.opportunity_score ?? currentPool.total_apy ?? 0);

    automationRecord.better_pool_found = betterPoolFound;

    if (currentPool && betterPoolFound) {
      const currentScore =
        currentPool.opportunity_score ?? currentPool.total_apy ?? 0;
      const bestScore = bestPool.opportunity_score ?? bestPool.total_apy ?? 0;
      automationRecord.opportunity_score_difference = bestScore - currentScore;
    }

    // Decision logic
    let actionType: "deposit" | "withdraw" | "reallocate" | "none" = "none";
    let actionAmount = "0";
    let fromPool: string | undefined;
    let toPool: string | undefined;
    let txHash: string | undefined;
    let actionSuccess = false;
    let actionError: string | undefined;

    if (betterPoolFound && allCurrentAllocations.length > 0) {
      // Reallocate to better pool: withdraw from all pools, then deposit all idle to new pool
      automationRecord.decision = "reallocate_to_better_pool";
      actionType = "reallocate";
      fromPool = allCurrentAllocations.map((a) => a.pool).join(",");
      toPool = bestPool.pool_address;

      try {
        // Step 1: Withdraw from ALL current pools
        const initialIdleBalance = idleBalanceBN;
        const totalToWithdraw = allCurrentAllocations.reduce(
          (sum, alloc) => sum.add(alloc.amount),
          ethers.BigNumber.from(0)
        );

        console.log(
          `Withdrawing from ${
            allCurrentAllocations.length
          } pool(s), total: ${ethers.utils.formatUnits(
            totalToWithdraw,
            6
          )} tokens`
        );

        for (const allocation of allCurrentAllocations) {
          console.log(`Withdrawing from ${allocation.pool}...`);
          const withdrawTx = await vault.withdrawFromVault(
            allocation.pool,
            allocation.amount
          );
          await withdrawTx.wait();
          console.log(
            `Withdrew ${ethers.utils.formatUnits(allocation.amount, 6)} from ${
              allocation.pool
            }`
          );
        }

        // Step 2: Wait for funds to settle as idle (original idle + all withdrawn)
        console.log("Waiting for funds to settle as idle...");
        const expectedIdleAmount = initialIdleBalance.add(totalToWithdraw);
        console.log(
          `   Expected idle: ${ethers.utils.formatUnits(
            expectedIdleAmount,
            6
          )} (initial: ${ethers.utils.formatUnits(
            initialIdleBalance,
            6
          )} + withdrawn: ${ethers.utils.formatUnits(totalToWithdraw, 6)})`
        );

        const finalIdleBalance = await waitForIdleFunds(
          assetToken,
          expectedIdleAmount,
          60000, // Wait up to 60 seconds (increased from 30)
          3000 // Check every 3 seconds (increased from 2)
        );
        console.log(
          `Idle balance after withdrawals: ${ethers.utils.formatUnits(
            finalIdleBalance,
            6
          )}`
        );

        // Step 3: Deposit ALL idle funds to new pool
        // Keep small buffer (0.1% or minimum 0.01 tokens for small amounts, 0.1 for larger)
        const minBuffer = finalIdleBalance.gt(ethers.utils.parseUnits("10", 6))
          ? ethers.utils.parseUnits("0.1", 6)
          : ethers.utils.parseUnits("0.01", 6);
        const percentageBuffer = finalIdleBalance.mul(1).div(1000);
        const buffer = percentageBuffer.gt(minBuffer)
          ? percentageBuffer
          : minBuffer;
        const amountToReallocate = finalIdleBalance.sub(buffer);

        if (amountToReallocate.gt(0)) {
          console.log(
            `Depositing ${ethers.utils.formatUnits(
              amountToReallocate,
              6
            )} (all idle funds minus buffer) to ${bestPool.pool_address}...`
          );
          const reallocateTx = await vault.reallocate(
            bestPool.pool_address,
            amountToReallocate
          );
          await reallocateTx.wait();
          actionAmount = amountToReallocate.toString();
          txHash = reallocateTx.hash;
          actionSuccess = true;
          console.log(
            `Reallocated ${ethers.utils.formatUnits(
              amountToReallocate,
              6
            )} to ${bestPool.pool_address}`
          );
        } else {
          actionError = "Insufficient funds after withdrawal";
        }
      } catch (error: any) {
        actionError = error.message || "Reallocation failed";
        console.error("Reallocation error:", error);
      }
    } else if (hasIdleFunds) {
      // Deposit idle funds to best pool (whether we have allocations or not)
      automationRecord.decision = "deposit_idle";
      actionType = "deposit";
      toPool = bestPool.pool_address;

      try {
        // Keep small buffer (0.1% or minimum 0.01 tokens for small amounts, 0.1 for larger)
        const minBuffer = idleBalanceBN.gt(ethers.utils.parseUnits("10", 6))
          ? ethers.utils.parseUnits("0.1", 6)
          : ethers.utils.parseUnits("0.01", 6);
        const percentageBuffer = idleBalanceBN.mul(1).div(1000);
        const buffer = percentageBuffer.gt(minBuffer)
          ? percentageBuffer
          : minBuffer;
        const amountToDeposit = idleBalanceBN.sub(buffer);

        console.log(
          `Idle funds detected: ${ethers.utils.formatUnits(
            idleBalanceBN,
            6
          )}, Buffer: ${ethers.utils.formatUnits(
            buffer,
            6
          )}, Amount to deposit: ${ethers.utils.formatUnits(
            amountToDeposit,
            6
          )}`
        );

        if (amountToDeposit.gt(0)) {
          console.log(
            `Depositing ${ethers.utils.formatUnits(
              amountToDeposit,
              6
            )} idle funds to best pool ${bestPool.pool_address}...`
          );
          const depositTx = await vault.reallocate(
            bestPool.pool_address,
            amountToDeposit
          );
          await depositTx.wait();
          actionAmount = amountToDeposit.toString();
          txHash = depositTx.hash;
          actionSuccess = true;
          console.log(
            `Deposited ${ethers.utils.formatUnits(
              amountToDeposit,
              6
            )} idle funds to best pool`
          );
        } else {
          console.log(
            `Amount to deposit (${ethers.utils.formatUnits(
              amountToDeposit,
              6
            )}) is too small after buffer`
          );
          actionType = "none";
          automationRecord.decision = "no_action";
        }
      } catch (error: any) {
        actionError = error.message || "Deposit failed";
        console.error("Deposit error:", error);
      }
    } else {
      console.log("No idle funds to move");
      // No action needed
      automationRecord.decision = "no_action";
      actionType = "none";
    }

    // Record action
    automationRecord.action = {
      type: actionType,
      from_pool: fromPool,
      to_pool: toPool,
      amount: actionAmount,
      tx_hash: txHash,
      success: actionSuccess,
      error_message: actionError,
    };

    automationRecord.success = true;
  } catch (error: any) {
    console.error("Automation error:", error);
    automationRecord.error_message = error.message || "Unknown error";
    automationRecord.success = false;
  }

  // Save to database
  try {
    const record = new AutomationHistory(automationRecord);
    await record.save();
    const duration = Date.now() - startTime;
    console.log(
      `Automation completed in ${duration}ms. Decision: ${automationRecord.decision}`
    );
  } catch (error: any) {
    console.error("Failed to save automation record:", error);
  }
}
