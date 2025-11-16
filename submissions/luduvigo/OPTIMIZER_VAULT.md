# OptimizerVault Contract - Complete Logic Documentation

## Overview

The `OptimizerVault` is a yield optimization smart contract that aggregates user deposits and automatically allocates them to the highest-yielding pools on HyperEVM. It implements a share-based accounting system where users receive shares proportional to their deposits and can withdraw their proportional share of total assets (including earned yield) at any time.

## Deployed Contract

**Contract Address**: `0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD`

**Block Explorer**: [View on Hyperscan](https://www.hyperscan.com/address/0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD)

**Network**: HyperEVM (Chain ID: 999)

**Asset Token**: `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` (USD₮0) - [View on Hyperscan](https://www.hyperscan.com/address/0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb)

## Core Concepts

### 1. Share-Based Accounting

The vault uses a **share-based system** similar to ERC-4626:

- **Shares**: Internal accounting units representing ownership in the vault
- **Assets**: The actual token amount (USD₮0) that shares represent
- **Exchange Rate**: `assets = (shares * totalAssets()) / totalShares`

**Key Properties:**
- First depositor gets 1:1 shares (if `totalShares == 0`, `shares = assets`)
- Subsequent depositors get shares proportional to current vault value
- Users always receive their proportional share of total assets when withdrawing

### 2. Asset Management

The vault manages assets in two states:

1. **Idle Balance**: Assets held directly in the vault contract (not yet allocated)
2. **Allocated Funds**: Assets deposited into external yield pools

**Total Assets Formula:**
```solidity
totalAssets() = idleBalance + sum(all vaultAllocations)
```

### 3. Whitelist Mode Toggle

The vault can operate in two modes:

- **Whitelist Mode (Enabled)**: Only whitelisted pools can receive allocations
- **Permissionless Mode (Disabled)**: Owner can allocate to any pool address

This provides flexibility for testing (permissionless) and production security (whitelist).

## State Variables

```solidity
address public immutable OWNER;              // Contract owner (deployer)
address public immutable ASSET;              // Base asset token (USD₮0)
bool public whitelistEnabled;                // Whitelist mode toggle
address[] public whitelistedVaults;          // List of whitelisted pool addresses
mapping(address => bool) public isWhitelisted; // Quick whitelist lookup
mapping(address => uint256) public vaultAllocations; // Amount allocated per pool
mapping(address => uint256) public userShares; // Shares per user
uint256 public totalShares;                  // Total shares in circulation
```

## Core Functions

### Deposit (`deposit(uint256 assets)`)

**Purpose**: Allows users to deposit assets and receive shares.

**Logic Flow:**
1. Validates `assets > 0`
2. Transfers assets from user to vault using `transferFrom`
3. Calculates shares:
   - If first deposit (`totalShares == 0`): `shares = assets` (1:1)
   - Otherwise: `shares = (assets * totalShares) / totalAssets()`
4. Updates user's shares and total shares
5. Emits `Deposit` event

**Key Behavior:**
- Shares are calculated based on current vault value
- If vault has earned yield, new depositors get fewer shares per asset
- Existing depositors benefit from yield as their share value increases

**Example:**
```
Initial state: 100 assets, 100 shares (1:1)
Vault earns yield: 110 assets, 100 shares (1.1:1)
New deposit: 10 assets
Shares received: (10 * 100) / 110 = 9.09 shares
New state: 120 assets, 109.09 shares
```

### Withdraw (`withdraw(uint256 shares)`)

**Purpose**: Allows users to redeem shares for their proportional assets.

**Logic Flow:**
1. Validates `shares > 0` and user has sufficient shares
2. Calculates assets: `assets = (shares * totalAssets()) / totalShares`
3. Deducts shares from user and total
4. Transfers assets to user
5. Emits `Withdraw` event

**Key Behavior:**
- Users receive their proportional share of **total assets** (including yield)
- If vault has earned yield, users get more assets per share than they deposited
- Withdrawals can come from idle balance or trigger pool withdrawals (handled by owner)

**Example:**
```
User deposited: 10 assets, received 9.09 shares
Vault value increased: 120 assets, 109.09 shares
User withdraws: 9.09 shares
Assets received: (9.09 * 120) / 109.09 = 10.00 assets (break even)
If vault earned more yield: User gets more than deposited!
```

### Reallocate (`reallocate(address vault, uint256 amount)`)

**Purpose**: Owner-only function to allocate idle funds to a yield pool.

**Logic Flow:**
1. Validates vault address and amount
2. If `whitelistEnabled == true`, checks if vault is whitelisted
3. Approves the pool to spend assets
4. Calls `IVault(vault).deposit(amount, address(this))` to deposit into pool
5. Updates `vaultAllocations[vault] += amount`
6. Emits `Rebalance` event

**Key Behavior:**
- Only owner can call (protected by `onlyOwner` modifier)
- Funds move from idle balance to allocated state
- Tracks allocation per pool in `vaultAllocations` mapping
- Works with any pool if whitelist is disabled

**Security:**
- Whitelist check only applies if `whitelistEnabled == true`
- Owner must trust the pool contract (no reentrancy protection in this version)

### Withdraw From Vault (`withdrawFromVault(address vault, uint256 amount)`)

**Purpose**: Owner-only function to withdraw funds from a pool back to vault.

**Logic Flow:**
1. Validates sufficient allocation exists for the vault
2. If `whitelistEnabled == true`, checks if vault is whitelisted
3. Calls `IVault(vault).withdraw(amount, address(this), address(this))`
4. Updates `vaultAllocations[vault] -= amount`
5. Emits `Rebalance` event

**Key Behavior:**
- Funds move from allocated state back to idle balance
- Used for rebalancing between pools or handling withdrawals
- Only owner can call

### Whitelist Management

#### Update Whitelist (`updateWhitelist(address vault, bool allowed)`)

**Purpose**: Add or remove pools from whitelist.

**Logic:**
- If `allowed == true` and not already whitelisted: adds to array and mapping
- If `allowed == false` and whitelisted: removes from array (gas-inefficient but acceptable for hackathon)

#### Set Whitelist Mode (`setWhitelistMode(bool enabled)`)

**Purpose**: Toggle between whitelist and permissionless mode.

**Behavior:**
- `enabled == true`: Only whitelisted pools can receive allocations
- `enabled == false`: Any pool address can receive allocations

## View Functions

### `totalAssets()`

**Returns**: Total assets under management (idle + allocated)

**Calculation:**
```solidity
uint256 idle = IERC20(ASSET).balanceOf(address(this));
uint256 allocated = sum of all vaultAllocations[vault] for whitelisted vaults
return idle + allocated;
```

**Note**: Currently only sums allocations for whitelisted vaults. In permissionless mode, this may not capture all allocations if pools aren't whitelisted.

### `balanceOf(address user)`

**Returns**: User's asset balance (their share of total assets)

**Calculation:**
```solidity
if (totalShares == 0) return 0;
return (userShares[user] * totalAssets()) / totalShares;
```

### `getWhitelistedVaultsCount()`

**Returns**: Number of whitelisted pools

## Security Model

### Access Control

- **Owner-Only Functions**: `reallocate()`, `withdrawFromVault()`, `updateWhitelist()`, `setWhitelistMode()`
- **Public Functions**: `deposit()`, `withdraw()`, all view functions
- **Immutable Variables**: `OWNER`, `ASSET` (cannot be changed after deployment)

### Trust Assumptions

1. **Pool Contracts**: Owner must trust external pool contracts (GlueX, Hypurr, etc.)
2. **Asset Token**: Must be a standard ERC20 token
3. **Owner Key**: Owner private key security is critical

### Limitations

1. **No Reentrancy Protection**: Current implementation doesn't use ReentrancyGuard
2. **Gas Inefficient Whitelist Removal**: Linear search through array
3. **No Slippage Protection**: Deposits/withdrawals don't check minimum amounts
4. **Single Asset**: Only supports one asset token per vault

## Events

```solidity
event Deposit(address indexed user, uint256 assets, uint256 shares);
event Withdraw(address indexed user, uint256 shares, uint256 assets);
event Rebalance(address indexed vault, uint256 amount);
event WhitelistUpdated(address indexed vault, bool allowed);
event WhitelistModeChanged(bool enabled);
```

## Deployment

### Constructor Parameters

```solidity
constructor(
    address _asset,              // Asset token address (USD₮0)
    address[] memory _whitelist, // Initial whitelist (can be empty)
    bool _whitelistEnabled       // Initial whitelist mode
)
```

### Deployment Steps

#### 1. Configure Environment

```bash
cd packages/contracts
cp env.example .env
```

Edit `.env`:
```env
PRIVATE_KEY=0xYourPrivateKeyHere
ASSET_TOKEN=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb  # USD₮0 on HyperEVM
HYPEREVM_RPC_URL=https://api.hyperliquid.xyz/evm
```

#### 2. Deploy Vault

```bash
./deploy.sh
```

Or manually:
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url hyperevm \
  --broadcast \
  -vvvv
```

#### 3. Post-Deployment Configuration

**Update Backend:**
```bash
cd ../../apps/backend
echo "VAULT_ADDRESS=0xYourVaultAddress" >> .env
echo "ASSET_TOKEN=0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb" >> .env
```

**Update Frontend:**
Create `apps/web/src/config/contracts.ts`:
```typescript
export const VAULT_ADDRESS = "0xYourVaultAddress";
export const ASSET_TOKEN = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";
```

#### 4. Whitelist Pools (if using whitelist mode)

```bash
VAULT=0xYourVaultAddress

# Whitelist a pool
cast send $VAULT \
  "updateWhitelist(address,bool)" \
  0xPoolAddress \
  true \
  --rpc-url hyperevm \
  --private-key $PRIVATE_KEY
```

### Verification Commands

```bash
# Example: Using the deployed contract address
VAULT=0x7F0d2c1a50FE32Bc17781c96DddC35621B0339AD

# Check owner
cast call $VAULT "owner()" --rpc-url hyperevm

# Check asset token
cast call $VAULT "asset()" --rpc-url hyperevm

# Check total assets
cast call $VAULT "totalAssets()" --rpc-url hyperevm

# Check whitelist mode
cast call $VAULT "whitelistEnabled()" --rpc-url hyperevm

# Check whitelisted pools count
cast call $VAULT "getWhitelistedVaultsCount()" --rpc-url hyperevm
```

## Usage Examples

### User Deposits

```bash
# 1. Approve vault to spend tokens
cast send $ASSET_TOKEN \
  "approve(address,uint256)" \
  $VAULT \
  1000000 \
  --rpc-url hyperevm \
  --private-key $USER_PRIVATE_KEY

# 2. Deposit (1 USD₮0 = 1000000 if 6 decimals)
cast send $VAULT \
  "deposit(uint256)" \
  1000000 \
  --rpc-url hyperevm \
  --private-key $USER_PRIVATE_KEY
```

### Owner Allocates to Pool

```bash
# Allocate 100 USD₮0 to a pool
cast send $VAULT \
  "reallocate(address,uint256)" \
  0xPoolAddress \
  100000000 \
  --rpc-url hyperevm \
  --private-key $OWNER_PRIVATE_KEY
```

### Owner Withdraws from Pool

```bash
# Withdraw 50 USD₮0 from a pool
cast send $VAULT \
  "withdrawFromVault(address,uint256)" \
  0xPoolAddress \
  50000000 \
  --rpc-url hyperevm \
  --private-key $OWNER_PRIVATE_KEY
```

### User Withdraws

```bash
# Check balance first
cast call $VAULT "balanceOf(address)" $USER_ADDRESS --rpc-url hyperevm

# Withdraw shares (example: 1000000 shares)
cast send $VAULT \
  "withdraw(uint256)" \
  1000000 \
  --rpc-url hyperevm \
  --private-key $USER_PRIVATE_KEY
```

## Integration with Backend Automation

The backend automation system (`apps/backend/src/services/vaultAutomation.ts`) periodically:

1. **Fetches Latest APY Data**: Gets current yields from all tracked pools
2. **Calculates Best Pool**: Determines pool with highest opportunity score/APY
3. **Checks Current Allocations**: Reads `vaultAllocations` mapping
4. **Decides Action**:
   - If better pool found: Withdraws from current pools, deposits to best pool
   - If idle funds exist: Deposits idle funds to best pool
   - Otherwise: No action needed
5. **Executes Reallocation**: Calls `reallocate()` or `withdrawFromVault()` as needed

## Architecture Diagram

```
┌─────────────────┐
│   Users         │
│  (Depositors)   │
└────────┬────────┘
         │ deposit(assets)
         │ withdraw(shares)
         ▼
┌─────────────────┐
│ OptimizerVault   │
│                 │
│ • userShares    │
│ • totalShares   │
│ • idleBalance   │
│ • allocations   │
└────────┬────────┘
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
```

## Key Design Decisions

1. **Share-Based System**: Enables proportional ownership and automatic yield distribution
2. **Owner-Controlled Allocation**: Centralized control for optimization, users can't directly choose pools
3. **Whitelist Toggle**: Flexibility between security (whitelist) and agility (permissionless)
4. **Simple Accounting**: Tracks allocations per pool for transparency
5. **No Fees**: Current implementation doesn't charge fees (can be added later)

## Future Enhancements

Potential improvements for production:

1. **ReentrancyGuard**: Add protection against reentrancy attacks
2. **Slippage Protection**: Add minimum amount checks for deposits/withdrawals
3. **Fee Mechanism**: Owner fee on yield earned
4. **Multi-Asset Support**: Support multiple asset tokens
5. **Emergency Pause**: Add pause functionality for security
6. **Gas Optimization**: Improve whitelist removal efficiency
7. **Access Control**: Add role-based access (not just owner)
8. **Better Allocation Tracking**: Track all allocations, not just whitelisted ones

---

**Contract Location**: `packages/contracts/src/OptimizerVault.sol`  
**Interfaces**: `packages/contracts/src/Interfaces.sol`  
**Tests**: `packages/contracts/test/OptimizerVault.t.sol`

