// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {SolventEngine} from "../../src/SolventEngine.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "../../src/mocks/MockV3Aggregator.sol";

/// @notice Bounded, stateful actor for invariant testing: deposits, borrows, repays, withdraws and
/// liquidates using a fixed cast of actors so calls chain into realistic multi-step sequences.
contract Handler is Test {
    SolventEngine public engine;
    MockERC20 public collateralToken;
    MockERC20 public borrowedToken;
    MockV3Aggregator public priceFeed;

    address[] public actors;
    address internal currentActor;

    uint256 public ghost_totalBorrowed;
    uint256 public ghost_totalRepaid;

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(SolventEngine _engine, MockERC20 _collateralToken, MockERC20 _borrowedToken, MockV3Aggregator _priceFeed) {
        engine = _engine;
        collateralToken = _collateralToken;
        borrowedToken = _borrowedToken;
        priceFeed = _priceFeed;

        for (uint256 i = 0; i < 5; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encodePacked("actor", i)))));
            actors.push(actor);
            vm.prank(actor);
            collateralToken.approve(address(engine), type(uint256).max);
            vm.prank(actor);
            borrowedToken.approve(address(engine), type(uint256).max);
        }
    }

    function depositCollateral(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        amount = bound(amount, 1, 1_000_000 ether);
        collateralToken.mint(currentActor, amount);
        engine.depositCollateral(amount);
    }

    function withdrawCollateral(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        uint256 balance = engine.getCollateralBalance(currentActor);
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        try engine.withdrawCollateral(amount) {} catch {}
    }

    function borrow(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        uint256 collateralValueUsd = engine.getAccountCollateralValue(currentActor);
        uint256 debtValueUsd = engine.getAccountDebtValue(currentActor);
        uint256 maxBorrowable = (collateralValueUsd * engine.LOAN_TO_VALUE()) / engine.DENOMINATOR();
        if (maxBorrowable <= debtValueUsd) return;

        amount = bound(amount, 1, maxBorrowable - debtValueUsd);
        try engine.borrow(amount) {
            ghost_totalBorrowed += amount;
        } catch {}
    }

    function repay(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        uint256 debt = engine.getAccountDebtValue(currentActor);
        if (debt == 0) return;
        amount = bound(amount, 1, debt);
        borrowedToken.mint(currentActor, amount);
        try engine.repay(amount) {
            ghost_totalRepaid += amount;
        } catch {}
    }

    function liquidate(uint256 liquidatorSeed, uint256 targetSeed, uint256 debtToCover) public useActor(liquidatorSeed) {
        address target = actors[bound(targetSeed, 0, actors.length - 1)];
        uint256 debt = engine.getAccountDebtValue(target);
        if (debt == 0) return;

        debtToCover = bound(debtToCover, 1, debt);
        borrowedToken.mint(currentActor, debtToCover);
        try engine.liquidate(target, debtToCover) {
            ghost_totalRepaid += debtToCover;
        } catch {}
    }

    /// @notice Moves the price within a bounded range so positions can become unhealthy without ever
    /// going to zero/negative (which would just make every call revert on invalid price instead of
    /// exercising liquidation).
    function updatePrice(uint256 newPrice) public {
        newPrice = bound(newPrice, 100e8, 10_000e8);
        priceFeed.updatePrice(int256(newPrice));
    }

    function warpTime(uint256 secondsElapsed) public {
        secondsElapsed = bound(secondsElapsed, 0, 30 days);
        vm.warp(block.timestamp + secondsElapsed);
        // Refresh the feed so warps don't just make every subsequent call revert on staleness.
        (, int256 currentPrice,,,) = priceFeed.latestRoundData();
        priceFeed.updatePrice(currentPrice);
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }
}
