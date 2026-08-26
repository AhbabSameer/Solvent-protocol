// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {DeploySolventEngine} from "../script/DeploySolventEngine.s.sol";
import {HelperConfig} from "../script/HelperConfig.s.sol";
import {SolventEngine} from "../src/SolventEngine.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Exercises the deploy script and HelperConfig on both the local (Anvil-mock-feed) path and
/// the Sepolia (real-feed-address) config path, so deploy plumbing has the same coverage bar as the
/// core contracts.
contract DeploySolventEngineTest is Test {
    function test_run_deploysWiredUpEngineOnLocalChain() public {
        DeploySolventEngine deployer = new DeploySolventEngine();
        (SolventEngine engine, MockERC20 collateralToken, MockERC20 borrowedToken,) = deployer.run();

        assertEq(engine.getCollateralToken(), address(collateralToken));
        assertEq(engine.getBorrowedToken(), address(borrowedToken));
        assertTrue(engine.getPriceFeed() != address(0));
        assertEq(borrowedToken.balanceOf(address(engine)), deployer.SEED_LIQUIDITY());
    }

    function test_helperConfig_returnsSepoliaFeedOnSepoliaChainId() public {
        vm.chainId(11_155_111);
        HelperConfig helperConfig = new HelperConfig();
        address priceFeed = helperConfig.activeNetworkConfig();
        assertEq(priceFeed, helperConfig.SEPOLIA_ETH_USD_FEED());
    }

    function test_helperConfig_deploysMockFeedOnLocalChain() public {
        HelperConfig helperConfig = new HelperConfig();
        address priceFeed = helperConfig.activeNetworkConfig();
        assertTrue(priceFeed != address(0));
    }
}
