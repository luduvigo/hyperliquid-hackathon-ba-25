import cron, { ScheduledTask } from "node-cron";
import { trackAllPoolsApy } from "./apyTracker";
import { runVaultAutomation } from "./vaultAutomation";
import { trackVaultTvl } from "./vaultTracker";
import { getDatabaseStatus } from "./database";

let apyTrackingJob: ScheduledTask | null = null;
let automationJob: ScheduledTask | null = null;
let vaultTvlJob: ScheduledTask | null = null;

/**
 * Start all cron jobs
 */
export function startCronJobs(): void {
  console.log("Starting cron jobs...");

  // APY tracking - every 5 minutes
  apyTrackingJob = cron.schedule("*/5 * * * *", async () => {
    // Check database connection
    if (!getDatabaseStatus()) {
      console.error("Skipping APY tracking - database not connected");
      return;
    }

    try {
      await trackAllPoolsApy();
    } catch (error) {
      console.error("Error in APY tracking cron job:", error);
    }
  });

  console.log("APY tracking cron job started (runs every 5 minutes)");

  // Vault TVL tracking - every 5 minutes
  vaultTvlJob = cron.schedule("*/5 * * * *", async () => {
    // Check database connection
    if (!getDatabaseStatus()) {
      console.error("Skipping vault TVL tracking - database not connected");
      return;
    }

    try {
      await trackVaultTvl();
    } catch (error) {
      console.error("Error in vault TVL tracking cron job:", error);
    }
  });

  console.log("Vault TVL tracking cron job started (runs every 5 minutes)");

  // Vault automation - every hour (at :00)
  // Note: node-cron doesn't handle unhandled promise rejections well,
  // so we wrap everything in a promise that we explicitly catch
  automationJob = cron.schedule("0 * * * *", () => {
    // Wrap in immediate async function to handle promises properly
    (async () => {
      const now = new Date();
      console.log(`\n[CRON] Automation job triggered at ${now.toISOString()}`);

      try {
        // Check database connection
        const dbStatus = getDatabaseStatus();
        console.log(
          `   [CRON] Database status: ${
            dbStatus ? "Connected" : "Disconnected"
          }`
        );
        if (!dbStatus) {
          console.error("[CRON] Skipping automation - database not connected");
          return;
        }

        // Check required environment variables
        const requiredVars = {
          VAULT_ADDRESS: process.env.VAULT_ADDRESS,
          ASSET_TOKEN: process.env.ASSET_TOKEN,
          PRIVATE_KEY: process.env.PRIVATE_KEY,
        };

        const missingVars = Object.entries(requiredVars)
          .filter(([_, value]) => !value)
          .map(([key]) => key);

        if (missingVars.length > 0) {
          console.error(
            `[CRON] Skipping automation - missing environment variables: ${missingVars.join(
              ", "
            )}`
          );
          return;
        }

        console.log(
          `   [CRON] All checks passed, calling runVaultAutomation()...`
        );
        await runVaultAutomation();
        console.log(
          `[CRON] Automation job completed successfully at ${new Date().toISOString()}`
        );
      } catch (error: any) {
        console.error("[CRON] Error in automation cron job:", error);
        console.error("   [CRON] Error details:", error.message);
        if (error.stack) {
          console.error("   [CRON] Stack trace:", error.stack);
        }
        // Re-throw to ensure it's logged, but don't let it crash the cron scheduler
      }
    })().catch((error: any) => {
      // Catch any unhandled promise rejections
      console.error(
        "[CRON] Unhandled promise rejection in automation cron:",
        error
      );
      console.error("   [CRON] This should not happen - check the code above");
    });
  });

  console.log("Vault automation cron job started (runs every hour at :00)");

  // Verify the job was actually created
  if (!automationJob) {
    console.error("Failed to create automation cron job!");
  } else {
    console.log("   Automation cron job object created successfully");
  }

  // Run once immediately on startup (after a delay)
  setTimeout(async () => {
    if (getDatabaseStatus()) {
      console.log("Running initial APY tracking...");
      await trackAllPoolsApy();
      console.log("Running initial vault TVL tracking...");
      await trackVaultTvl();
      // Note: Automation runs on schedule (every hour), not on startup
    }
  }, 5000); // Wait 5 seconds for everything to initialize
}

/**
 * Stop all cron jobs
 */
export function stopCronJobs(): void {
  console.log("Stopping cron jobs...");

  if (apyTrackingJob) {
    apyTrackingJob.stop();
    console.log("APY tracking cron job stopped");
  }

  if (automationJob) {
    automationJob.stop();
    console.log("Vault automation cron job stopped");
  }

  if (vaultTvlJob) {
    vaultTvlJob.stop();
    console.log("Vault TVL tracking cron job stopped");
  }
}

/**
 * Get status of all cron jobs
 */
export function getCronJobsStatus() {
  return {
    apyTracking: {
      active: apyTrackingJob ? true : false,
      schedule: "*/5 * * * *",
      description: "Tracks APY for all pools",
    },
    vaultTvlTracking: {
      active: vaultTvlJob ? true : false,
      schedule: "*/5 * * * *",
      description: "Tracks vault TVL and token distribution",
    },
    vaultAutomation: {
      active: automationJob ? true : false,
      schedule: "0 * * * *",
      description: "Runs vault automation (reallocation logic)",
    },
  };
}
