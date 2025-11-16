// IMPORTANT: Load environment variables FIRST before any other imports
import "./config/env";

import express from "express";
import cors from "cors";
import yields from "./routes/yields";
import optimize from "./routes/optimize";
import testGluex from "./routes/test-gluex";
import apyRoutes from "./routes/apy";
import automationRoutes from "./routes/automation";
import { connectDatabase, getDatabaseStatus } from "./services/database";
import { startCronJobs, stopCronJobs } from "./services/cronJobs";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/yields", yields);
app.use("/optimize", optimize);
app.use("/test-gluex", testGluex);
app.use("/api/apy", apyRoutes);
app.use("/api/automation", automationRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus() ? "connected" : "disconnected",
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Connect to MongoDB (optional - server will start even if not configured)
    try {
      await connectDatabase();
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      console.log(
        "Continuing without database - APY tracking will be disabled"
      );
      // Don't exit - allow server to start without database
    }

    // Start cron jobs only if enabled via environment variable
    // Set ENABLE_CRON_JOBS=true in production, leave unset/false for local development
    const enableCronJobs =
      process.env.ENABLE_CRON_JOBS === "true" ||
      process.env.NODE_ENV === "production";

    console.log(`Cron jobs configuration:`);
    console.log(
      `   ENABLE_CRON_JOBS: ${process.env.ENABLE_CRON_JOBS || "not set"}`
    );
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
    console.log(`   Will start cron jobs: ${enableCronJobs}`);

    if (enableCronJobs) {
      startCronJobs();
    } else {
      console.log(
        "⏸️  Cron jobs disabled (set ENABLE_CRON_JOBS=true to enable)"
      );
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
      console.log(
        `Test GlueX API at: http://localhost:${PORT}/test-gluex/test`
      );
      console.log(
        `Database status: ${getDatabaseStatus() ? "Connected" : "Disconnected"}`
      );
      if (enableCronJobs && getDatabaseStatus()) {
        console.log(`APY tracking active (every minute)`);
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  stopCronJobs();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down gracefully...");
  stopCronJobs();
  process.exit(0);
});

startServer();
