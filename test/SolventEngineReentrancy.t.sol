// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {SolventEngine} from "../src/SolventEngine.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "../src/mocks/MockV3Aggregator.sol";
import {MaliciousReentrantToken} from "./mocks/MaliciousReentrantToken.sol";

/// @notice Proves the engine's nonReentrant guards hold even when the collateral token itself is
/// malicious and attempts to re-enter on transfer/transferFrom.
contract SolventEngineReentrancyTest is Test {
    MaliciousReentrantToken internal evilCollateral;
    MockERC20 internal borrowedToken;
    MockV3Aggregator internal priceFeed;
    SolventEngine internal engine;

    address internal attacker = makeAddr("attacker");

    function setUp() public {
        evilCollateral = new MaliciousReentrantToken();
        borrowedToken = new MockERC20("Solvent USD", "sUSD");
        priceFeed = new MockV3Aggregator(8, 2000e8);

        engine = new SolventEngine(address(evilCollateral), address(borrowedToken), address(priceFeed));
        evilCollateral.setEngine(address(engine));

        evilCollateral.mint(attacker, 10 ether);
        vm.prank(attacker);
        evilCollateral.approve(address(engine), type(uint256).max);
    }

    function test_depositCollateral_blocksReentrancy() public {
        evilCollateral.setAttackMode(false, true);

        vm.prank(attacker);
        vm.expectRevert(); // ReentrancyGuardReentrantCall
        engine.depositCollateral(1 ether);
    }

    function test_withdrawCollateral_blocksReentrancy() public {
        vm.prank(attacker);
        engine.depositCollateral(1 ether);

        evilCollateral.setAttackMode(true, false);

        vm.prank(attacker);
        vm.expectRevert(); // ReentrancyGuardReentrantCall
        engine.withdrawCollateral(1 ether);
    }
}
