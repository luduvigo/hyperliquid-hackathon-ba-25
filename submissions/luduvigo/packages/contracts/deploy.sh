#!/bin/bash

# Vault Deployment Script
# Deploys OptimizerVault for USD₮0 token on HyperEVM

set -e

echo "🚀 Starting Vault Deployment..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please copy env.example to .env and configure it:"
    echo "   cp env.example .env"
    exit 1
fi

# Source environment variables
source .env

# Verify required variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$ASSET_TOKEN" ]; then
    echo "❌ Error: ASSET_TOKEN not set in .env"
    exit 1
fi

if [ -z "$HYPEREVM_RPC_URL" ]; then
    echo "❌ Error: HYPEREVM_RPC_URL not set in .env"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "   Asset Token: $ASSET_TOKEN"
echo "   RPC URL: $HYPEREVM_RPC_URL"
echo ""

# Check deployer balance
echo "💰 Checking deployer balance..."
DEPLOYER=$(cast wallet address --private-key $PRIVATE_KEY)
echo "   Deployer Address: $DEPLOYER"

BALANCE=$(cast balance $DEPLOYER --rpc-url $HYPEREVM_RPC_URL)
echo "   Balance: $BALANCE wei"
echo ""

if [ "$BALANCE" = "0" ]; then
    echo "⚠️  Warning: Deployer has 0 balance. Deployment will fail without gas."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Verify asset token exists
echo "🔍 Verifying asset token..."
TOKEN_CODE=$(cast code $ASSET_TOKEN --rpc-url $HYPEREVM_RPC_URL)
if [ "$TOKEN_CODE" = "0x" ]; then
    echo "⚠️  Warning: No code at asset token address. Is this the correct address?"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "   ✅ Asset token verified"
fi
echo ""

# Build contracts
echo "🔨 Building contracts..."
forge build
echo "   ✅ Build successful"
echo ""

# Deploy
echo "🚀 Deploying vault to HyperEVM..."
echo ""

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url hyperevm \
  --broadcast \
  -vvvv

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Save the vault address from the output above"
echo "   2. Whitelist yield-bearing pools using: cast send <VAULT> 'updateWhitelist(address,bool)' <POOL> true"
echo "   3. Update backend .env with VAULT_ADDRESS"
echo "   4. Update frontend with vault address"
echo ""

