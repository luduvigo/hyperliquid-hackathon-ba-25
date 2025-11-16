# Setup Guide

Complete setup instructions for the GlueX Yield Optimizer monorepo.

## Prerequisites

Install the following tools:

1. **Node.js 18+**: https://nodejs.org/
2. **pnpm**: `npm install -g pnpm`
3. **Foundry** (for contracts): `curl -L https://foundry.paradigm.xyz | bash && foundryup`

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# From project root
pnpm install
```

This will install dependencies for all packages in the monorepo.

### 2. Configure Environment Variables

#### Frontend (`apps/web/.env.local`)

```bash
cd apps/web
cat > .env.local << EOF
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
EOF
```

Get your Privy App ID from https://dashboard.privy.io/

#### Backend (`apps/backend/.env`)

```bash
cd apps/backend
cat > .env << EOF
PORT=3001
NODE_ENV=development
GLUEX_API_KEY=your_gluex_api_key
RPC_URL=your_rpc_url
EOF
```

#### Contracts (optional, for deployment)

```bash
cd packages/contracts
cat > .env << EOF
PRIVATE_KEY=your_private_key
ASSET_TOKEN=0x... # USDC address
RPC_URL=your_rpc_url
ETHERSCAN_API_KEY=your_etherscan_key
EOF
```

### 3. Run Development Servers

From the project root:

```bash
pnpm dev
```

This starts all services:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

### 4. Verify Setup

#### Test Backend

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

#### Test Frontend

Open http://localhost:3000 in your browser. You should see the GlueX Yield Optimizer interface.

### 5. Smart Contract Development (Optional)

```bash
cd packages/contracts

# Install Foundry dependencies
forge install foundry-rs/forge-std --no-commit

# Build contracts
forge build

# Run tests
forge test

# Deploy (when ready)
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use:

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

Or change ports in:
- `apps/backend/src/config/env.ts` (backend port)
- Update `NEXT_PUBLIC_BACKEND_URL` in `apps/web/.env.local`

### Privy Issues

If wallet connection fails:
1. Verify your Privy App ID is correct
2. Check browser console for errors
3. Ensure you're on a supported network
4. Try clearing browser cache/cookies

### Module Not Found Errors

```bash
# Clean and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

### TypeScript Errors

```bash
# Rebuild TypeScript
pnpm build
```

## Development Workflow

### Frontend Development

```bash
cd apps/web
pnpm dev
```

Hot reload is enabled. Edit files in `apps/web/src/` and see changes instantly.

### Backend Development

```bash
cd apps/backend
pnpm dev
```

Uses `tsx watch` for hot reload. Edit files in `apps/backend/src/`.

### Contract Development

```bash
cd packages/contracts

# Watch mode for tests
forge test --watch

# Gas reports
forge test --gas-report
```

## Testing

```bash
# Test everything
pnpm test

# Test specific packages
cd packages/contracts && forge test
```

## Building for Production

```bash
# Build all packages
pnpm build

# Build specific app
cd apps/web && pnpm build
cd apps/backend && pnpm build
```

## Deployment

### Frontend (Vercel)

```bash
cd apps/web
vercel deploy --prod
```

### Backend (Railway)

1. Push to GitHub
2. Connect repo to Railway
3. Set environment variables
4. Deploy

### Contracts

```bash
cd packages/contracts
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

## Next Steps

1. Set up all environment variables
2. Run `pnpm dev` to start development
3. Connect wallet using Privy
4. Start building features!

## Useful Commands

```bash
# Clean everything
pnpm clean

# Add dependency to specific package
cd apps/web && pnpm add <package>

# Run linter
pnpm lint

# Format code
pnpm format
```

## Getting Help

- **Privy Docs**: https://docs.privy.io/
- **GlueX Docs**: https://docs.gluex.xyz/
- **Foundry Book**: https://book.getfoundry.sh/
- **Next.js Docs**: https://nextjs.org/docs
- **Turborepo Docs**: https://turbo.build/repo/docs

## Project Structure Quick Reference

```
gluex-yield-optimizer/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   └── backend/      # Express API (port 3001)
├── packages/
│   ├── contracts/    # Solidity contracts (Foundry)
│   └── shared/       # Shared TypeScript types
└── package.json      # Root package.json
```


