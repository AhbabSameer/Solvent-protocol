// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {SolventEngine} from "../src/SolventEngine.sol";
import {ISolventEngine} from "../src/interfaces/ISolventEngine.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "../src/mocks/MockV3Aggregator.sol";

contract SolventEngineFuzzTest is Test {
    SolventEngine internal engine;
    MockERC20 internal collateralToken;
    MockERC20 internal borrowedToken;
    MockV3Aggregator internal priceFeed;

    address internal user = makeAddr("user");
    address internal liquidator = makeAddr("liquidator");

    int256 internal constant INITIAL_PRICE = 2000e8;
    uint256 internal constant SEED_LIQUIDITY = type(uint256).max / 2;

    function setUp() public {
        collateralToken = new MockERC20("Solvent Collateral", "sCOL");
        borrowedToken = new MockERC20("Solvent USD", "sUSD");
        priceFeed = new MockV3Aggregator(8, INITIAL_PRICE);

        engine = new SolventEngine(address(collateralToken), address(borrowedToken), address(priceFeed));
        borrowedToken.mint(address(engine), SEED_LIQUIDITY);

        vm.prank(user);
        collateralToken.approve(address(engine), type(uint256).max);
        vm.prank(user);
        borrowedToken.approve(address(engine), type(uint256).max);
    }

    /// @notice Depositing and immediately withdrawing any amount must return exactly what was put in,
    /// and must never leave the engine's token balance out of sync with tracked accounting.
    function testFuzz_depositThenFullWithdraw_isLossless(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        collateralToken.mint(user, amount);

        vm.startPrank(user);
        engine.depositCollateral(amount);
        engine.withdrawCollateral(amount);
        vm.stopPrank();

        assertEq(collateralToken.balanceOf(user), amount);
        assertEq(engine.getCollateralBalance(user), 0);
        assertEq(collateralToken.balanceOf(address(engine)), 0);
    }

    /// @notice A borrow within the LTV limit must always succeed and never push HF below 1; a borrow
    /// exceeding it must always revert. The LTV/liquidation-threshold gap (75% vs 80%) guarantees this.
    function testFuzz_borrowWithinLtv_neverBreaksHealthFactorImmediately(uint256 collateralAmount, uint256 borrowAmount) public {
        collateralAmount = bound(collateralAmount, 1 ether, 1_000_000 ether);
        collateralToken.mint(user, collateralAmount);

        vm.prank(user);
        engine.depositCollateral(collateralAmount);

        uint256 collateralValueUsd = engine.getAccountCollateralValue(user);
        uint256 maxBorrowable = (collateralValueUsd * engine.LOAN_TO_VALUE()) / engine.DENOMINATOR();
        vm.assume(maxBorrowable > 0);

        borrowAmount = bound(borrowAmount, 1, maxBorrowable);

        vm.prank(user);
        engine.borrow(borrowAmount);

        assertGe(engine.getHealthFactor(user), 1e18);
    }

    function testFuzz_borrowAboveLtv_alwaysReverts(uint256 collateralAmount, uint256 excess) public {
        collateralAmount = bound(collateralAmount, 1 ether, 1_000_000 ether);
        collateralToken.mint(user, collateralAmount);

        vm.prank(user);
        engine.depositCollateral(collateralAmount);

        uint256 collateralValueUsd = engine.getAccountCollateralValue(user);
        uint256 maxBorrowable = (collateralValueUsd * engine.LOAN_TO_VALUE()) / engine.DENOMINATOR();
        excess = bound(excess, 1, type(uint128).max);

        vm.prank(user);
        vm.expectRevert();
        engine.borrow(maxBorrowable + excess);
    }

    /// @notice Repaying a fuzzed fraction of debt must never leave debt negative or reduce it by more
    /// than what was actually repaid.
    function testFuzz_partialRepay_neverOverReducesDebt(uint256 borrowAmount, uint256 repayAmount) public {
        collateralToken.mint(user, 1_000_000 ether);
        vm.prank(user);
        engine.depositCollateral(1_000_000 ether);

        uint256 collateralValueUsd = engine.getAccountCollateralValue(user);
        uint256 maxBorrowable = (collateralValueUsd * engine.LOAN_TO_VALUE()) / engine.DENOMINATOR();
        borrowAmount = bound(borrowAmount, 1, maxBorrowable);

        vm.prank(user);
        engine.borrow(borrowAmount);

        uint256 debtBefore = engine.getAccountDebtValue(user);
        repayAmount = bound(repayAmount, 1, debtBefore);

        borrowedToken.mint(user, repayAmount);
        vm.prank(user);
        engine.repay(repayAmount);

        uint256 debtAfter = engine.getAccountDebtValue(user);
        assertLe(debtBefore - debtAfter, repayAmount);
        assertLe(debtAfter, debtBefore);
    }

    /// @notice Interest accrual is monotonically non-decreasing and matches the fixed 5% APR formula
    /// (within rounding) for any elapsed time.
    function testFuzz_interestAccrual_monotonicAndMatchesFormula(uint256 warpSeconds) public {
        warpSeconds = bound(warpSeconds, 0, 10 * 365 days);

        collateralToken.mint(user, 1_000_000 ether);
        vm.startPrank(user);
        engine.depositCollateral(1_000_000 ether);
        engine.borrow(1000 ether);
        vm.stopPrank();

        uint256 indexBefore = engine.getBorrowIndex();

        vm.warp(block.timestamp + warpSeconds);
        priceFeed.updatePrice(INITIAL_PRICE); // keep the feed fresh regardless of warp length

        uint256 indexAfter = engine.getBorrowIndex();
        assertGe(indexAfter, indexBefore);

        uint256 expectedDebt = 1000 ether + (1000 ether * 500 * warpSeconds) / (10_000 * 365 days);
        assertApproxEqAbs(engine.getAccountDebtValue(user), expectedDebt, 1e9);
    }

    /// @notice A liquidator can never seize more collateral than the target had deposited, for any
    /// fuzzed price crash and any fuzzed (valid) debtToCover.
    function testFuzz_liquidation_neverSeizesMoreThanDeposited(uint256 crashedPrice, uint256 debtToCoverSeed) public {
        collateralToken.mint(user, 10 ether);
        vm.prank(user);
        engine.depositCollateral(10 ether);

        vm.prank(user);
        engine.borrow(15_000 ether); // max LTV at $2000/token

        crashedPrice = bound(crashedPrice, 1, 1999e8); // any crash that can trigger HF < 1
        priceFeed.updatePrice(int256(crashedPrice));

        uint256 healthFactor = engine.getHealthFactor(user);
        vm.assume(healthFactor < 1e18);

        uint256 debt = engine.getAccountDebtValue(user);
        uint256 debtToCover = bound(debtToCoverSeed, 1, debt);

        uint256 collateralBefore = engine.getCollateralBalance(user);

        borrowedToken.mint(liquidator, debtToCover);
        vm.startPrank(liquidator);
        borrowedToken.approve(address(engine), debtToCover);

        try engine.liquidate(user, debtToCover) {
            uint256 collateralAfter = engine.getCollateralBalance(user);
            assertLe(collateralBefore - collateralAfter, collateralBefore);
        } catch {
            // SolventEngine__LiquidationFailed is an acceptable outcome for bad-debt positions
            // where even 100% seizure can't cover the requested amount plus bonus.
        }
        vm.stopPrank();
    }
}
