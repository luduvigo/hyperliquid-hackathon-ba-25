# Backend API

Express.js backend for yield optimization and GlueX integration.

## Getting Started

```bash
pnpm install
pnpm dev
```

Server runs on [http://localhost:3001](http://localhost:3001)

## Environment Setup

Create `.env`:

```env
PORT=3001
NODE_ENV=development
MONGODB_CONNECTION_STRING= # mongo db connection string
GLUEX_API_KEY=your_api_key  # Optional
HYPEREVM_RPC_URL=https://api.hyperliquid.xyz/evm
VAULT_ADDRESS=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD
ASSET_TOKEN=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb
PRIVATE_KEY=0x...  # Vault owner private key (for automation)
ENABLE_CRON_JOBS=true  # Enable automated tracking and reallocation
DISABLE_AUTOMATION_CRON=false  # Set to true to disable automation in local
```

## API Endpoints

### Health Check

#### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

### Yields (GlueX Integration)

#### `GET /yields/best`
Get current best yields from GlueX for all tracked pools

**Response:**
```json
{
  "pools": [
    {
      "pool_address": "0x...",
      "description": "Pool Name",
      "apy": 7.19,
      "historic_apy": 7.19,
      "rewards_apy": 0,
      "tvl_usd": 1000000,
      "opportunity_score": 6.5
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `POST /yields/historical`
Get historical yield data for specific pools

**Request Body:**
```json
{
  "pools": [
    {
      "pool_address": "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
      "chain": "hyperevm"
    }
  ]
}
```

### Optimization

#### `POST /optimize`
Calculate optimal allocation strategy

**Request Body:**
```json
{
  "vaultAddress": "0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD",
  "amount": "1000"
}
```

**Response:**
```json
{
  "success": true,
  "allocation": {
    "strategy": [...],
    "weightedApy": 7.5
  },
  "expectedApy": 7.5
}
```

### APY Tracking

#### `GET /api/apy/latest`
Get latest APY for all tracked pools with opportunity scores

**Response:**
```json
{
  "success": true,
  "count": 10,
  "pools": [
    {
      "pool_address": "0x...",
      "description": "Pool Name",
      "total_apy": 7.19,
      "opportunity_score": 6.5,
      "tvl_usd": 1000000
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `GET /api/apy/history/:poolAddress`
Get APY history for a specific pool

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours of history to retrieve

**Example:** `GET /api/apy/history/0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007?hours=168`

**Response:**
```json
{
  "success": true,
  "pool_address": "0x...",
  "hours": 168,
  "count": 100,
  "history": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "total_apy": 7.19,
      "opportunity_score": 6.5
    }
  ]
}
```

#### `GET /api/apy/stats/:poolAddress`
Get APY statistics for a specific pool (average, standard deviation, etc.)

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours to calculate statistics over

**Example:** `GET /api/apy/stats/0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007?hours=24`

**Response:**
```json
{
  "success": true,
  "pool_address": "0x...",
  "hours": 24,
  "stats": {
    "average": 7.19,
    "stdDev": 0.5,
    "min": 6.5,
    "max": 8.0,
    "count": 288
  }
}
```

#### `GET /api/apy/token/:tokenAddress`
Get APY history for all pools for a specific token

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours of history to retrieve

**Example:** `GET /api/apy/token/0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb?hours=168`

**Response:**
```json
{
  "success": true,
  "token_address": "0x...",
  "hours": 168,
  "count": 5,
  "pools": [
    {
      "pool_address": "0x...",
      "description": "Pool Name",
      "history": [...]
    }
  ]
}
```

#### `GET /api/apy/opportunity-score/token/:tokenAddress`
Get opportunity score history for all pools for a specific token

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours of history to retrieve

**Example:** `GET /api/apy/opportunity-score/token/0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb?hours=24`

#### `GET /api/apy/tvl/token/:tokenAddress`
Get TVL history for all pools for a specific token

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours of history to retrieve

**Example:** `GET /api/apy/tvl/token/0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb?hours=168`

#### `GET /api/apy/market-average`
Get latest market average APY

**Query Parameters:**
- `token` (optional) - Filter by token address

**Example:** `GET /api/apy/market-average?token=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb`

**Response:**
```json
{
  "success": true,
  "market_average": {
    "token_address": "0x...",
    "average_apy": 7.0,
    "pool_count": 5,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### `GET /api/apy/market-average/history`
Get market average APY history

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours of history to retrieve
- `token` (optional) - Filter by token address

**Example:** `GET /api/apy/market-average/history?hours=168&token=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb`

#### `GET /api/apy/vault-tvl/history`
Get vault TVL history

**Query Parameters:**
- `vault` (required) - Vault address
- `hours` (optional, default: 168 = 7 days) - Number of hours of history to retrieve

**Example:** `GET /api/apy/vault-tvl/history?vault=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD&hours=168`

**Response:**
```json
{
  "success": true,
  "vault_address": "0x...",
  "hours": 168,
  "count": 100,
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "total_tvl": 100000.50,
      "idle_balance": 5000.00,
      "total_allocated": 95000.50,
      "allocations": [
        {
          "pool_address": "0x...",
          "pool_description": "Pool Name",
          "amount": 50000.00,
          "percentage": 50.0
        }
      ]
    }
  ]
}
```

#### `GET /api/apy/vault-tvl/latest`
Get latest vault TVL and allocations

**Query Parameters:**
- `vault` (required) - Vault address

**Example:** `GET /api/apy/vault-tvl/latest?vault=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD`

**Response:**
```json
{
  "success": true,
  "vault_tvl": {
    "vault_address": "0x...",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "total_tvl": 100000.50,
    "idle_balance": 5000.00,
    "total_allocated": 95000.50,
    "allocations": [
      {
        "pool_address": "0x...",
        "pool_description": "Pool Name",
        "amount": 50000.00,
        "percentage": 50.0
      }
    ],
    "current_apy": 7.19,
    "best_pool": {
      "pool_address": "0x...",
      "description": "Best Pool",
      "apy": 7.5
    }
  }
}
```

#### `GET /api/apy/cron/status`
Get status of APY tracking cron jobs and environment configuration

**Response:**
```json
{
  "success": true,
  "cron_jobs": {
    "apyTracking": {
      "active": true,
      "schedule": "*/5 * * * *",
      "description": "Tracks APY for all pools"
    },
    "vaultTvlTracking": {
      "active": true,
      "schedule": "*/5 * * * *",
      "description": "Tracks vault TVL and token distribution"
    },
    "vaultAutomation": {
      "active": true,
      "schedule": "0 * * * *",
      "description": "Runs vault automation (reallocation logic)"
    }
  },
  "environment": {
    "ENABLE_CRON_JOBS": "true",
    "NODE_ENV": "production",
    "cronJobsEnabled": true,
    "databaseConnected": true,
    "requiredEnvVars": {
      "VAULT_ADDRESS": true,
      "ASSET_TOKEN": true,
      "PRIVATE_KEY": true,
      "HYPEREVM_RPC_URL": true
    }
  }
}
```

### Automation

#### `GET /api/automation/history`
Get automation history (reallocation decisions and actions)

**Query Parameters:**
- `vault` (optional) - Filter by vault address
- `limit` (optional, default: 100) - Maximum number of records to return

**Example:** `GET /api/automation/history?vault=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD&limit=50`

**Response:**
```json
{
  "success": true,
  "count": 50,
  "history": [
    {
      "_id": "...",
      "vault_address": "0x...",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "decision": "reallocate_to_better_pool",
      "action": {
        "type": "reallocate",
        "from_pool": "0x...",
        "to_pool": "0x...",
        "amount": "100000000",
        "tx_hash": "0x...",
        "success": true
      },
      "best_pool": {
        "pool_address": "0x...",
        "apy": 7.5
      }
    }
  ]
}
```

#### `GET /api/automation/latest`
Get latest automation run

**Query Parameters:**
- `vault` (optional) - Filter by vault address

**Example:** `GET /api/automation/latest?vault=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD`

**Response:**
```json
{
  "success": true,
  "automation": {
    "vault_address": "0x...",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "decision": "deposit_idle",
    "action": {
      "type": "deposit",
      "to_pool": "0x...",
      "amount": "50000000",
      "success": true
    }
  }
}
```

#### `GET /api/automation/vault-history`
Get vault historical data (APY and TVL) from automation history

**Query Parameters:**
- `vault` (required) - Vault address
- `hours` (optional, default: 168 = 7 days) - Number of hours of history to retrieve

**Example:** `GET /api/automation/vault-history?vault=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD&hours=168`

**Response:**
```json
{
  "success": true,
  "vault_address": "0x...",
  "hours": 168,
  "count": 100,
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "apy": 7.19,
      "tvl": 100000.50
    }
  ]
}
```

#### `POST /api/automation/run`
Manually trigger automation run (reallocation logic)

**Response:**
```json
{
  "success": true,
  "message": "Automation triggered successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Note:** This endpoint triggers automation asynchronously and returns immediately. Check `/api/automation/latest` to see the result.

### Testing

#### `GET /test-gluex/test`
Test GlueX API integration (uses default test data)

**Response:**
```json
{
  "success": true,
  "message": "GlueX API call successful",
  "data": {
    "historic_yield": {...},
    "rewards_status": {...}
  },
  "request": {
    "pool_address": "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
    "chain": "hyperevm"
  }
}
```

#### `POST /test-gluex/test`
Test GlueX API integration with custom data

**Request Body:**
```json
{
  "pool_address": "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
  "chain": "hyperevm"
}
```

## Tech Stack

- Node.js
- Express
- TypeScript
- Axios
- MongoDB (Mongoose)
- GlueX API
- Ethers.js

## Cron Jobs

The backend runs automated cron jobs when `ENABLE_CRON_JOBS=true`:

- **APY Tracking**: Every 5 minutes - Fetches and stores APY data for all tracked pools
- **Vault TVL Tracking**: Every 5 minutes - Tracks vault TVL and token distribution
- **Vault Automation**: Every hour (at :00) - Automatically reallocates funds to best pools

See `/api/apy/cron/status` to check cron job status and configuration.
