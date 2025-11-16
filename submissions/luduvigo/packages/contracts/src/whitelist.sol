// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Whitelist
 * @dev Standalone whitelist contract for managing approved vaults
 */
contract Whitelist {
    address public owner;

    mapping(address => bool) public isWhitelisted;
    address[] public whitelistedAddresses;

    event AddressWhitelisted(address indexed addr, bool status);

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view {
        require(msg.sender == owner, "Not owner");
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Add address to whitelist
     * @param addr Address to whitelist
     */
    function addToWhitelist(address addr) external onlyOwner {
        require(!isWhitelisted[addr], "Already whitelisted");

        isWhitelisted[addr] = true;
        whitelistedAddresses.push(addr);

        emit AddressWhitelisted(addr, true);
    }

    /**
     * @dev Remove address from whitelist
     * @param addr Address to remove
     */
    function removeFromWhitelist(address addr) external onlyOwner {
        require(isWhitelisted[addr], "Not whitelisted");

        isWhitelisted[addr] = false;

        // Remove from array (gas inefficient but fine for hackathon)
        for (uint256 i = 0; i < whitelistedAddresses.length; i++) {
            if (whitelistedAddresses[i] == addr) {
                whitelistedAddresses[i] = whitelistedAddresses[
                    whitelistedAddresses.length - 1
                ];
                whitelistedAddresses.pop();
                break;
            }
        }

        emit AddressWhitelisted(addr, false);
    }

    /**
     * @dev Get all whitelisted addresses
     * @return Array of whitelisted addresses
     */
    function getWhitelistedAddresses()
        external
        view
        returns (address[] memory)
    {
        return whitelistedAddresses;
    }

    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
