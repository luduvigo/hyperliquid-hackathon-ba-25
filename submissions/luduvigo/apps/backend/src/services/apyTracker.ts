import { ApyHistory } from "../models/ApyHistory";
import { MarketAverage } from "../models/MarketAverage";
import { getPoolHistoricalApy, getPoolTvl } from "./gluexYields";
import {
  calculateOpportunityScore,
  OpportunityScoreResult,
} from "../utils/opportunityScore";

// Pool configuration
export interface PoolConfig {
  description: string;
  url: string;
  pool_address: string;
  chain: string;
}

// List of all pools to track
export const TRACKED_POOLS: PoolConfig[] = [
  {
    description: "USD₮0 Hypurr",
    url: "https://app.hypurr.fi/markets/isolated/999/0x543DBF5C74C6fb7C14f62b1Ae010a3696e22E3A0",
    pool_address: "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
    chain: "hyperevm",
  },
  {
    description: "HYPURRFI - PT-hwHLP < > USD₮0",
    url: "https://app.hypurr.fi/markets/isolated/999/0x543DBF5C74C6fb7C14f62b1Ae010a3696e22E3A0",
    pool_address: "0x543dbf5c74c6fb7c14f62b1ae010a3696e22e3a0",
    chain: "hyperevm",
  },
  {
    description: "HYPURRFI - hbUSDT < > USD₮0",
    url: "https://app.hypurr.fi/markets/isolated/999/0xcDA6D421d5edB4267D99B4b66Dd423Ca1B8d4410",
    pool_address: "0xcDA6D421d5edB4267D99B4b66Dd423Ca1B8d4410",
    chain: "hyperevm",
  },
  {
    description: "HYPURRFI - hbUSDT < > USD₮0",
    url: "https://app.hypurr.fi/markets/isolated/999/0x1C5164A764844356d57654ea83f9f1B72Cd10db5",
    pool_address: "0x1C5164A764844356d57654ea83f9f1B72Cd10db5",
    chain: "hyperevm",
  },
  {
    description: "HYPURRFI - hwHLP < > USD₮0",
    url: "https://app.hypurr.fi/markets/isolated/999/0x2c910F67DbF81099e6f8e126E7265d7595DC20aD",
    pool_address: "0x2c910F67DbF81099e6f8e126E7265d7595DC20aD",
    chain: "hyperevm",
  },
  {
    description: "Felix USD₮0",
    url: "https://www.usefelix.xyz/vanilla/lend",
    pool_address: "0xfc5126377f0efc0041c0969ef9ba903ce67d151e",
    chain: "hyperevm",
  },
  {
    description: "Felix USD₮0 Frontier",
    url: "https://www.usefelix.xyz/frontier/lend",
    pool_address: "0x9896a8605763106e57A51aa0a97Fe8099E806bb3",
    chain: "hyperevm",
  },
  {
    description: "Hypurr LHYPE < > USDXL",
    url: "https://app.hypurr.fi/markets/isolated/999/0xAeedD5B6d42e0F077ccF3E7A78ff70b8cB217329",
    pool_address: "0xAeedD5B6d42e0F077ccF3E7A78ff70b8cB217329",
    chain: "hyperevm",
  },
  {
    description: "Hypurr MHYPE",
    url: "https://app.hypurr.fi/markets/isolated/999/0xE4847Cb23dAd9311b9907497EF8B39d00AC1DE14",
    pool_address: "0xE4847Cb23dAd9311b9907497EF8B39d00AC1DE14",
    chain: "hyperevm",
  },
  {
    description: "GlueX USDT0",
    url: "[TODO: Add pool URL]",
    pool_address: "0xcdc3975df9d1cf054f44ed238edfb708880292ea",
    chain: "hyperevm",
  },
  {
    description: "Hyperithm USDT0",
    url: "[TODO: Add pool URL]",
    pool_address: "0xe5add96840f0b908ddeb3bd144c0283ac5ca7ca0",
    chain: "hyperevm",
  },
  {
    description: "Hyperbeat USDT",
    url: "[TODO: Add pool URL]",
    pool_address: "0x5e105266db42f78fa814322bce7f388b4c2e61eb",
    chain: "hyperevm",
  },
  {
    description: "Hyperlend Hyperevm USDT0",
    url: "[TODO: Add pool URL]",
    pool_address: "0x10982ad645d5a112606534d8567418cf64c14cb5",
    chain: "hyperevm",
  },
  // {
  //   description: "Hypurr Pooled USD₮0",
  //   url: "https://app.hypurr.fi/markets/pooled/999/0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
  //   pool_address: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
  //   chain: "hyperevm",
  // },
];

/**
 * Fetch and store APY for a single pool
 */
async function trackPoolApy(pool: PoolConfig): Promise<void> {
  try {
    console.log(
      `📊 Tracking APY and TVL for ${pool.description} (${pool.pool_address})`
    );

    // Fetch APY and TVL from GlueX in parallel
    const [apyResult, tvlResult] = await Promise.all([
      getPoolHistoricalApy(pool.pool_address, pool.chain).catch((err) => {
        console.error(`Failed to fetch APY for ${pool.description}:`, err);
        return null;
      }),
      getPoolTvl(pool.pool_address, pool.chain).catch((err) => {
        console.error(`Failed to fetch TVL for ${pool.description}:`, err);
        return null;
      }),
    ]);

    // Extract APY values
    const historicApy = apyResult?.historic_yield?.apy?.apy || 0;
    const rewardsApy = apyResult?.rewards_status?.rewards_yield?.apy || 0;
    const totalApy = historicApy + rewardsApy;
    const inputToken = apyResult?.historic_yield?.input_token;

    // Extract TVL values
    const tvl = tvlResult?.tvl?.tvl || null;
    const tvlUsd = tvlResult?.tvl?.tvl_usd || null;

    // Calculate opportunity score using historical data
    let opportunityScore: number | null = null;
    let opportunityScoreDetails: any = null;
    const defaultAssetSize = 100000; // Default: $100k

    try {
      // Get APY statistics for last 24 hours to calculate opportunity score
      const stats = await getPoolApyStats(pool.pool_address, 24);

      if (stats && stats.count > 0 && tvlUsd) {
        const scoreResult = calculateOpportunityScore({
          apyAvg24h: stats.average,
          apyStd24h: stats.stdDev,
          tvlCurrent: tvlUsd,
          myAssetSize: defaultAssetSize,
          riskPenaltyFactor: 1,
          tvlK: 20,
          tvlM: 0.1,
        });

        opportunityScore = scoreResult.opportunityScore;
        opportunityScoreDetails = {
          stability_adjusted_apy: scoreResult.stabilityAdjustedApy,
          tvl_confidence_factor: scoreResult.tvlConfidenceFactor,
          apy_avg_24h: scoreResult.apyAvg24h,
          apy_std_24h: scoreResult.apyStd24h,
          tvl_current: scoreResult.tvlCurrent,
          my_asset_size: scoreResult.myAssetSize,
        };

        // Log opportunity score calculation details
        console.log(
          `📊 Opportunity Score for ${
            pool.description
          }: ${opportunityScore.toFixed(2)}`
        );
        console.log(
          `   └─ APY Avg 24h: ${scoreResult.apyAvg24h.toFixed(
            2
          )}%, Std: ${scoreResult.apyStd24h.toFixed(2)}%`
        );
        console.log(
          `   └─ Stability Adjusted APY: ${scoreResult.stabilityAdjustedApy.toFixed(
            2
          )}%`
        );
        console.log(
          `   └─ TVL Confidence: ${(
            scoreResult.tvlConfidenceFactor * 100
          ).toFixed(1)}% (TVL: $${tvlUsd.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}, Asset Size: $${defaultAssetSize.toLocaleString()})`
        );
      } else {
        if (!stats || stats.count === 0) {
          console.log(
            `⚠️  Cannot calculate opportunity score for ${pool.description}: No historical APY data (need at least 1 data point)`
          );
        }
        if (!tvlUsd) {
          console.log(
            `⚠️  Cannot calculate opportunity score for ${pool.description}: No TVL data available`
          );
        }
      }
    } catch (scoreError) {
      console.error(
        `⚠️  Failed to calculate opportunity score for ${pool.description}:`,
        scoreError
      );
      // Continue without opportunity score - don't fail the entire tracking
    }

    // Save to database
    const apyRecord = new ApyHistory({
      pool_address: pool.pool_address.toLowerCase(),
      chain: pool.chain,
      description: pool.description,
      url: pool.url,
      input_token: inputToken?.toLowerCase(),
      total_apy: totalApy,
      historic_apy: historicApy,
      rewards_apy: rewardsApy,
      tvl: tvl,
      tvl_usd: tvlUsd,
      opportunity_score: opportunityScore,
      opportunity_score_details: opportunityScoreDetails,
      opportunity_score_asset_size: defaultAssetSize,
      raw_response: apyResult,
      success: true,
      timestamp: new Date(),
    });

    await apyRecord.save();

    const tvlInfo = tvlUsd
      ? `, TVL: $${tvlUsd.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}`
      : "";
    const scoreInfo =
      opportunityScore !== null
        ? `, Opportunity Score: ${opportunityScore.toFixed(2)}`
        : "";
    console.log(
      `✅ Saved APY for ${pool.description}: ${totalApy.toFixed(
        2
      )}% (Historic: ${historicApy.toFixed(2)}%, Rewards: ${rewardsApy.toFixed(
        2
      )}%)${tvlInfo}${scoreInfo}`
    );

    // Additional opportunity score summary if available
    if (opportunityScore !== null && opportunityScoreDetails) {
      console.log(
        `   📈 Opportunity Score Details: Stability APY ${opportunityScoreDetails.stability_adjusted_apy.toFixed(
          2
        )}% × TVL Confidence ${(
          opportunityScoreDetails.tvl_confidence_factor * 100
        ).toFixed(1)}% = ${opportunityScore.toFixed(2)}`
      );
    }
  } catch (error: any) {
    console.error(
      `❌ Error tracking APY for ${pool.description}:`,
      error.message
    );

    // Save error record
    try {
      const errorRecord = new ApyHistory({
        pool_address: pool.pool_address.toLowerCase(),
        chain: pool.chain,
        description: pool.description,
        url: pool.url,
        total_apy: 0,
        historic_apy: 0,
        rewards_apy: 0,
        success: false,
        error_message: error.message,
        timestamp: new Date(),
      });

      await errorRecord.save();
    } catch (saveError) {
      console.error("Failed to save error record:", saveError);
    }
  }
}

/**
 * Calculate and store market average APY (TVL-weighted)
 * Market Average = Σ(APY(i) × TVL(i)) / Σ(TVL(i))
 */
async function calculateAndStoreMarketAverage(
  tokenAddress?: string | null
): Promise<void> {
  try {
    // Get latest APY data for all pools (or filtered by token)
    const latestApy = await getLatestApy();

    // Filter by token if specified
    const poolsToInclude = tokenAddress
      ? latestApy.filter(
          (pool: any) =>
            pool.input_token?.toLowerCase() === tokenAddress.toLowerCase()
        )
      : latestApy;

    // Filter pools that have both APY and TVL data
    const validPools = poolsToInclude.filter(
      (pool: any) =>
        pool.total_apy !== null &&
        pool.total_apy !== undefined &&
        pool.tvl_usd !== null &&
        pool.tvl_usd !== undefined &&
        pool.tvl_usd > 0
    );

    if (validPools.length === 0) {
      console.log(
        `⚠️  No valid pools with APY and TVL data for market average calculation${
          tokenAddress ? ` (token: ${tokenAddress})` : ""
        }`
      );
      return;
    }

    // Calculate TVL-weighted average APY
    let totalWeightedSum = 0; // Σ(APY(i) × TVL(i))
    let totalTvl = 0; // Σ(TVL(i))
    let totalTvlUsd = 0; // Σ(TVL_USD(i))

    const poolBreakdown = validPools.map((pool: any) => {
      const apy = pool.total_apy || 0;
      const tvlUsd = pool.tvl_usd || 0;
      const weightedContribution = apy * tvlUsd;

      totalWeightedSum += weightedContribution;
      totalTvlUsd += tvlUsd;
      // For total_tvl, use tvl if available, otherwise use tvl_usd
      totalTvl += pool.tvl || tvlUsd;

      return {
        pool_address: pool.pool_address,
        description: pool.description || "Unknown Pool",
        apy: apy,
        tvl_usd: tvlUsd,
        weighted_contribution: weightedContribution,
      };
    });

    // Calculate market average: Total_Weighted_Sum / Total_TVL
    const marketAvgApy = totalTvlUsd > 0 ? totalWeightedSum / totalTvlUsd : 0;

    // Store market average
    const marketAverageRecord = new MarketAverage({
      token_address: tokenAddress?.toLowerCase() || null,
      market_avg_apy: marketAvgApy,
      total_tvl: totalTvl,
      total_tvl_usd: totalTvlUsd,
      pool_count: validPools.length,
      pool_breakdown: poolBreakdown,
      timestamp: new Date(),
    });

    await marketAverageRecord.save();

    console.log(
      `📊 Market Average APY${
        tokenAddress ? ` (${tokenAddress})` : ""
      }: ${marketAvgApy.toFixed(2)}% (${
        validPools.length
      } pools, Total TVL: $${totalTvlUsd.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })})`
    );
  } catch (error: any) {
    console.error(
      `❌ Error calculating market average${
        tokenAddress ? ` for token ${tokenAddress}` : ""
      }:`,
      error.message
    );
    // Don't throw - allow tracking to continue even if market average fails
  }
}

/**
 * Track APY for all pools
 */
export async function trackAllPoolsApy(): Promise<void> {
  const startTime = Date.now();
  console.log(
    `\n🚀 Starting APY tracking cycle at ${new Date().toISOString()}`
  );
  console.log(`📍 Tracking ${TRACKED_POOLS.length} pools...\n`);

  try {
    // Track all pools in parallel
    await Promise.all(TRACKED_POOLS.map((pool) => trackPoolApy(pool)));

    // Calculate and store market average after all pools are tracked
    // Calculate for all pools combined
    await calculateAndStoreMarketAverage(null);

    // Also calculate per-token market averages
    // Get unique tokens from tracked pools
    const latestApy = await getLatestApy();
    const uniqueTokens = new Set<string>();
    latestApy.forEach((pool: any) => {
      if (pool.input_token) {
        uniqueTokens.add(pool.input_token.toLowerCase());
      }
    });

    // Calculate market average for each token
    for (const token of uniqueTokens) {
      await calculateAndStoreMarketAverage(token);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nAPY tracking cycle completed in ${duration}s\n`);
  } catch (error) {
    console.error("Error in APY tracking cycle:", error);
  }
}

/**
 * Enrich pool data with opportunity score
 * Uses stored opportunity score from database if available and asset size matches,
 * otherwise recalculates
 */
async function enrichPoolWithOpportunityScore(
  pool: any,
  myAssetSize: number = 100000 // Default: $100k
): Promise<any> {
  // If pool already has opportunity_score from database and asset size matches, use it
  if (
    pool.opportunity_score !== null &&
    pool.opportunity_score !== undefined &&
    pool.opportunity_score_asset_size === myAssetSize
  ) {
    return pool; // Already has the score we need
  }

  try {
    // Get APY statistics (avg, std) for last 24 hours
    const stats = await getPoolApyStats(pool.pool_address, 24);

    if (!stats || stats.count === 0) {
      // If no historical data, return stored score if available, otherwise null
      return {
        ...pool,
        opportunity_score: pool.opportunity_score || null,
        opportunity_score_details: pool.opportunity_score_details || null,
      };
    }

    // Get current TVL (use from pool data or fetch)
    const tvlUsd = pool.tvl_usd || 0;

    // Calculate opportunity score with requested asset size
    const opportunityScoreResult = calculateOpportunityScore({
      apyAvg24h: stats.average,
      apyStd24h: stats.stdDev,
      tvlCurrent: tvlUsd,
      myAssetSize: myAssetSize,
      riskPenaltyFactor: 1, // Default risk penalty
      tvlK: 20, // Default sigmoid steepness
      tvlM: 0.1, // Default midpoint (10% of pool)
    });

    return {
      ...pool,
      opportunity_score: opportunityScoreResult.opportunityScore,
      opportunity_score_details: {
        stability_adjusted_apy: opportunityScoreResult.stabilityAdjustedApy,
        tvl_confidence_factor: opportunityScoreResult.tvlConfidenceFactor,
        apy_avg_24h: opportunityScoreResult.apyAvg24h,
        apy_std_24h: opportunityScoreResult.apyStd24h,
        tvl_current: opportunityScoreResult.tvlCurrent,
        my_asset_size: opportunityScoreResult.myAssetSize,
      },
    };
  } catch (error) {
    console.error(
      `Error calculating opportunity score for pool ${pool.pool_address}:`,
      error
    );
    // Return stored score if available, otherwise null
    return {
      ...pool,
      opportunity_score: pool.opportunity_score || null,
      opportunity_score_details: pool.opportunity_score_details || null,
    };
  }
}

/**
 * Get latest APY for all pools from database
 * @param myAssetSize - Optional asset size for opportunity score calculation (default: $100k)
 */
export async function getLatestApy(myAssetSize?: number) {
  try {
    const latestRecords = await ApyHistory.aggregate([
      { $match: { success: true } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$pool_address",
          latest: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$latest" } },
      { $sort: { total_apy: -1 } },
    ]);

    // Enrich each pool with opportunity score
    const enrichedPools = await Promise.all(
      latestRecords.map((pool) =>
        enrichPoolWithOpportunityScore(pool, myAssetSize)
      )
    );

    // Sort by opportunity score (if available) or by APY
    enrichedPools.sort((a, b) => {
      if (a.opportunity_score !== null && b.opportunity_score !== null) {
        return b.opportunity_score - a.opportunity_score;
      }
      if (a.opportunity_score !== null) return -1;
      if (b.opportunity_score !== null) return 1;
      return (b.total_apy || 0) - (a.total_apy || 0);
    });

    return enrichedPools;
  } catch (error) {
    console.error("Error fetching latest APY:", error);
    throw error;
  }
}

/**
 * Get APY history for a specific pool
 */
export async function getPoolApyHistory(
  poolAddress: string,
  hours: number = 24
): Promise<any[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await ApyHistory.find({
      pool_address: poolAddress.toLowerCase(),
      timestamp: { $gte: since },
      success: true,
    })
      .sort({ timestamp: 1 })
      .lean();

    return history;
  } catch (error) {
    console.error("Error fetching pool APY history:", error);
    throw error;
  }
}

/**
 * Get APY statistics for a pool (including standard deviation)
 */
export async function getPoolApyStats(poolAddress: string, hours: number = 24) {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // First get all APY values to calculate standard deviation
    const history = await ApyHistory.find({
      pool_address: poolAddress.toLowerCase(),
      timestamp: { $gte: since },
      success: true,
    })
      .select("total_apy")
      .sort({ timestamp: 1 })
      .lean();

    const apyValues = history.map((h: any) => h.total_apy || 0);

    // Calculate statistics
    if (apyValues.length === 0) {
      return null;
    }

    const current = apyValues[apyValues.length - 1];
    const average =
      apyValues.reduce((sum, val) => sum + val, 0) / apyValues.length;
    const min = Math.min(...apyValues);
    const max = Math.max(...apyValues);

    // Calculate standard deviation
    const mean = average;
    const squaredDiffs = apyValues.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / apyValues.length;
    const stdDev = Math.sqrt(variance);

    return {
      current,
      average,
      min,
      max,
      stdDev,
      count: apyValues.length,
    };
  } catch (error) {
    console.error("Error fetching pool APY stats:", error);
    throw error;
  }
}

/**
 * Get market average history
 * @param tokenAddress - Optional token address to filter by (null for all tokens)
 * @param hours - Number of hours of history to retrieve (default: 24)
 */
export async function getMarketAverageHistory(
  tokenAddress?: string | null,
  hours: number = 24
): Promise<any[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const query: any = {
      timestamp: { $gte: since },
    };

    if (tokenAddress) {
      query.token_address = tokenAddress.toLowerCase();
    } else {
      // If no token specified, get overall market average (token_address is null)
      query.token_address = null;
    }

    const history = await MarketAverage.find(query)
      .sort({ timestamp: 1 })
      .lean();

    return history;
  } catch (error) {
    console.error("Error fetching market average history:", error);
    throw error;
  }
}

/**
 * Get latest market average
 * @param tokenAddress - Optional token address to filter by (null for all tokens)
 */
export async function getLatestMarketAverage(
  tokenAddress?: string | null
): Promise<any | null> {
  try {
    const query: any = {};

    if (tokenAddress) {
      query.token_address = tokenAddress.toLowerCase();
    } else {
      query.token_address = null;
    }

    const latest = await MarketAverage.findOne(query)
      .sort({ timestamp: -1 })
      .lean();

    return latest;
  } catch (error) {
    console.error("Error fetching latest market average:", error);
    throw error;
  }
}
