# OptimizerVault Contracts

Solidity smart contracts for the GlueX Yield Optimizer.

## Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install
```

## Build

```bash
forge build
```

## Test

```bash
forge test
forge test -vvv  # verbose output
```

## Deploy

### Quick Deployment

For USD₮0 token on HyperEVM:

```bash
# 1. Configure environment
cp env.example .env
# Edit .env with your PRIVATE_KEY and settings

# 2. Deploy using the helper script
./deploy.sh

# Or deploy manually:
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url hyperevm \
  --broadcast \
  -vvvv
```

See `DEPLOYMENT.md` for detailed instructions and `../DEPLOYMENT_QUICKSTART.md` for a quick start guide.

### Environment Variables

Required:
- `PRIVATE_KEY` - Deployer private key
- `ASSET_TOKEN` - Token address (default: `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` for USD₮0)
- `HYPEREVM_RPC_URL` - HyperEVM RPC endpoint

## Contracts

- **OptimizerVault.sol**: Main vault contract that manages deposits and reallocations
- **Interfaces.sol**: Interface definitions for ERC20, ERC7540, and external vaults
- **whitelist.sol**: Standalone whitelist management contract

