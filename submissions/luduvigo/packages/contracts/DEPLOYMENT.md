# Vault Deployment Guide

This guide walks you through deploying the OptimizerVault contract for USD₮0 token on HyperEVM.

## Prerequisites

1. **Foundry installed** (forge, cast, anvil)
2. **Private key** with HyperEVM native tokens for gas
3. **USD₮0 token** address: `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb`

## Step 1: Setup Environment

Create a `.env` file in the `packages/contracts` directory:

```bash
cd packages/contracts
cp .env.example .env
```

Edit `.env` with your values:

```env
# Your deployer private key (needs HyperEVM native tokens for gas)
PRIVATE_KEY=0x1234567890abcdef...

# USD₮0 token address on HyperEVM
ASSET_TOKEN=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb

# HyperEVM RPC URL
HYPEREVM_RPC_URL=https://api.hyperliquid.xyz/evm
```

## Step 2: Verify Environment

Check your setup:

```bash
# Load environment variables
source .env

# Check your balance on HyperEVM
cast balance $YOUR_ADDRESS --rpc-url $HYPEREVM_RPC_URL

# Verify the asset token exists
cast code $ASSET_TOKEN --rpc-url $HYPEREVM_RPC_URL
```

## Step 3: Deploy the Vault

Run the deployment script:

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url hyperevm \
  --broadcast \
  --verify \
  -vvvv
```

Or without verification:

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url hyperevm \
  --broadcast \
  -vvvv
```

## Step 4: Save Deployment Addresses

After successful deployment, save the output:

```
[1/2] Whitelist deployed at: 0x...
[2/2] OptimizerVault deployed at: 0x...
```

Create a deployment record:

```bash
echo "VAULT_ADDRESS=0x..." >> deployments.txt
echo "WHITELIST_ADDRESS=0x..." >> deployments.txt
echo "DEPLOYED_AT=$(date)" >> deployments.txt
```

## Step 5: Whitelist Pools (Optional)

Add yield-bearing pools that the vault can allocate to:

```bash
# Example: Whitelist the USD₮0 Hypurr pool
cast send $VAULT_ADDRESS \
  "updateWhitelist(address,bool)" \
  0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007 \
  true \
  --rpc-url hyperevm \
  --private-key $PRIVATE_KEY

# Example: Whitelist the Felix USD₮0 pool
cast send $VAULT_ADDRESS \
  "updateWhitelist(address,bool)" \
  0xfc5126377f0efc0041c0969ef9ba903ce67d151e \
  true \
  --rpc-url hyperevm \
  --private-key $PRIVATE_KEY
```

## Step 6: Verify Deployment

Check the vault configuration:

```bash
# Check owner
cast call $VAULT_ADDRESS "owner()" --rpc-url hyperevm

# Check asset token
cast call $VAULT_ADDRESS "asset()" --rpc-url hyperevm

# Check total assets
cast call $VAULT_ADDRESS "totalAssets()" --rpc-url hyperevm

# Check whitelisted vaults count
cast call $VAULT_ADDRESS "getWhitelistedVaultsCount()" --rpc-url hyperevm
```

## Step 7: Update Backend Configuration

Update your backend with the vault address:

```bash
# In apps/backend/.env
echo "VAULT_ADDRESS=0x..." >> apps/backend/.env
echo "VAULT_CHAIN=hyperevm" >> apps/backend/.env
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Deployer has sufficient gas tokens
- [ ] Asset token address verified
- [ ] Vault contract deployed
- [ ] Whitelist contract deployed
- [ ] Pools whitelisted (if applicable)
- [ ] Deployment addresses saved
- [ ] Backend configuration updated
- [ ] Frontend configuration updated

## Useful Commands

### Read Vault State

```bash
# Get user shares
cast call $VAULT_ADDRESS "userShares(address)" $USER_ADDRESS --rpc-url hyperevm

# Get total shares
cast call $VAULT_ADDRESS "totalShares()" --rpc-url hyperevm

# Get user balance
cast call $VAULT_ADDRESS "balanceOf(address)" $USER_ADDRESS --rpc-url hyperevm

# Check if vault is whitelisted
cast call $VAULT_ADDRESS "isWhitelisted(address)" $POOL_ADDRESS --rpc-url hyperevm
```

### Interact with Vault

```bash
# Approve vault to spend tokens
cast send $ASSET_TOKEN \
  "approve(address,uint256)" \
  $VAULT_ADDRESS \
  1000000000000000000 \
  --rpc-url hyperevm \
  --private-key $PRIVATE_KEY

# Deposit into vault
cast send $VAULT_ADDRESS \
  "deposit(uint256)" \
  1000000000000000000 \
  --rpc-url hyperevm \
  --private-key $PRIVATE_KEY

# Withdraw from vault
cast send $VAULT_ADDRESS \
  "withdraw(uint256)" \
  1000000000000000000 \
  --rpc-url hyperevm \
  --private-key $PRIVATE_KEY
```

## Troubleshooting

### Insufficient Gas
```bash
# Check your balance
cast balance $YOUR_ADDRESS --rpc-url $HYPEREVM_RPC_URL
```


## Security Notes

1. Never commit `.env` file with real private keys
2. Store deployment addresses securely
3. Test thoroughly before mainnet deployment
4. Consider using a multisig for the owner role in production
5. Audit contracts before significant TVL

## Next Steps

After deployment:
1. Test deposits and withdrawals
2. Configure automatic rebalancing in backend
3. Update frontend with vault address
4. Monitor vault performance
5. Set up monitoring and alerts

