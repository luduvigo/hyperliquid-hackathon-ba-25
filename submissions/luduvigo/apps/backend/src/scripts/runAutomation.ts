// Script to manually run vault automation
import "../config/env";
import { connectDatabase } from "../services/database";
import { runVaultAutomation } from "../services/vaultAutomation";

async function main() {
  console.log("Starting manual automation run...");

  try {
    // Connect to database
    await connectDatabase();
    console.log("Database connected");

    // Run automation
    await runVaultAutomation();
    console.log("Automation completed");

    process.exit(0);
  } catch (error: any) {
    console.error("Error running automation:", error);
    process.exit(1);
  }
}

main();
