import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { AutomationHistory } from "../models/AutomationHistory";
import { runVaultAutomation } from "../services/vaultAutomation";

const router: Router = Router();

/**
 * GET /api/automation/history
 * Get automation history
 * Query params: vault (optional - filter by vault address), limit (default: 100)
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const vaultAddress = req.query.vault as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const query: any = {};
    if (vaultAddress) {
      query.vault_address = vaultAddress.toLowerCase();
    }

    const history = await AutomationHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error("Error fetching automation history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch automation history",
    });
  }
});

/**
 * GET /api/automation/latest
 * Get latest automation run
 * Query params: vault (optional - filter by vault address)
 */
router.get("/latest", async (req: Request, res: Response) => {
  try {
    const vaultAddress = req.query.vault as string | undefined;

    const query: any = {};
    if (vaultAddress) {
      query.vault_address = vaultAddress.toLowerCase();
    }

    const latest = await AutomationHistory.findOne(query)
      .sort({ timestamp: -1 })
      .lean();

    if (!latest) {
      return res.json({
        success: true,
        automation: null,
        message: "No automation history available",
      });
    }

    res.json({
      success: true,
      automation: latest,
    });
  } catch (error: any) {
    console.error("Error fetching latest automation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch latest automation",
    });
  }
});

/**
 * GET /api/automation/vault-history
 * Get vault historical data (APY and TVL) from automation history
 * Query params: vault (required - vault address), hours (default: 168 = 7 days)
 */
router.get("/vault-history", async (req: Request, res: Response) => {
  try {
    const vaultAddress = req.query.vault as string | undefined;
    const hours = parseInt(req.query.hours as string) || 168;

    if (!vaultAddress) {
      return res.status(400).json({
        success: false,
        error: "Vault address is required",
      });
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await AutomationHistory.find({
      vault_address: vaultAddress.toLowerCase(),
      timestamp: { $gte: since },
    })
      .sort({ timestamp: 1 })
      .select("timestamp vault_state current_pool best_pool")
      .lean();

    // Transform data for charts
    // USD₮0 has 6 decimals
    const TOKEN_DECIMALS = 6;

    const chartData = history.map((record: any) => {
      // Get APY from current_pool if available, otherwise from best_pool
      const apy = record.current_pool?.apy || record.best_pool?.apy || null;

      // Get TVL = total_assets + idle_balance
      // Both are stored as BigNumber strings (in smallest unit), need to convert
      let tvl: number | null = null;
      if (record.vault_state) {
        try {
          let totalTvl = ethers.BigNumber.from(0);

          // Add total_assets if available
          if (record.vault_state.total_assets) {
            totalTvl = totalTvl.add(record.vault_state.total_assets);
          }

          // Add idle_balance if available
          if (record.vault_state.idle_balance) {
            totalTvl = totalTvl.add(record.vault_state.idle_balance);
          }

          // Convert from BigNumber (smallest unit) to actual token amount
          if (!totalTvl.isZero()) {
            tvl = parseFloat(
              ethers.utils.formatUnits(totalTvl, TOKEN_DECIMALS)
            );
          }
        } catch (error) {
          console.error("Error converting TVL:", error);
          tvl = null;
        }
      }

      return {
        timestamp: record.timestamp,
        apy: apy,
        tvl: tvl,
      };
    });

    res.json({
      success: true,
      vault_address: vaultAddress.toLowerCase(),
      hours,
      count: chartData.length,
      data: chartData,
    });
  } catch (error: any) {
    console.error("Error fetching vault history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch vault history",
    });
  }
});

/**
 * POST /api/automation/run
 * Manually trigger automation run
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    console.log("Manual automation trigger received");

    // Run automation asynchronously (don't wait for it to complete)
    runVaultAutomation().catch((error) => {
      console.error("Error in manual automation run:", error);
    });

    res.json({
      success: true,
      message: "Automation triggered successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error triggering automation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to trigger automation",
    });
  }
});

export default router;
