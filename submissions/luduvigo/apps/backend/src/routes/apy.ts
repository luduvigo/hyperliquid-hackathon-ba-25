import { Router, Request, Response } from "express";
import {
  getLatestApy,
  getPoolApyHistory,
  getPoolApyStats,
  getMarketAverageHistory,
  getLatestMarketAverage,
} from "../services/apyTracker";
import {
  getVaultTvlHistory,
  getLatestVaultTvl,
} from "../services/vaultTracker";
import { getCronJobsStatus } from "../services/cronJobs";
import { getDatabaseStatus } from "../services/database";

const router: Router = Router();

// Debug: Log all route registrations
console.log("Registering APY routes...");

/**
 * GET /api/apy/latest
 * Get latest APY for all tracked pools
 */
router.get("/latest", async (req: Request, res: Response) => {
  try {
    const latestApy = await getLatestApy();
    res.json({
      success: true,
      count: latestApy.length,
      pools: latestApy,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching latest APY:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch latest APY",
    });
  }
});

/**
 * GET /api/apy/history/:poolAddress
 * Get APY history for a specific pool
 * Query params: hours (default: 24)
 */
router.get("/history/:poolAddress", async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const history = await getPoolApyHistory(poolAddress, hours);

    res.json({
      success: true,
      pool_address: poolAddress,
      hours,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error("Error fetching pool APY history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch pool APY history",
    });
  }
});

/**
 * GET /api/apy/stats/:poolAddress
 * Get APY statistics for a specific pool
 * Query params: hours (default: 24)
 */
router.get("/stats/:poolAddress", async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const stats = await getPoolApyStats(poolAddress, hours);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "No data found for this pool",
      });
    }

    res.json({
      success: true,
      pool_address: poolAddress,
      hours,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching pool APY stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch pool APY stats",
    });
  }
});

/**
 * GET /api/apy/opportunity-score/token/:tokenAddress
 * Get opportunity score history for all pools for a specific token
 * Query params: hours (default: 24)
 * NOTE: This route must come BEFORE /token/:tokenAddress to avoid route conflicts
 */
console.log(
  "  ✓ Registering route: GET /api/apy/opportunity-score/token/:tokenAddress"
);
router.get(
  "/opportunity-score/token/:tokenAddress",
  async (req: Request, res: Response) => {
    console.log(
      `📊 Opportunity score route hit: /api/apy/opportunity-score/token/${req.params.tokenAddress}`
    );
    try {
      const { tokenAddress } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;

      // Get latest APY to find all pools for this token
      const latestApy = await getLatestApy();
      const tokenPools = latestApy.filter(
        (pool) => pool.input_token?.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (tokenPools.length === 0) {
        return res.json({
          success: true,
          token_address: tokenAddress,
          hours,
          pools: [],
          message: "No pools found for this token",
        });
      }

      // Get opportunity score history for each pool
      const poolsWithHistory = await Promise.all(
        tokenPools.map(async (pool) => {
          const history = await getPoolApyHistory(pool.pool_address, hours);
          // Extract only opportunity score data from history
          const scoreHistory = history.map((h: any) => ({
            timestamp: h.timestamp,
            opportunity_score: h.opportunity_score || null,
            opportunity_score_details: h.opportunity_score_details || null,
          }));
          return {
            ...pool,
            history: scoreHistory,
          };
        })
      );

      res.json({
        success: true,
        token_address: tokenAddress,
        hours,
        count: poolsWithHistory.length,
        pools: poolsWithHistory,
      });
    } catch (error: any) {
      console.error("Error fetching token opportunity score history:", error);
      res.status(500).json({
        success: false,
        error:
          error.message || "Failed to fetch token opportunity score history",
      });
    }
  }
);

/**
 * GET /api/apy/tvl/token/:tokenAddress
 * Get TVL history for all pools for a specific token
 * Query params: hours (default: 24)
 * NOTE: This route must come BEFORE /token/:tokenAddress to avoid route conflicts
 */
router.get("/tvl/token/:tokenAddress", async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    // Get latest APY to find all pools for this token
    const latestApy = await getLatestApy();
    const tokenPools = latestApy.filter(
      (pool) => pool.input_token?.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (tokenPools.length === 0) {
      return res.json({
        success: true,
        token_address: tokenAddress,
        hours,
        pools: [],
        message: "No pools found for this token",
      });
    }

    // Get TVL history for each pool
    const poolsWithHistory = await Promise.all(
      tokenPools.map(async (pool) => {
        const history = await getPoolApyHistory(pool.pool_address, hours);
        // Extract only TVL data from history
        const tvlHistory = history.map((h: any) => ({
          timestamp: h.timestamp,
          tvl_usd: h.tvl_usd || null,
        }));
        return {
          ...pool,
          history: tvlHistory,
        };
      })
    );

    res.json({
      success: true,
      token_address: tokenAddress,
      hours,
      count: poolsWithHistory.length,
      pools: poolsWithHistory,
    });
  } catch (error: any) {
    console.error("Error fetching token TVL history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch token TVL history",
    });
  }
});

/**
 * GET /api/apy/token/:tokenAddress
 * Get APY history for all pools for a specific token
 * Query params: hours (default: 24)
 * NOTE: This route must come AFTER /tvl/token/:tokenAddress to avoid route conflicts
 */
router.get("/token/:tokenAddress", async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    // Get latest APY to find all pools for this token
    const latestApy = await getLatestApy();
    const tokenPools = latestApy.filter(
      (pool) => pool.input_token?.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (tokenPools.length === 0) {
      return res.json({
        success: true,
        token_address: tokenAddress,
        hours,
        pools: [],
        message: "No pools found for this token",
      });
    }

    // Get history for each pool
    const poolsWithHistory = await Promise.all(
      tokenPools.map(async (pool) => {
        const history = await getPoolApyHistory(pool.pool_address, hours);
        return {
          ...pool,
          history,
        };
      })
    );

    res.json({
      success: true,
      token_address: tokenAddress,
      hours,
      count: poolsWithHistory.length,
      pools: poolsWithHistory,
    });
  } catch (error: any) {
    console.error("Error fetching token APY history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch token APY history",
    });
  }
});

/**
 * GET /api/apy/market-average
 * Get latest market average APY
 * Query params: token (optional - filter by token address)
 */
router.get("/market-average", async (req: Request, res: Response) => {
  try {
    const tokenAddress = req.query.token as string | undefined;
    const marketAverage = await getLatestMarketAverage(tokenAddress || null);

    if (!marketAverage) {
      return res.json({
        success: true,
        market_average: null,
        message: "No market average data available",
      });
    }

    res.json({
      success: true,
      market_average: marketAverage,
    });
  } catch (error: any) {
    console.error("Error fetching market average:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch market average",
    });
  }
});

/**
 * GET /api/apy/market-average/history
 * Get market average history
 * Query params: hours (default: 24), token (optional - filter by token address)
 */
router.get("/market-average/history", async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const tokenAddress = req.query.token as string | undefined;

    const history = await getMarketAverageHistory(tokenAddress || null, hours);

    res.json({
      success: true,
      token_address: tokenAddress || null,
      hours,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error("Error fetching market average history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch market average history",
    });
  }
});

/**
 * GET /api/apy/cron/status
 * Get status of APY tracking cron jobs
 */
router.get("/cron/status", (req: Request, res: Response) => {
  try {
    const status = getCronJobsStatus();
    const envCheck = {
      ENABLE_CRON_JOBS: process.env.ENABLE_CRON_JOBS || "not set",
      NODE_ENV: process.env.NODE_ENV || "not set",
      cronJobsEnabled:
        process.env.ENABLE_CRON_JOBS === "true" ||
        process.env.NODE_ENV === "production",
      databaseConnected: getDatabaseStatus(),
      requiredEnvVars: {
        VAULT_ADDRESS: !!process.env.VAULT_ADDRESS,
        ASSET_TOKEN: !!process.env.ASSET_TOKEN,
        PRIVATE_KEY: !!process.env.PRIVATE_KEY,
        HYPEREVM_RPC_URL: !!process.env.HYPEREVM_RPC_URL,
      },
    };

    res.json({
      success: true,
      cron_jobs: status,
      environment: envCheck,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get cron job status",
    });
  }
});

/**
 * GET /api/apy/vault-tvl/history
 * Get vault TVL history
 * Query params: vault (required - vault address), hours (default: 168 = 7 days)
 */
router.get("/vault-tvl/history", async (req: Request, res: Response) => {
  try {
    const vaultAddress = req.query.vault as string | undefined;
    const hours = parseInt(req.query.hours as string) || 168;

    if (!vaultAddress) {
      return res.status(400).json({
        success: false,
        error: "Vault address is required",
      });
    }

    const history = await getVaultTvlHistory(vaultAddress, hours);

    res.json({
      success: true,
      vault_address: vaultAddress.toLowerCase(),
      hours,
      count: history.length,
      data: history,
    });
  } catch (error: any) {
    console.error("Error fetching vault TVL history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch vault TVL history",
    });
  }
});

/**
 * GET /api/apy/vault-tvl/latest
 * Get latest vault TVL
 * Query params: vault (required - vault address)
 */
router.get("/vault-tvl/latest", async (req: Request, res: Response) => {
  try {
    const vaultAddress = req.query.vault as string | undefined;

    if (!vaultAddress) {
      return res.status(400).json({
        success: false,
        error: "Vault address is required",
      });
    }

    const latest = await getLatestVaultTvl(vaultAddress);

    if (!latest) {
      return res.json({
        success: true,
        vault_tvl: null,
        message: "No vault TVL data available",
      });
    }

    res.json({
      success: true,
      vault_tvl: latest,
    });
  } catch (error: any) {
    console.error("Error fetching latest vault TVL:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch latest vault TVL",
    });
  }
});

export default router;
