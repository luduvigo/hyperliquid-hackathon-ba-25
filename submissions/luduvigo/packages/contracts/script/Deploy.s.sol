// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OptimizerVault} from "../src/OptimizerVault.sol";
import {Whitelist} from "../src/whitelist.sol";

/**
 * @title DeployScript
 * @dev Deployment script for OptimizerVault
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address assetToken = vm.envAddress("ASSET_TOKEN");

        console.log("=== Deployment Configuration ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Asset Token (USDT0):", assetToken);
        console.log("================================");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy whitelist contract (optional utility)
        Whitelist whitelist = new Whitelist();
        console.log("\n[1/2] Whitelist deployed at:", address(whitelist));

        // Deploy optimizer vault with whitelist DISABLED for testing
        address[] memory initialWhitelist = new address[](0);
        bool whitelistEnabled = false; // Start in permissionless mode for testing
        
        OptimizerVault vault = new OptimizerVault(assetToken, initialWhitelist, whitelistEnabled);
        console.log("[2/2] OptimizerVault deployed at:", address(vault));
        
        console.log("\n=== Deployment Summary ===");
        console.log("Asset Token:", assetToken);
        console.log("Vault Address:", address(vault));
        console.log("Whitelist Contract:", address(whitelist));
        console.log("Owner:", vault.OWNER());
        console.log("Whitelist Mode:", vault.whitelistEnabled() ? "ENABLED (restricted)" : "DISABLED (permissionless)");
        console.log("Initial Whitelisted Vaults:", initialWhitelist.length);
        console.log("\nNote: Owner can toggle whitelist mode with setWhitelistMode(bool)");
        console.log("==========================");

        vm.stopBroadcast();
    }
}
