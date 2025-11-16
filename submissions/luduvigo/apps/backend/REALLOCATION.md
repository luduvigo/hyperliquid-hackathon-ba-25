# Vault Reallocation Script

This script automatically reallocates vault funds to the pool with the highest APY.

## Features

- Queries MongoDB for latest APY data
- Calculates optimal reallocation plan
- Withdraws from current pool (if needed)
- Allocates to best performing pool
- Configurable APY threshold and liquidity buffer
- Dry-run mode for testing

## Prerequisites

1. MongoDB running with APY tracking data
2. Vault owner private key in `.env`
3. RPC URL configured

## Configuration

Add to your `.env` file:

```bash
# Required
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/gluex-yield-optimizer
VAULT_ADDRESS=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD
ASSET_TOKEN=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb
HYPEREVM_RPC_URL=https://rpc.hypurrscan.io
PRIVATE_KEY=0xyour_private_key_here

# Optional (defaults shown)
MIN_APY_DIFFERENCE=0.5          # Minimum APY improvement to trigger reallocation
LIQUIDITY_BUFFER=100            # Amount to keep idle in vault
```

## Usage

### Dry Run (Recommended First)

Test the reallocation logic without executing transactions:

```bash
pnpm reallocate:dry-run
```

This will:
- Connect to the database
- Query latest APY data
- Calculate reallocation plan
- Display what would happen
- NOT execute any transactions

### Live Reallocation

Execute actual reallocation:

```bash
pnpm reallocate
```

This will:
- Calculate optimal reallocation
- Withdraw from current pool (if allocated)
- Allocate to best pool
- Execute on-chain transactions

## Reallocation Logic

The script follows this decision tree:

1. **No Current Allocation**
   - Allocate idle funds to best pool (minus liquidity buffer)

2. **Already in Best Pool**
   - Do nothing

3. **Better Pool Available**
   - Check if APY improvement > `MIN_APY_DIFFERENCE`
   - If yes: withdraw from current, allocate to best
   - If no: do nothing (gas not worth it)

## Example Output

```bash
 Starting vault reallocation process...
   Vault: 0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD
   Asset: 0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb
   Mode: LIVE

 Vault Configuration:
   Owner: 0x1234...5678
   Asset: 0xb8ce...5ebb
   Whitelist Mode: DISABLED
   Wallet: 0x1234...5678

 Calculating reallocation plan...

 Best pool: USD₮0 Hypurr
   Address: 0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007
   APY: 7.20%

 Current allocation: 0x543d...3a0
   Amount: 1000.0
   Current APY: 5.50%
   Best APY: 7.20%
   Difference: 1.70%

 Reallocation Plan:
   Current Pool: 0x543d...3a0
   Current APY: 5.50%
   Target Pool: 0x1Ca7...3007
   Target APY: 7.20%
   Amount: 1000.0
   Should Reallocate: YES
   Reason: APY improvement: 1.70%

 Executing reallocation...
   Reason: APY improvement: 1.70%
   Target pool: 0x1Ca7...3007
   Amount: 1000.0

 Withdrawing from current pool...
   Tx hash: 0xabc...def
   ✅ Withdrawal confirmed

 Allocating to target pool...
   Tx hash: 0x123...456
   ✅ Allocation confirmed

 Reallocation completed successfully!
   New APY: 7.20%

 Done!
```

## Automation

You can automate this script using cron or a task scheduler:

### Option 1: System Cron

Add to crontab (`crontab -e`):

```bash
# Reallocate every hour
0 * * * * cd /path/to/backend && pnpm reallocate >> /var/log/reallocation.log 2>&1
```

### Option 2: Node Cron (Future Enhancement)

Add to `cronJobs.ts`:

```typescript
// Reallocation - every hour
cron.schedule("0 * * * *", async () => {
  await reallocateVault(false);
});
```

## Safety Features

1. **Ownership Check**: Only vault owner can execute
2. **APY Threshold**: Won't reallocate for small improvements
3. **Liquidity Buffer**: Keeps some funds idle for withdrawals
4. **Dry Run Mode**: Test before executing
5. **Error Handling**: Graceful failure with detailed logs

## Troubleshooting

### "Wallet is not the vault owner"
- Ensure `PRIVATE_KEY` matches vault owner address

### "No APY data available"
- Ensure MongoDB is running and APY tracking cron is active

### "APY difference below threshold"
- This is normal - reallocation not worth gas costs
- Adjust `MIN_APY_DIFFERENCE` if needed

### Transaction fails
- Check gas balance on owner account
- Verify RPC URL is working
- Check if whitelist mode requires pool to be whitelisted

## Manual Reallocation via Cast

If you prefer to use Foundry's `cast`:

```bash
# Check current best APY
curl http://localhost:3001/api/apy/latest

# Reallocate to specific pool
cast send $VAULT_ADDRESS \
  "reallocate(address,uint256)" \
  0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007 \
  1000000000000000000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url $HYPEREVM_RPC_URL
```

