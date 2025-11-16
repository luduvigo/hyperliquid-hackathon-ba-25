import axios from "axios";
import { TRACKED_POOLS, getPoolApyStats } from "./apyTracker";
import { ENV } from "../config/env";
import { calculateOpportunityScore } from "../utils/opportunityScore";

const GLUEX_YIELD_API_BASE = "https://yield-api.gluex.xyz";

export interface YieldPool {
  pool_address: string;
  chain: string;
  description?: string; // Pool description
  url?: string; // Pool URL
  apy?: number; // Total APY (historic + rewards)
  historic_apy?: number; // Historic yield APY
  rewards_apy?: number; // Rewards APY
  input_token?: string;
  name?: string;
  tvl?: number;
  tvl_usd?: number;
  opportunity_score?: number | null; // Opportunity score
  opportunity_score_details?: {
    stability_adjusted_apy: number;
    tvl_confidence_factor: number;
    apy_avg_24h: number;
    apy_std_24h: number;
    tvl_current: number;
    my_asset_size: number;
  } | null;
  raw_gluex_response?: any; // Full raw response from GlueX API
}

export interface YieldResponse {
  pools: YieldPool[];
  timestamp: string;

  total_pools?: number;
  successful_fetches?: number;
  raw_responses?: any[]; // All raw responses from GlueX
}

export interface HistoricalApyRequest {
  description: string;
  url: string;
  pool_address: string;
  chain: string;
}

/**
 * Fetch historical APY for a specific lending pool
 *
 * @param poolAddress - The lending pool contract address
 * @param chain - The blockchain network (e.g., "hyperevm")
 */
export async function getPoolHistoricalApy(
  poolAddress: string,
  chain: string
): Promise<any> {
  const requestData = {
    pool_address: poolAddress,
    chain: chain,
  };

  console.log("Making GlueX API request:", {
    url: `${GLUEX_YIELD_API_BASE}/historical-apy`,
    data: requestData,
  });

  try {
    const response = await axios.post(
      `${GLUEX_YIELD_API_BASE}/historical-apy`,
      requestData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("GlueX API response success for pool:", poolAddress);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("GlueX API Error Details:");
      console.error("  Status:", error.response?.status);
      console.error("  Status Text:", error.response?.statusText);
      console.error(
        "  Response Data:",
        JSON.stringify(error.response?.data, null, 2)
      );

      // Log validation details if present
      if (error.response?.data?.detail) {
        console.error(
          "  Validation Errors:",
          JSON.stringify(error.response.data.detail, null, 2)
        );
      }

      // Log the request that failed
      console.error(
        "  Failed Request Data:",
        JSON.stringify(requestData, null, 2)
      );
    } else {
      console.error("Non-Axios Error:", error);
    }
    throw new Error(`Failed to fetch pool APY from GlueX: ${poolAddress}`);
  }
}

/**
 * Fetch best current yields from multiple pools
 * This is a wrapper that queries multiple pools
 * @param myAssetSize - Optional asset size for opportunity score calculation (default: $100k)
 */
export async function getBestYield(
  myAssetSize: number = 100000
): Promise<YieldResponse> {
  try {
    // Use TRACKED_POOLS from apyTracker as the single source of truth
    // This ensures consistency between cron tracking and API responses
    const pools: HistoricalApyRequest[] = TRACKED_POOLS.map((pool) => ({
      description: pool.description,
      url: pool.url,
      pool_address: pool.pool_address,
      chain: pool.chain,
    }));

    console.log(`Fetching yields for ${pools.length} pool(s)...`);

    // Fetch APY and TVL for all pools in parallel
    const poolPromises = pools.map(async (pool) => {
      try {
        const [apyResult, tvlResult] = await Promise.all([
          getPoolHistoricalApy(pool.pool_address, pool.chain).catch((err) => {
            console.error(
              `Failed to fetch APY for pool ${pool.pool_address}:`,
              err
            );
            return null;
          }),
          getPoolTvl(pool.pool_address, pool.chain).catch((err) => {
            console.error(
              `Failed to fetch TVL for pool ${pool.pool_address}:`,
              err
            );
            return null;
          }),
        ]);

        return { apyResult, tvlResult, pool };
      } catch (err) {
        console.error(
          `Failed to fetch data for pool ${pool.pool_address}:`,
          err
        );
        return { apyResult: null, tvlResult: null, pool };
      }
    });

    const results = await Promise.all(poolPromises);

    // Filter out failed requests and format response
    const validPools = await Promise.all(
      results
        .filter((result) => result.apyResult !== null)
        .map(async (result) => {
          const { apyResult, tvlResult, pool } = result;

          // Extract APY from GlueX response structure
          const historicApy = apyResult?.historic_yield?.apy?.apy || 0;
          const rewardsApy = apyResult?.rewards_status?.rewards_yield?.apy || 0;
          const totalApy = historicApy + rewardsApy;

          // Extract TVL from GlueX response structure
          const tvl = tvlResult?.tvl?.tvl || null;
          const tvlUsd = tvlResult?.tvl?.tvl_usd || null;

          // Calculate opportunity score using historical data
          let opportunityScore: number | null = null;
          let opportunityScoreDetails: any = null;

          try {
            const stats = await getPoolApyStats(pool.pool_address, 24);
            if (stats && stats.count > 0 && tvlUsd) {
              const scoreResult = calculateOpportunityScore({
                apyAvg24h: stats.average,
                apyStd24h: stats.stdDev,
                tvlCurrent: tvlUsd,
                myAssetSize: myAssetSize,
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
            }
          } catch (error) {
            console.error(
              `Error calculating opportunity score for ${pool.pool_address}:`,
              error
            );
          }

          return {
            ...pool,
            apy: totalApy,
            historic_apy: historicApy,
            rewards_apy: rewardsApy,
            input_token: apyResult?.historic_yield?.input_token,
            tvl: tvl,
            tvl_usd: tvlUsd,
            opportunity_score: opportunityScore,
            opportunity_score_details: opportunityScoreDetails,
            raw_gluex_response: apyResult, // Include full GlueX response
          };
        })
    );

    // Sort pools by opportunity score (if available) or by APY
    const sortedPools = validPools.sort((a, b) => {
      if (a.opportunity_score !== null && b.opportunity_score !== null) {
        return b.opportunity_score - a.opportunity_score;
      }
      if (a.opportunity_score !== null) return -1;
      if (b.opportunity_score !== null) return 1;
      return (b.apy || 0) - (a.apy || 0);
    });

    return {
      pools: sortedPools,
      timestamp: new Date().toISOString(),
      total_pools: pools.length,
      successful_fetches: validPools.length,
      raw_responses: results.filter((r) => r !== null), // All raw GlueX responses
    };
  } catch (error) {
    console.error("Error fetching GlueX yields:", error);
    throw new Error("Failed to fetch yield data from GlueX");
  }
}

/**
 * Fetch TVL for a specific pool
 *
 * @param poolAddress - The pool contract address
 * @param chain - The blockchain network (e.g., "hyperevm")
 */
export async function getPoolTvl(
  poolAddress: string,
  chain: string
): Promise<any> {
  // Only send pool_address, not lp_token_address
  const requestData: any = {
    pool_address: poolAddress,
    chain: chain,
  };

  try {
    const headers: any = {
      "Content-Type": "application/json",
    };

    // Add API key if available
    if (ENV.GLUEX_API_KEY) {
      headers["X-API-Key"] = ENV.GLUEX_API_KEY;
    }

    // Debug: log the request data to verify it's correct
    console.log(
      `📊 Fetching TVL for pool ${poolAddress}, request data:`,
      JSON.stringify(requestData)
    );

    const response = await axios.post(
      `${GLUEX_YIELD_API_BASE}/tvl`,
      requestData,
      { headers }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `Failed to fetch TVL for pool ${poolAddress}:`,
        error.response?.data
      );
    } else {
      console.error(`Error fetching TVL for pool ${poolAddress}:`, error);
    }
    // Return null instead of throwing to allow graceful degradation
    return null;
  }
}

/**
 * Fetch historical yield data for multiple pools
 */
export async function getHistoricalYields(
  poolConfigs: HistoricalApyRequest[]
): Promise<any> {
  try {
    const promises = poolConfigs.map((config) =>
      getPoolHistoricalApy(config.pool_address, config.chain)
    );

    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error("Error fetching historical yields:", error);
    throw new Error("Failed to fetch historical yield data");
  }
}
