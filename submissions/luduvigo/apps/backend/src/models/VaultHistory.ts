import mongoose from "mongoose";

// Vault History Schema - tracks TVL and token distribution over time
const vaultHistorySchema = new mongoose.Schema(
  {
    vault_address: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    // Total TVL (idle + allocated)
    total_tvl: {
      type: Number,
      required: true,
    },
    // Idle balance (unallocated funds in vault)
    idle_balance: {
      type: Number,
      required: true,
      default: 0,
    },
    // Total allocated amount across all pools
    total_allocated: {
      type: Number,
      required: true,
      default: 0,
    },
    // Token distribution - breakdown by pool
    allocations: [
      {
        pool_address: {
          type: String,
          required: true,
          lowercase: true,
        },
        pool_description: {
          type: String,
        },
        amount: {
          type: Number,
          required: true,
        },
        percentage: {
          type: Number,
          default: 0,
        },
      },
    ],
    // Current APY (from best pool or current pool)
    current_apy: {
      type: Number,
      default: null,
    },
    // Best pool info at this time
    best_pool: {
      pool_address: String,
      description: String,
      apy: Number,
      opportunity_score: Number,
    },
    // Metadata
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
vaultHistorySchema.index({ vault_address: 1, timestamp: -1 });
vaultHistorySchema.index({ timestamp: -1 });

// Model
export const VaultHistory = mongoose.model("VaultHistory", vaultHistorySchema);

// Types
export interface IVaultHistory {
  vault_address: string;
  total_tvl: number;
  idle_balance: number;
  total_allocated: number;
  allocations: Array<{
    pool_address: string;
    pool_description?: string;
    amount: number;
    percentage: number;
  }>;
  current_apy?: number | null;
  best_pool?: {
    pool_address: string;
    description: string;
    apy: number;
    opportunity_score?: number;
  };
  timestamp: Date;
}

