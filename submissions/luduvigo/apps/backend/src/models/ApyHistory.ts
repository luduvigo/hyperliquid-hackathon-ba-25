import mongoose from "mongoose";

// APY History Schema
const apyHistorySchema = new mongoose.Schema(
  {
    pool_address: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    chain: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
    },
    url: {
      type: String,
    },
    input_token: {
      type: String,
      lowercase: true,
      index: true,
    },
    // APY data
    total_apy: {
      type: Number,
      required: true,
      default: 0,
    },
    historic_apy: {
      type: Number,
      default: 0,
    },
    rewards_apy: {
      type: Number,
      default: 0,
    },
    // TVL data
    tvl: {
      type: Number,
      default: null,
    },
    tvl_usd: {
      type: Number,
      default: null,
    },
    // Opportunity Score data (calculated with default asset size of $100k)
    opportunity_score: {
      type: Number,
      default: null,
      index: true,
    },
    opportunity_score_details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Asset size used for opportunity score calculation
    opportunity_score_asset_size: {
      type: Number,
      default: 100000, // Default: $100k
    },
    // Raw GlueX response for debugging
    raw_response: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Metadata
    success: {
      type: Boolean,
      default: true,
    },
    error_message: {
      type: String,
    },
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

// Compound indexes for efficient queries
apyHistorySchema.index({ pool_address: 1, timestamp: -1 });
apyHistorySchema.index({ input_token: 1, timestamp: -1 });
apyHistorySchema.index({ chain: 1, timestamp: -1 });
apyHistorySchema.index({ timestamp: -1 });
apyHistorySchema.index({ opportunity_score: -1, timestamp: -1 }); // For querying by opportunity score

// Model
export const ApyHistory = mongoose.model("ApyHistory", apyHistorySchema);

// Types
export interface IApyHistory {
  pool_address: string;
  chain: string;
  description?: string;
  url?: string;
  input_token?: string;
  total_apy: number;
  historic_apy: number;
  rewards_apy: number;
  tvl?: number;
  tvl_usd?: number;
  opportunity_score?: number | null;
  opportunity_score_details?: {
    stability_adjusted_apy: number;
    tvl_confidence_factor: number;
    apy_avg_24h: number;
    apy_std_24h: number;
    tvl_current: number;
    my_asset_size: number;
  } | null;
  opportunity_score_asset_size?: number;
  raw_response?: any;
  success: boolean;
  error_message?: string;
  timestamp: Date;
}
