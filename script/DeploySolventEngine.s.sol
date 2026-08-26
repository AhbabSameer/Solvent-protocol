// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {SolventEngine} from "../src/SolventEngine.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

/// @title DeploySolventEngine
/// @notice Deploys the mock collateral/borrow tokens, wires up a price feed via HelperConfig
/// (real Sepolia ETH/USD feed on Sepolia, a fresh mock aggregator on Anvil), deploys the engine,
/// and seeds it with borrow-token liquidity so the first `borrow()` call has something to draw from.
/// @dev v1 has no lender-supply function (see SPEC.md §5) — the borrow asset is a mock with open
/// minting, so liquidity is seeded directly here rather than sourced from depositors.
contract DeploySolventEngine is Script {
    uint256 public constant SEED_LIQUIDITY = 1_000_000 ether;

    function run() external returns (SolventEngine, MockERC20, MockERC20, HelperConfig) {
        HelperConfig helperConfig = new HelperConfig();
        address priceFeed = helperConfig.activeNetworkConfig();

        vm.startBroadcast();

        MockERC20 collateralToken = new MockERC20("Solvent Collateral", "sCOL");
        MockERC20 borrowedToken = new MockERC20("Solvent USD", "sUSD");

        SolventEngine engine = new SolventEngine(address(collateralToken), address(borrowedToken), priceFeed);

        borrowedToken.mint(address(engine), SEED_LIQUIDITY);

        vm.stopBroadcast();

        return (engine, collateralToken, borrowedToken, helperConfig);
    }
}
