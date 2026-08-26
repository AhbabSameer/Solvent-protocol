// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {MockV3Aggregator} from "../src/mocks/MockV3Aggregator.sol";

/// @title HelperConfig
/// @notice Supplies network-specific deploy parameters: the real Chainlink ETH/USD feed on Sepolia,
/// or a freshly deployed mock aggregator on a local Anvil chain.
contract HelperConfig is Script {
    struct NetworkConfig {
        address priceFeed;
    }

    /// @notice Sepolia ETH/USD Chainlink feed. Re-verify against
    /// https://docs.chain.link/data-feeds/price-feeds/addresses before using, since feed addresses
    /// can be redeployed.
    address public constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    uint8 public constant MOCK_FEED_DECIMALS = 8;
    int256 public constant MOCK_FEED_INITIAL_PRICE = 2000e8;

    NetworkConfig public activeNetworkConfig;

    /// @dev The deployer's signing key is never handled in contract code — pass `--account <keystore>`
    /// (or `--private-key`) to `forge script` and let Foundry supply the signer to `vm.startBroadcast()`.
    constructor() {
        if (block.chainid == 11_155_111) {
            activeNetworkConfig = getSepoliaConfig();
        } else {
            activeNetworkConfig = getOrCreateAnvilConfig();
        }
    }

    function getSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({priceFeed: SEPOLIA_ETH_USD_FEED});
    }

    function getOrCreateAnvilConfig() public returns (NetworkConfig memory) {
        if (activeNetworkConfig.priceFeed != address(0)) {
            return activeNetworkConfig;
        }

        vm.startBroadcast();
        MockV3Aggregator mockPriceFeed = new MockV3Aggregator(MOCK_FEED_DECIMALS, MOCK_FEED_INITIAL_PRICE);
        vm.stopBroadcast();

        return NetworkConfig({priceFeed: address(mockPriceFeed)});
    }
}
