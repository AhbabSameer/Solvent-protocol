// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {SolventEngine} from "../../src/SolventEngine.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "../../src/mocks/MockV3Aggregator.sol";
import {Handler} from "./Handler.t.sol";

/// @notice Handler-based invariant suite (SPEC.md §8). Runs many pseudo-random sequences of
/// deposit/withdraw/borrow/repay/liquidate/price-move/time-warp calls across a fixed actor set and
/// checks system-wide properties after every call.
contract SolventEngineInvariantTest is Test {
    SolventEngine internal engine;
    MockERC20 internal collateralToken;
    MockERC20 internal borrowedToken;
    MockV3Aggregator internal priceFeed;
    Handler internal handler;

    uint256 internal constant SEED_LIQUIDITY = type(uint256).max / 2;

    function setUp() public {
        collateralToken = new MockERC20("Solvent Collateral", "sCOL");
        borrowedToken = new MockERC20("Solvent USD", "sUSD");
        priceFeed = new MockV3Aggregator(8, 2000e8);

        engine = new SolventEngine(address(collateralToken), address(borrowedToken), address(priceFeed));
        borrowedToken.mint(address(engine), SEED_LIQUIDITY);

        handler = new Handler(engine, collateralToken, borrowedToken, priceFeed);

        targetContract(address(handler));
    }

    /// @notice Collateral the engine tracks per-user must always sum to (at most) the token balance
    /// it actually holds — accounting can never claim more than the contract physically has.
    function invariant_trackedCollateralNeverExceedsBalance() public view {
        uint256 trackedTotal;
        for (uint256 i = 0; i < handler.actorsLength(); i++) {
            trackedTotal += engine.getCollateralBalance(handler.actorAt(i));
        }

        assertLe(trackedTotal, collateralToken.balanceOf(address(engine)));
    }

    /// @notice Health factor and debt-value reads must never revert or underflow for any reachable
    /// actor state, regardless of how much debt, collateral, or price movement the fuzzer produced.
    function invariant_healthFactorNeverReverts() public view {
        for (uint256 i = 0; i < handler.actorsLength(); i++) {
            address actor = handler.actorAt(i);
            engine.getHealthFactor(actor);
            engine.getAccountDebtValue(actor);
            engine.getAccountCollateralValue(actor);
        }
    }

    /// @notice Total normalized debt tracked by the engine is consistent with the sum of what was
    /// actually borrowed minus what was actually repaid/liquidated-away: interest accrual can only
    /// grow the gap, never shrink it below what was disbursed net of repayment.
    function invariant_totalDebtNeverBelowNetBorrowed() public view {
        uint256 totalDebtValueUsd = (engine.getTotalNormalizedDebt() * engine.getBorrowIndex()) / engine.PRECISION();
        uint256 netBorrowed = handler.ghost_totalBorrowed() >= handler.ghost_totalRepaid() ? handler.ghost_totalBorrowed() - handler.ghost_totalRepaid() : 0;

        assertGe(totalDebtValueUsd + 1e12, netBorrowed); // small tolerance for per-call floor rounding
    }
}
