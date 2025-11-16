import mongoose from "mongoose";

// Market Average Performance Schema
const marketAverageSchema = new mongoose.Schema(
  {
    // Token address (optional - can track market average for specific tokens)
    token_address: {
      type: String,
      lowercase: true,
      index: true,
      default: null, // null means all tokens combined
    },
    // Market Average APY (TVL-weighted)
    market_avg_apy: {
      type: Number,
      required: true,
    },
    // Total TVL across all pools
    total_tvl: {
      type: Number,
      required: true,
    },
    // Total TVL in USD
    total_tvl_usd: {
      type: Number,
      required: true,
    },
    // Number of pools included in calculation
    pool_count: {
      type: Number,
      required: true,
    },
    // Breakdown by pool (for reference/debugging)
    pool_breakdown: [
      {
        pool_address: String,
        description: String,
        apy: Number,
        tvl_usd: Number,
        weighted_contribution: Number, // APY × TVL
      },
    ],
    // Timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for efficient querying
marketAverageSchema.index({ token_address: 1, timestamp: -1 });
marketAverageSchema.index({ timestamp: -1 });

// Model
export const MarketAverage = mongoose.model(
  "MarketAverage",
  marketAverageSchema
);

// Types
export interface IMarketAverage {
  token_address?: string | null;
  market_avg_apy: number;
  total_tvl: number;
  total_tvl_usd: number;
  pool_count: number;
  pool_breakdown: Array<{
    pool_address: string;
    description: string;
    apy: number;
    tvl_usd: number;
    weighted_contribution: number;
  }>;
  timestamp: Date;
}
