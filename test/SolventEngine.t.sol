// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {SolventEngine} from "../src/SolventEngine.sol";
import {ISolventEngine} from "../src/interfaces/ISolventEngine.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "../src/mocks/MockV3Aggregator.sol";

contract SolventEngineTest is Test {
    SolventEngine internal engine;
    MockERC20 internal collateralToken;
    MockERC20 internal borrowedToken;
    MockV3Aggregator internal priceFeed;

    address internal user = makeAddr("user");
    address internal liquidator = makeAddr("liquidator");

    uint8 internal constant FEED_DECIMALS = 8;
    int256 internal constant INITIAL_PRICE = 2000e8; // $2000 per collateral token
    uint256 internal constant SEED_LIQUIDITY = 1_000_000 ether;
    uint256 internal constant COLLATERAL_AMOUNT = 10 ether; // $20,000 at initial price

    function setUp() public {
        collateralToken = new MockERC20("Solvent Collateral", "sCOL");
        borrowedToken = new MockERC20("Solvent USD", "sUSD");
        priceFeed = new MockV3Aggregator(FEED_DECIMALS, INITIAL_PRICE);

        engine = new SolventEngine(address(collateralToken), address(borrowedToken), address(priceFeed));

        borrowedToken.mint(address(engine), SEED_LIQUIDITY);

        collateralToken.mint(user, COLLATERAL_AMOUNT);
        vm.prank(user);
        collateralToken.approve(address(engine), type(uint256).max);
    }

    function _depositCollateral() internal {
        vm.prank(user);
        engine.depositCollateral(COLLATERAL_AMOUNT);
    }

    ////////////////////////////
    ///// DEPOSIT
    ///////////////////////////

    function test_depositCollateral_creditsBalanceAndPullsTokens() public {
        _depositCollateral();

        assertEq(engine.getCollateralBalance(user), COLLATERAL_AMOUNT);
        assertEq(collateralToken.balanceOf(address(engine)), COLLATERAL_AMOUNT);
        assertEq(collateralToken.balanceOf(user), 0);
    }

    function test_depositCollateral_revertsOnZero() public {
        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__NeedsMoreThanZero.selector);
        engine.depositCollateral(0);
    }

    ////////////////////////////
    ///// WITHDRAW
    ///////////////////////////

    function test_withdrawCollateral_returnsTokens() public {
        _depositCollateral();

        vm.prank(user);
        engine.withdrawCollateral(COLLATERAL_AMOUNT);

        assertEq(engine.getCollateralBalance(user), 0);
        assertEq(collateralToken.balanceOf(user), COLLATERAL_AMOUNT);
    }

    function test_withdrawCollateral_revertsIfExceedsBalance() public {
        _depositCollateral();

        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__InsufficientCollateral.selector);
        engine.withdrawCollateral(COLLATERAL_AMOUNT + 1);
    }

    function test_withdrawCollateral_revertsIfBreaksHealthFactor() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(10_000 ether); // 50% of $20,000 collateral value

        vm.prank(user);
        vm.expectRevert(); // custom error carries a dynamic healthFactor arg
        engine.withdrawCollateral(COLLATERAL_AMOUNT);
    }

    ////////////////////////////
    ///// BORROW
    ///////////////////////////

    function test_borrow_transfersTokensAndTracksDebt() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(1000 ether);

        assertEq(borrowedToken.balanceOf(user), 1000 ether);
        assertEq(engine.getAccountDebtValue(user), 1000 ether);
    }

    function test_borrow_revertsIfExceedsLoanToValue() public {
        _depositCollateral();

        // Collateral value is $20,000; max borrowable at 75% LTV is $15,000.
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ISolventEngine.SolventEngine__ExceedsLoanToValue.selector, 15_001 ether, 15_000 ether));
        engine.borrow(15_001 ether);
    }

    function test_borrow_atExactlyMaxLtvSucceeds() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether);

        assertEq(engine.getAccountDebtValue(user), 15_000 ether);
    }

    ////////////////////////////
    ///// REPAY
    ///////////////////////////

    function test_repay_reducesDebtAndPullsTokens() public {
        _depositCollateral();

        vm.startPrank(user);
        engine.borrow(1000 ether);
        borrowedToken.approve(address(engine), type(uint256).max);
        engine.repay(1000 ether);
        vm.stopPrank();

        assertEq(engine.getAccountDebtValue(user), 0);
        assertEq(borrowedToken.balanceOf(user), 0);
    }

    function test_repay_revertsIfExceedsDebt() public {
        _depositCollateral();

        vm.startPrank(user);
        engine.borrow(1000 ether);
        borrowedToken.approve(address(engine), type(uint256).max);
        vm.expectRevert(ISolventEngine.SolventEngine__RepayExceedsDebt.selector);
        engine.repay(1001 ether);
        vm.stopPrank();
    }

    function test_interestAccruesOverTime() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(1000 ether);

        vm.warp(block.timestamp + 365 days);

        // 5% APR on 1000 => 1050 after one year.
        assertApproxEqAbs(engine.getAccountDebtValue(user), 1050 ether, 1e12);
    }

    ////////////////////////////
    ///// HEALTH FACTOR
    ///////////////////////////

    function test_healthFactor_isMaxWithNoDebt() public {
        _depositCollateral();
        assertEq(engine.getHealthFactor(user), type(uint256).max);
    }

    function test_healthFactor_dropsBelowOneOnPriceCrash() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether); // max LTV borrow

        // Health factor at max LTV: (20000 * 0.8) / 15000 = 1.0667 > 1
        assertGt(engine.getHealthFactor(user), 1e18);

        priceFeed.updatePrice(1000e8); // collateral value halves to $10,000

        // New health factor: (10000 * 0.8) / 15000 = 0.533 < 1
        assertLt(engine.getHealthFactor(user), 1e18);
    }

    ////////////////////////////
    ///// LIQUIDATE
    ///////////////////////////

    function test_liquidate_revertsIfHealthFactorOk() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(1000 ether);

        vm.prank(liquidator);
        vm.expectRevert(ISolventEngine.SolventEngine__HealthFactorOk.selector);
        engine.liquidate(user, 100 ether);
    }

    function test_liquidate_paysDownDebtAndSeizesCollateralWithBonus() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether); // max LTV borrow at $2000/token

        priceFeed.updatePrice(1000e8); // crash collateral price, HF < 1

        uint256 debtToCover = 1000 ether;
        borrowedToken.mint(liquidator, debtToCover);

        vm.startPrank(liquidator);
        borrowedToken.approve(address(engine), debtToCover);
        engine.liquidate(user, debtToCover);
        vm.stopPrank();

        // At $1000/token: 1000 USD of debt = 1 collateral token, + 10% bonus = 1.1 tokens.
        assertEq(collateralToken.balanceOf(liquidator), 1.1 ether);
        assertEq(engine.getAccountDebtValue(user), 14_000 ether);
        assertEq(engine.getCollateralBalance(user), COLLATERAL_AMOUNT - 1.1 ether);
    }

    function test_liquidate_revertsIfDebtToCoverExceedsUserDebt() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether);

        priceFeed.updatePrice(1000e8);

        borrowedToken.mint(liquidator, 20_000 ether);
        vm.startPrank(liquidator);
        borrowedToken.approve(address(engine), type(uint256).max);
        vm.expectRevert(ISolventEngine.SolventEngine__DebtToCoverExceedsUserDebt.selector);
        engine.liquidate(user, 15_001 ether);
        vm.stopPrank();
    }

    function test_liquidate_revertsIfHealthFactorExactlyOne() public {
        // Borrow exactly to the liquidation threshold: HF == 1e18 must be treated as healthy ("below
        // 1 is liquidatable" per spec — not "at or below").
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether);

        // HF = (collateralValue * 8000) / (10000 * debtValue) = 1e18
        // => collateralValue = debtValue * 10000 / 8000 = 15000 * 1.25 = 18750
        // Current collateral value is 20000 (price 2000, amount 10) — drop price so value = 18750.
        priceFeed.updatePrice(1875e8);
        assertEq(engine.getHealthFactor(user), 1e18);

        vm.prank(liquidator);
        vm.expectRevert(ISolventEngine.SolventEngine__HealthFactorOk.selector);
        engine.liquidate(user, 100 ether);
    }

    function test_liquidate_fullDebtRepayment() public {
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether);

        // Crash the price just enough to break HF (< 1.25x debt) while leaving enough collateral
        // value (>= 1.1x debt) to fully cover the debt plus bonus: $17,500 for $15,000 debt.
        priceFeed.updatePrice(1750e8);

        uint256 fullDebt = engine.getAccountDebtValue(user);
        borrowedToken.mint(liquidator, fullDebt);

        vm.startPrank(liquidator);
        borrowedToken.approve(address(engine), fullDebt);
        engine.liquidate(user, fullDebt);
        vm.stopPrank();

        assertEq(engine.getAccountDebtValue(user), 0);
        assertEq(engine.getHealthFactor(user), type(uint256).max);
    }

    function test_liquidate_revertsIfSeizureExceedsDeposited() public {
        // Craft a scenario where the position is bad-debt: collateral value at the crashed price,
        // plus the liquidation bonus, is less than what covering the full debt would require.
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether);

        // Crash the price hard enough that 100% of the debt can't be covered by deposited collateral
        // even before the bonus is applied: collateral is worth less than the debt itself.
        priceFeed.updatePrice(1e8); // collateral now worth $10 total; debt is $15,000

        vm.prank(user);
        vm.expectRevert(); // health factor read still succeeds; liquidation must revert on seizure
        engine.liquidate(user, 15_000 ether);
    }

    function test_liquidate_selfLiquidationAllowed() public {
        // Not disallowed by spec — a user covering their own bad debt for the bonus is a valid,
        // if unusual, path. Documented here rather than silently assumed.
        _depositCollateral();

        vm.prank(user);
        engine.borrow(15_000 ether);

        priceFeed.updatePrice(1000e8);

        uint256 debtToCover = 1000 ether;
        borrowedToken.mint(user, debtToCover);

        vm.startPrank(user);
        borrowedToken.approve(address(engine), debtToCover);
        engine.liquidate(user, debtToCover);
        vm.stopPrank();

        assertEq(engine.getAccountDebtValue(user), 14_000 ether);
    }

    ////////////////////////////
    ///// MULTI-USER ISOLATION
    ///////////////////////////

    function test_usersCannotWithdrawOthersCollateral() public {
        _depositCollateral();

        address other = makeAddr("other");
        vm.prank(other);
        vm.expectRevert(ISolventEngine.SolventEngine__InsufficientCollateral.selector);
        engine.withdrawCollateral(1);
    }

    function test_oneUsersLiquidationDoesNotAffectAnother() public {
        address userB = makeAddr("userB");
        collateralToken.mint(userB, COLLATERAL_AMOUNT);
        vm.prank(userB);
        collateralToken.approve(address(engine), type(uint256).max);

        _depositCollateral();
        vm.prank(user);
        engine.borrow(15_000 ether);

        vm.prank(userB);
        engine.depositCollateral(COLLATERAL_AMOUNT);
        vm.prank(userB);
        engine.borrow(1000 ether); // well within LTV, stays healthy after the crash below

        priceFeed.updatePrice(1000e8); // crashes user, leaves userB healthy (10000 collateral vs 1000 debt)

        assertLt(engine.getHealthFactor(user), 1e18);
        assertGt(engine.getHealthFactor(userB), 1e18);

        uint256 debtToCover = 1000 ether;
        borrowedToken.mint(liquidator, debtToCover);
        vm.startPrank(liquidator);
        borrowedToken.approve(address(engine), debtToCover);
        engine.liquidate(user, debtToCover);
        vm.stopPrank();

        // userB's position is untouched by user's liquidation.
        assertEq(engine.getCollateralBalance(userB), COLLATERAL_AMOUNT);
        assertEq(engine.getAccountDebtValue(userB), 1000 ether);
    }

    ////////////////////////////
    ///// ROUNDING / DUST
    ///////////////////////////

    function test_borrow_roundsNormalizedDebtInProtocolFavor() public {
        _depositCollateral();

        // Advance the index off 1e18 so the ceil-division path is exercised.
        vm.prank(user);
        engine.borrow(1 ether);
        vm.warp(block.timestamp + 30 days);
        priceFeed.updatePrice(INITIAL_PRICE); // refresh the feed timestamp after warping

        vm.prank(user);
        engine.borrow(1); // 1 wei borrow, forces a rounding decision

        // Debt value must be at least what was actually disbursed — never less (protocol's favor).
        assertGe(engine.getAccountDebtValue(user), 1 ether + 1);
    }

    function test_repay_revertsOnZero() public {
        _depositCollateral();
        vm.prank(user);
        engine.borrow(100 ether);

        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__NeedsMoreThanZero.selector);
        engine.repay(0);
    }

    function test_borrow_revertsOnZero() public {
        _depositCollateral();
        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__NeedsMoreThanZero.selector);
        engine.borrow(0);
    }

    function test_withdraw_revertsOnZero() public {
        _depositCollateral();
        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__NeedsMoreThanZero.selector);
        engine.withdrawCollateral(0);
    }

    function test_liquidate_revertsOnZero() public {
        vm.prank(liquidator);
        vm.expectRevert(ISolventEngine.SolventEngine__NeedsMoreThanZero.selector);
        engine.liquidate(user, 0);
    }

    function test_borrow_revertsWithZeroCollateral() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ISolventEngine.SolventEngine__ExceedsLoanToValue.selector, 1 ether, 0));
        engine.borrow(1 ether);
    }

    ////////////////////////////
    ///// GETTERS
    ///////////////////////////

    function test_getters_reportCorrectState() public {
        _depositCollateral();
        vm.prank(user);
        engine.borrow(1000 ether);

        assertEq(engine.getAccountCollateralValue(user), 20_000 ether);
        assertEq(engine.getCollateralToken(), address(collateralToken));
        assertEq(engine.getBorrowedToken(), address(borrowedToken));
        assertEq(engine.getPriceFeed(), address(priceFeed));
        assertGt(engine.getBorrowIndex(), 0);
        assertGt(engine.getTotalNormalizedDebt(), 0);
    }

    ////////////////////////////
    ///// ORACLE
    ///////////////////////////

    function test_revertsOnStalePrice() public {
        _depositCollateral();

        vm.warp(block.timestamp + 4 hours);

        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__StalePrice.selector);
        engine.borrow(1 ether);
    }

    function test_doesNotRevertAtExactlyStalenessThreshold() public {
        _depositCollateral();

        vm.warp(block.timestamp + 3 hours);

        vm.prank(user);
        engine.borrow(1 ether); // must not revert: exactly at the boundary is still fresh enough
    }

    function test_revertsJustPastStalenessThreshold() public {
        _depositCollateral();

        vm.warp(block.timestamp + 3 hours + 1);

        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__StalePrice.selector);
        engine.borrow(1 ether);
    }

    function test_revertsOnInvalidPrice() public {
        _depositCollateral();

        priceFeed.updatePrice(0);

        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__InvalidPrice.selector);
        engine.borrow(1 ether);
    }

    function test_revertsOnNegativePrice() public {
        _depositCollateral();

        priceFeed.updatePrice(-1);

        vm.prank(user);
        vm.expectRevert(ISolventEngine.SolventEngine__InvalidPrice.selector);
        engine.borrow(1 ether);
    }

    ////////////////////////////
    ///// MOCK AGGREGATOR
    ///////////////////////////

    function test_mockAggregator_getRoundDataIgnoresRequestedRoundButReturnsCurrentState() public {
        priceFeed.updatePrice(1234e8);
        (uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) = priceFeed.getRoundData(999);

        assertEq(roundId, 999);
        assertEq(price, 1234e8);
        assertEq(updatedAt, block.timestamp);
        assertEq(answeredInRound, 999);
    }

    function test_mockAggregator_descriptionAndVersion() public view {
        assertEq(priceFeed.description(), "this is verison 1");
        assertEq(priceFeed.version(), 1);
    }
}
