// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title ISolventEngine
/// @notice External interface for the Solvent lending engine: a single-collateral,
/// single-borrow-asset, over-collateralized market with debt-index interest accrual.
interface ISolventEngine {
    ////////////////////////////
    ///// EVENTS
    ///////////////////////////

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed onBehalfOf, address indexed payer, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtCovered, uint256 collateralSeized);
    event InterestAccrued(uint256 borrowIndex, uint256 timestamp);

    ////////////////////////////
    ///// ERRORS
    ///////////////////////////

    error SolventEngine__NeedsMoreThanZero();
    error SolventEngine__ExceedsLoanToValue(uint256 debtValueUsd, uint256 maxBorrowableUsd);
    error SolventEngine__BreaksHealthFactor(uint256 healthFactor);
    error SolventEngine__InsufficientCollateral();
    error SolventEngine__RepayExceedsDebt();
    error SolventEngine__HealthFactorOk();
    error SolventEngine__DebtToCoverExceedsUserDebt();
    error SolventEngine__InvalidPrice();
    error SolventEngine__StalePrice();
    error SolventEngine__LiquidationFailed();

    ////////////////////////////
    ///// STATE-CHANGING FUNCTIONS
    ///////////////////////////

    /// @notice Deposits collateral into the caller's position.
    function depositCollateral(uint256 amount) external;

    /// @notice Withdraws collateral from the caller's position, reverting if it would break their health factor.
    function withdrawCollateral(uint256 amount) external;

    /// @notice Borrows the market's borrow asset against the caller's deposited collateral.
    function borrow(uint256 amount) external;

    /// @notice Repays part or all of the caller's own debt.
    function repay(uint256 amount) external;

    /// @notice Repays part of an unhealthy user's debt in exchange for a discounted amount of their collateral.
    function liquidate(address user, uint256 debtToCover) external;

    ////////////////////////////
    ///// VIEW FUNCTIONS
    ///////////////////////////

    function getHealthFactor(address user) external view returns (uint256);
    function getAccountCollateralValue(address user) external view returns (uint256);
    function getAccountDebtValue(address user) external view returns (uint256);
    function getCollateralBalance(address user) external view returns (uint256);
    function getTotalNormalizedDebt() external view returns (uint256);
    function getBorrowIndex() external view returns (uint256);
    function getCollateralToken() external view returns (address);
    function getBorrowedToken() external view returns (address);
    function getPriceFeed() external view returns (address);
}
