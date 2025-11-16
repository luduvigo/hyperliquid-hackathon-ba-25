# Sticky Yield

> **Full Repository History**  
> This is a hackathon submission. For the complete development history, commits, and full repository, please visit:  
> **[https://github.com/gorilli-team/sticky-yield](https://github.com/gorilli-team/sticky-yield)**

Video presentation: [https://www.loom.com/share/22c7d9c989eb4ae996da1deff4687aa1](https://www.loom.com/share/22c7d9c989eb4ae996da1deff4687aa1)

---

A yield optimization platform that automatically reallocates user deposits across the highest-yielding pools on HyperEVM, maximizing returns while considering stability and pool capacity.

## Purpose

**Sticky Yield provides users with better APY for their assets** by:

- **Aggregating deposits** into a single vault contract
- **Automatically discovering** the best yield opportunities across multiple pools
- **Intelligently allocating** funds to pools with the highest opportunity scores
- **Continuously rebalancing** as market conditions change
- **Distributing yield** proportionally to all depositors

Users simply deposit their assets and receive shares. The system handles all the complexity of finding optimal pools, managing allocations, and maximizing returns.

## How It Works

### 1. Pool Discovery & Data Collection

The system continuously monitors multiple yield pools by fetching real-time and historical data from **GlueX Protocol APIs**:

#### Data Sources

- **GlueX Historical APY API** (`/historical-apy`): Fetches historical yield data for each pool
  - Historic yield APY (from lending/borrowing activities)
  - Rewards APY (from token incentives)
  - Total APY = Historic APY + Rewards APY
  - Historical data points for stability analysis

- **GlueX TVL API** (`/tvl`): Fetches current Total Value Locked for each pool
  - Current TVL in native token
  - TVL in USD
  - Used for capacity and liquidity analysis

#### Tracking Process

1. **Cron Job** runs every 5 minutes (`apps/backend/src/services/cronJobs.ts`)
2. For each tracked pool (`apps/backend/src/services/apyTracker.ts`):
   - Fetches current APY from GlueX Historical APY API
   - Fetches current TVL from GlueX TVL API
   - Calculates 24-hour APY statistics (average, standard deviation)
   - Stores data in MongoDB for historical tracking

3. **Historical Analysis**:
   - Calculates average APY over last 24 hours
   - Calculates standard deviation (volatility measure)
   - Tracks TVL changes over time

### 2. Opportunity Score Calculation

The system uses a **Opportunity Score** to identify the best pools, balancing yield potential with stability and capacity.

#### The Formula

```
Opportunity Score = Stability-Adjusted APY × TVL Confidence Factor
```

#### Components

**1. Stability-Adjusted APY**
```
Stability-Adjusted APY = APY_avg_24h - (Risk_Penalty_Factor × APY_std_24h)
```

- **APY_avg_24h**: Average APY over the last 24 hours
- **APY_std_24h**: Standard deviation of APY (measures volatility)
- **Risk_Penalty_Factor**: Multiplier for volatility penalty (default: 1)

**Purpose**: Penalizes pools with high volatility. A pool with 10% average APY but 5% standard deviation is less attractive than a pool with 8% average APY and 1% standard deviation.

**2. TVL Confidence Factor**
```
TVL_Confidence_Factor = 1 / (1 + e^(-k × (TVL_current / My_Asset_Size - m)))
```

- **TVL_current**: Current Total Value Locked in the pool
- **My_Asset_Size**: Size of assets we want to deploy (default: $100k)
- **k**: Sigmoid steepness (default: 20)
- **m**: Sigmoid midpoint ratio (default: 0.1, meaning 10% of pool)

**Purpose**: Ensures pools have sufficient capacity. Pools much larger than our asset size get high confidence (approaches 1.0), while pools similar in size to our assets get lower confidence (approaches 0.0).

#### Calculation Process

1. **Fetch Historical Data**: Get all APY data points for last 24 hours from MongoDB
2. **Calculate Statistics**: Compute average and standard deviation
3. **Get Current TVL**: Fetch latest TVL from GlueX API or database
4. **Apply Formula**: Calculate opportunity score using both components
5. **Store Result**: Save opportunity score with details for each pool

**Implementation**: `apps/backend/src/utils/opportunityScore.ts`

### 3. Best Pool Identification

The system identifies the best pool using a multi-factor approach:

1. **Primary Metric**: Opportunity Score (if available)
   - Combines yield potential, stability, and capacity
   - Most reliable indicator for long-term returns

2. **Fallback Metric**: Total APY (if opportunity score unavailable)
   - Used when historical data is insufficient
   - Simple comparison of current APY values

3. **Sorting Logic**:
   ```typescript
   sortedPools.sort((a, b) => {
     const aScore = a.opportunity_score ?? a.total_apy ?? 0;
     const bScore = b.opportunity_score ?? b.total_apy ?? 0;
     return bScore - aScore; // Descending order
   });
   ```

4. **Best Pool**: The pool with the highest score becomes the target for allocation

**Implementation**: `apps/backend/src/services/vaultAutomation.ts`

### 4. Automated Asset Allocation

The system automatically reallocates funds to maximize returns:

#### Automation Process

1. **Trigger**: Cron job runs every hour (`0 * * * *`)
2. **Data Collection**:
   - Fetches latest APY data for all tracked pools
   - Calculates opportunity scores
   - Gets current vault state (idle balance, allocations)

3. **Decision Logic**:

   **Scenario A: Better Pool Found & Current Allocations Exist**
   - Withdraws funds from all current pools
   - Waits for funds to settle as idle balance
   - Deposits all idle funds (minus small buffer) to best pool
   - Records reallocation in database

   **Scenario B: Idle Funds Available**
   - Deposits idle funds to best pool
   - Keeps small buffer (0.1% or minimum 0.01 tokens) for gas/withdrawals
   - Records deposit in database

   **Scenario C: Already Optimal**
   - No action needed
   - Records "no_action" decision

4. **Execution**:
   - Uses vault owner's private key to sign transactions
   - Calls `withdrawFromVault()` to exit current pools
   - Calls `reallocate()` to enter best pool
   - Handles transaction confirmations and errors

5. **Recording**:
   - Saves automation record to MongoDB
   - Includes decision, pools compared, amounts, transaction hashes
   - Tracks success/failure for monitoring

**Implementation**: `apps/backend/src/services/vaultAutomation.ts`

#### Safety Features

- **Ownership Check**: Only vault owner can execute reallocations
- **Gas Buffer**: Keeps small amount idle for withdrawals
- **Error Handling**: Graceful failure with detailed logging
- **Database Tracking**: All actions recorded for audit

## Architecture

This is a **Turborepo monorepo** containing:

- **`apps/web`**: Next.js frontend with Privy wallet integration
- **`apps/backend`**: Node.js/Express API for yield optimization
- **`packages/contracts`**: Foundry Solidity smart contracts
- **`packages/shared`**: Shared TypeScript types

## System Flow

```
┌─────────────┐
│   Users     │
│ (Depositors)│
└──────┬──────┘
       │ deposit(assets)
       │ withdraw(shares)
       ▼
┌─────────────────┐
│ OptimizerVault  │
│  (Smart Contract)│
│                 │
│ • userShares    │
│ • totalShares   │
│ • idleBalance   │
│ • allocations   │
└──────┬──────────┘
       │
       │ reallocate()
       │ withdrawFromVault()
       │ (owner only)
       ▼
┌─────────────────┐
│  Yield Pools    │
│                 │
│ • Hypurr        │
│ • Felix         │
│ • etc.          │
└─────────────────┘
       ▲
       │
       │ Data Collection
       │
┌─────────────────┐
│  Backend API    │
│                 │
│ • APY Tracking  │
│ • Opportunity   │
│   Score Calc    │
│ • Automation    │
└──────┬──────────┘
       │
       │ API Calls
       ▼
┌─────────────────┐
│  GlueX Protocol │
│                 │
│ • Historical    │
│   APY API       │
│ • TVL API       │
└─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Foundry (for contracts)
- MongoDB (for data storage)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
cp apps/backend/.env.example apps/backend/.env
cp packages/contracts/env.example packages/contracts/.env

# Edit .env files with your configuration

# Run all apps in development mode
pnpm dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Project Structure

```
sticky-yield/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── pages/       # Next.js pages
│   │   │   ├── components/  # React components
│   │   │   ├── lib/         # Utilities & API clients
│   │   │   └── styles/      # CSS styles
│   │   └── package.json
│   │
│   └── backend/             # Express backend
│       ├── src/
│       │   ├── routes/      # API routes
│       │   ├── services/   # Business logic
│       │   │   ├── apyTracker.ts      # APY data collection
│       │   │   ├── vaultAutomation.ts # Automated reallocation
│       │   │   ├── vaultTracker.ts     # TVL tracking
│       │   │   └── gluexYields.ts     # GlueX API integration
│       │   ├── models/     # MongoDB models
│       │   ├── utils/      # Utilities
│       │   │   └── opportunityScore.ts # Opportunity score calculation
│       │   └── config/    # Configuration
│       └── package.json
│
└── packages/
    ├── contracts/           # Solidity contracts
    │   ├── src/
    │   │   ├── OptimizerVault.sol
    │   │   ├── Interfaces.sol
    │   │   └── whitelist.sol
    │   ├── test/
    │   └── script/
    │
    └── shared/              # Shared TypeScript types
        └── types/
```

## Documentation

### Core Documentation

- **[OPTIMIZER_VAULT.md](./OPTIMIZER_VAULT.md)**: Complete explanation of the OptimizerVault smart contract logic, including all functions, security model, and deployment instructions

- **[SETUP.md](./SETUP.md)**: Detailed setup guide for the entire project

### Backend Documentation

- **[apps/backend/README.md](./apps/backend/README.md)**: Backend API documentation and setup
- **[apps/backend/REALLOCATION.md](./apps/backend/REALLOCATION.md)**: Manual reallocation script documentation

### Contract Documentation

- **[packages/contracts/README.md](./packages/contracts/README.md)**: Smart contract development guide
- **[packages/contracts/DEPLOYMENT.md](./packages/contracts/DEPLOYMENT.md)**: Detailed deployment instructions
- **[packages/contracts/WHITELIST_TOGGLE.md](./packages/contracts/WHITELIST_TOGGLE.md)**: Whitelist mode documentation

### Frontend Documentation

- **[apps/web/README.md](./apps/web/README.md)**: Frontend setup and development guide

## Development

### Frontend (Next.js)

```bash
cd apps/web
pnpm dev
```

Features:
- Privy wallet authentication
- Real-time yield display
- Vault status monitoring
- Historical charts (APY, TVL, Opportunity Score)
- Modern, responsive UI

### Backend (Node.js)

```bash
cd apps/backend
pnpm dev
```

API Endpoints:
- `GET /api/apy/latest` - Get latest APY for all pools with opportunity scores
- `GET /api/apy/history?pool=0x...&hours=168` - Get historical APY data
- `GET /api/apy/vault-tvl/history` - Get vault TVL history
- `GET /api/apy/vault-tvl/latest` - Get latest vault TVL and allocations
- `GET /api/automation/vault-history` - Get automation history
- `POST /api/automation/run` - Manually trigger automation
- `GET /api/apy/cron/status` - Check cron job status
- `GET /health` - Health check

### Smart Contracts (Foundry)

```bash
cd packages/contracts

# Build
forge build

# Test
forge test

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

Contracts:
- **OptimizerVault**: Main vault for deposits/withdrawals and reallocations
- **Interfaces**: ERC20, ERC7540, and vault interfaces

## Environment Variables

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Backend (`apps/backend/.env`)

```env
PORT=3001
NODE_ENV=development
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/sticky-yield
GLUEX_API_KEY=your_api_key  # Optional
HYPEREVM_RPC_URL=https://api.hyperliquid.xyz/evm
VAULT_ADDRESS=0x...  # Vault contract address
ASSET_TOKEN=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb  # USD₮0
PRIVATE_KEY=0x...  # Vault owner private key (for automation)
ENABLE_CRON_JOBS=true  # Enable automated tracking and reallocation
DISABLE_AUTOMATION_CRON=false  # Set to true to disable automation in local
```

### Contracts (`packages/contracts/.env`)

```env
PRIVATE_KEY=your_private_key
ASSET_TOKEN=0x... # USD₮0 or base asset address
HYPEREVM_RPC_URL=https://api.hyperliquid.xyz/evm
ETHERSCAN_API_KEY=your_etherscan_key
```

## Key Features

1. **Automated Yield Optimization**: Continuously monitors and reallocates funds to highest-yielding pools
2. **Opportunity Score**: Metric balancing yield, stability, and capacity
3. **Historical Analysis**: Tracks APY over time to identify stable opportunities
4. **Privy Wallet Integration**: Seamless wallet connection and authentication
5. **GlueX Protocol Integration**: 
   - Historical APY API for yield data
   - TVL API for capacity analysis
6. **Share-Based Accounting**: Users receive proportional shares of total vault value
7. **Automated Rebalancing**: Hourly automation to optimize allocations
8. **Real-Time Monitoring**: Dashboard showing current allocations and performance
9. **Whitelist System**: Optional whitelist mode for production security

## Testing

```bash
# Test all packages
pnpm test

# Test specific package
cd packages/contracts
forge test -vvv
```

## Deployment

### Frontend (Vercel)

```bash
cd apps/web
vercel deploy
```

### Backend (Railway/Render)

```bash
cd apps/backend
# Deploy via Railway CLI or connect GitHub repo
```

### Contracts (Mainnet)

```bash
cd packages/contracts
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

See [packages/contracts/DEPLOYMENT.md](./packages/contracts/DEPLOYMENT.md) for detailed instructions.

## Contributing

This is a hackathon project. For production use, additional features needed:
- Enhanced security audits
- Gas optimization
- Comprehensive error handling
- Rate limiting
- Advanced rebalancing strategies
- Multi-asset support

## License

MIT

## Acknowledgments

- GlueX Protocol for yield optimization infrastructure and APIs
- Privy for wallet authentication
- Foundry for Solidity development
- Turborepo for monorepo tooling
