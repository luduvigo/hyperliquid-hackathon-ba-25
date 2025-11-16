import mongoose from "mongoose";

// Automation History Schema
const automationHistorySchema = new mongoose.Schema(
  {
    // Vault address
    vault_address: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    // Timestamp of automation run
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Best pool found (by opportunity score)
    best_pool: {
      pool_address: String,
      description: String,
      opportunity_score: Number,
      apy: Number,
      tvl_usd: Number,
    },
    // Current pool (if allocated)
    current_pool: {
      pool_address: String,
      description: String,
      opportunity_score: Number,
      apy: Number,
      tvl_usd: Number,
      allocated_amount: String, // BigNumber as string
    },
    // All available pools at this time
    available_pools: [
      {
        pool_address: String,
        description: String,
        opportunity_score: Number,
        apy: Number,
        tvl_usd: Number,
      },
    ],
    // Vault state
    vault_state: {
      idle_balance: String, // BigNumber as string
      total_assets: String, // BigNumber as string
      allocated_amount: String, // BigNumber as string
    },
    // Decision made
    decision: {
      type: String,
      enum: ["no_action", "deposit_idle", "reallocate_to_better_pool", "error"],
      required: true,
    },
    // Action details
    action: {
      type: {
        type: String,
        enum: ["deposit", "withdraw", "reallocate", "none"],
      },
      from_pool: String,
      to_pool: String,
      amount: String, // BigNumber as string
      tx_hash: String,
      success: Boolean,
      error_message: String,
    },
    // Whether a better pool was found
    better_pool_found: {
      type: Boolean,
      default: false,
    },
    // Opportunity score difference
    opportunity_score_difference: {
      type: Number,
      default: 0,
    },
    // Metadata
    success: {
      type: Boolean,
      default: true,
    },
    error_message: {
      type: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for efficient querying
automationHistorySchema.index({ vault_address: 1, timestamp: -1 });
automationHistorySchema.index({ timestamp: -1 });
automationHistorySchema.index({ decision: 1, timestamp: -1 });

// Model
export const AutomationHistory = mongoose.model(
  "AutomationHistory",
  automationHistorySchema
);

// Types
export interface IAutomationHistory {
  vault_address: string;
  timestamp: Date;
  best_pool?: {
    pool_address: string;
    description: string;
    opportunity_score: number;
    apy: number;
    tvl_usd: number;
  };
  current_pool?: {
    pool_address: string;
    description: string;
    opportunity_score: number;
    apy: number;
    tvl_usd: number;
    allocated_amount: string;
  };
  available_pools?: Array<{
    pool_address: string;
    description: string;
    opportunity_score: number;
    apy: number;
    tvl_usd: number;
  }>;
  vault_state?: {
    idle_balance: string;
    total_assets: string;
    allocated_amount: string;
  };
  decision:
    | "no_action"
    | "deposit_idle"
    | "reallocate_to_better_pool"
    | "error";
  action?: {
    type: "deposit" | "withdraw" | "reallocate" | "none";
    from_pool?: string;
    to_pool?: string;
    amount: string;
    tx_hash?: string;
    success: boolean;
    error_message?: string;
  };
  better_pool_found: boolean;
  opportunity_score_difference: number;
  success: boolean;
  error_message?: string;
}
