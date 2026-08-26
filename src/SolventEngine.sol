// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ISolventEngine} from "./interfaces/ISolventEngine.sol";

/// @title SolventEngine
/// @notice Minimal, single-market, over-collateralized lending protocol: deposit one collateral
/// asset, borrow one $-pegged asset against it, interest accrues via a global debt index, and
/// undercollateralized positions can be liquidated for a bonus.
/// @dev Not audited, not intended for mainnet deployment with real value. See project SPEC.md.
contract SolventEngine is ISolventEngine, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    ////////////////////////////
    ///// CONSTANTS VARIABLES
    ///////////////////////////

    /// @notice Maximum percentage of collateral value a user may borrow against, in basis points (7500 = 75%).
    uint256 public constant LOAN_TO_VALUE = 7500;
    /// @notice Basis-point threshold at which a position becomes liquidatable (8000 = 80%).
    uint256 public constant LIQUIDATION_THRESHOLD = 8000;
    /// @notice Discount, in basis points, a liquidator receives on seized collateral (1000 = 10%).
    uint256 public constant LIQUIDATION_BONUS = 1000;
    /// @notice Denominator used to convert any basis-point constant into a fraction.
    uint256 public constant DENOMINATOR = 10000;
    /// @notice Fixed annual interest rate on borrowed debt, in basis points (500 = 5% APR).
    uint256 public constant INTEREST_RATE = 500; // 5% per year
    /// @notice Number of seconds in a year, used to convert the annual interest rate into a per-second accrual.
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    /// @notice Fixed-point scaling factor (18 decimals) used throughout index and USD-value math.
    uint256 public constant PRECISION = 1e18;
    /// @notice The minimum health factor (1.0, scaled to PRECISION) below which a position is liquidatable.
    uint256 public constant HEALTH_FACTOR = 1e18;
    /// @notice Maximum allowed age of a price feed answer before it is rejected as stale.
    uint256 public constant STALENESS_THRESHOLD = 3 hours;

    ////////////////////////////
    ///// IMMUTABLE VARIABLES
    ///////////////////////////

    /// @notice The single collateral asset accepted by this market.
    IERC20 private immutable i_collateralToken;
    /// @notice The single asset users can borrow, treated as USD-pegged.
    IERC20 private immutable i_borrowedToken;
    /// @notice Chainlink-compatible price feed used to price the collateral asset in USD.
    AggregatorV3Interface private immutable i_priceFeed;
    /// @notice Decimal precision reported by the price feed, cached once at deployment.
    uint8 public immutable i_decimals;

    ////////////////////////////
    ///// STORAGE VARIABLES
    ///////////////////////////

    /// @notice Sum of all users' normalized debt, tracked for invariant checks.
    uint256 private s_totalNormalizedDebt;
    /// @notice Global interest index, scaled to PRECISION (1e18 = 1.0x), grows monotonically over time.
    uint216 private s_borrowIndex;
    /// @notice Timestamp of the last time `s_borrowIndex` was updated.
    uint40 private s_lastAccrualTimestamp;

    ////////////////////////////
    ///// MAPPINGS
    ///////////////////////////

    /// @notice Each user's debt, stored in index-normalized units rather than a raw token amount.
    mapping(address => uint256) private s_userNormalizedDebt;
    /// @notice Each user's deposited collateral balance, in the collateral token's raw units.
    mapping(address => uint256) private s_collateralDeposited;

    ////////////////////////////
    ///// MODIFIERS
    ///////////////////////////

    /// @notice Reverts with SolventEngine__NeedsMoreThanZero if `amount` is zero.
    /// @param amount The amount being validated.
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert SolventEngine__NeedsMoreThanZero();
        }
        _;
    }

    ////////////////////////////
    ///// CONSTRUCTOR
    ///////////////////////////

    /// @notice Deploys the engine for a single collateral/borrow asset pair and price feed.
    /// @param _collateralToken Address of the collateral ERC20 token.
    /// @param _borrowedToken Address of the borrow ERC20 token, treated as USD-pegged.
    /// @param _priceFeed Address of the Chainlink-compatible price feed for the collateral asset.
    constructor(address _collateralToken, address _borrowedToken, address _priceFeed) {
        i_collateralToken = IERC20(_collateralToken);
        i_borrowedToken = IERC20(_borrowedToken);
        i_priceFeed = AggregatorV3Interface(_priceFeed);

        s_borrowIndex = PRECISION.toUint216();
        s_lastAccrualTimestamp = block.timestamp.toUint40();

        i_decimals = i_priceFeed.decimals();
    }

    ////////////////////////////
    ///// EXTERNAL FUNCTIONS
    ///////////////////////////

    /// @notice Deposits collateral into the caller's position.
    /// @dev Follows checks-effects-interactions: balance is credited before the token transfer.
    /// @param _amount Amount of the collateral token to deposit.
    function depositCollateral(uint256 _amount) external nonReentrant moreThanZero(_amount) {
        s_collateralDeposited[msg.sender] += _amount;
        emit CollateralDeposited(msg.sender, _amount);
        i_collateralToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /// @notice Withdraws collateral from the caller's position.
    /// @dev Follows checks-effects-interactions: balance is debited and the resulting health factor is
    /// verified before the token transfer.
    /// @param _amount Amount of the collateral token to withdraw.
    function withdrawCollateral(uint256 _amount) external nonReentrant moreThanZero(_amount) {
        if (_amount > s_collateralDeposited[msg.sender]) {
            revert SolventEngine__InsufficientCollateral();
        }

        s_collateralDeposited[msg.sender] -= _amount;
        emit CollateralWithdrawn(msg.sender, _amount);
        _revertIfHealthFactorIsBroken(msg.sender);
        i_collateralToken.safeTransfer(msg.sender, _amount);
    }

    /// @notice Borrows the market's borrow asset against the caller's deposited collateral.
    /// @dev Accrues interest first so the LTV check uses an up-to-date debt value. Debt is stored
    /// normalized by the borrow index, rounded up so the protocol never under-records what it lent out.
    /// @param _amount Amount of the borrow token to draw.
    function borrow(uint256 _amount) external nonReentrant moreThanZero(_amount) {
        _accrueInterest();

        uint256 normalizedAmount = _ceilDiv(_amount * PRECISION, s_borrowIndex);
        s_userNormalizedDebt[msg.sender] += normalizedAmount;
        s_totalNormalizedDebt += normalizedAmount;

        uint256 debtValueUsd = (s_userNormalizedDebt[msg.sender] * s_borrowIndex) / PRECISION;
        uint256 collateralValueUsd = _getUsdValueOfCollateral(s_collateralDeposited[msg.sender]);
        uint256 maxBorrowableUsd = (collateralValueUsd * LOAN_TO_VALUE) / DENOMINATOR;

        if (debtValueUsd > maxBorrowableUsd) {
            revert SolventEngine__ExceedsLoanToValue(debtValueUsd, maxBorrowableUsd);
        }

        emit Borrowed(msg.sender, _amount);
        i_borrowedToken.safeTransfer(msg.sender, _amount);
    }

    /// @notice Repays part or all of the caller's own debt.
    /// @param _amount Amount of the borrow token to repay, denominated in current USD debt value.
    function repay(uint256 _amount) external nonReentrant moreThanZero(_amount) {
        _accrueInterest();
        _repay(msg.sender, msg.sender, _amount);
        i_borrowedToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /// @notice Repays part of an unhealthy user's debt in exchange for a discounted amount of their collateral.
    /// @dev Only callable when the target's health factor is below 1e18. The liquidator cannot cover more
    /// debt than the user actually owes, and cannot seize more collateral than the user has deposited.
    /// @param _user The undercollateralized position being liquidated.
    /// @param _debtToCover Amount of debt (in USD value / borrow-token units) the liquidator is repaying.
    function liquidate(address _user, uint256 _debtToCover) external nonReentrant moreThanZero(_debtToCover) {
        _accrueInterest();

        uint256 startingHealthFactor = _healthFactor(_user);
        if (startingHealthFactor >= HEALTH_FACTOR) {
            revert SolventEngine__HealthFactorOk();
        }

        uint256 userDebtValueUsd = (s_userNormalizedDebt[_user] * s_borrowIndex) / PRECISION;
        if (_debtToCover > userDebtValueUsd) {
            revert SolventEngine__DebtToCoverExceedsUserDebt();
        }

        uint256 collateralToSeize = _getCollateralAmountFromUsdValue(_debtToCover);
        uint256 bonusCollateral = (collateralToSeize * LIQUIDATION_BONUS) / DENOMINATOR;
        uint256 totalCollateralToSeize = collateralToSeize + bonusCollateral;

        if (totalCollateralToSeize > s_collateralDeposited[_user]) {
            revert SolventEngine__LiquidationFailed();
        }

        _repay(_user, msg.sender, _debtToCover);
        s_collateralDeposited[_user] -= totalCollateralToSeize;
        emit Liquidated(_user, msg.sender, _debtToCover, totalCollateralToSeize);

        i_borrowedToken.safeTransferFrom(msg.sender, address(this), _debtToCover);
        i_collateralToken.safeTransfer(msg.sender, totalCollateralToSeize);
    }

    ////////////////////////////
    ///// EXTERNAL VIEW FUNCTIONS
    ///////////////////////////

    /// @notice Returns a user's current health factor, including interest accrued since the last on-chain update.
    /// @param _user Address of the user to evaluate.
    function getHealthFactor(address _user) external view returns (uint256) {
        return _healthFactor(_user);
    }

    /// @notice Returns the USD value of a user's deposited collateral.
    /// @param _user Address of the user to evaluate.
    function getAccountCollateralValue(address _user) external view returns (uint256) {
        return _getUsdValueOfCollateral(s_collateralDeposited[_user]);
    }

    /// @notice Returns the USD value of a user's current debt, including interest accrued since the last on-chain update.
    /// @param _user Address of the user to evaluate.
    function getAccountDebtValue(address _user) external view returns (uint256) {
        return (s_userNormalizedDebt[_user] * _currentBorrowIndex()) / PRECISION;
    }

    /// @notice Returns the raw amount of collateral a user has deposited.
    /// @param _user Address of the user to evaluate.
    function getCollateralBalance(address _user) external view returns (uint256) {
        return s_collateralDeposited[_user];
    }

    /// @notice Returns the sum of all users' normalized debt (not USD-denominated).
    function getTotalNormalizedDebt() external view returns (uint256) {
        return s_totalNormalizedDebt;
    }

    /// @notice Returns the current global borrow index, including interest accrued since the last on-chain update.
    function getBorrowIndex() external view returns (uint256) {
        return _currentBorrowIndex();
    }

    /// @notice Returns the address of the collateral token.
    function getCollateralToken() external view returns (address) {
        return address(i_collateralToken);
    }

    /// @notice Returns the address of the borrow token.
    function getBorrowedToken() external view returns (address) {
        return address(i_borrowedToken);
    }

    /// @notice Returns the address of the Chainlink-compatible price feed.
    function getPriceFeed() external view returns (address) {
        return address(i_priceFeed);
    }

    ////////////////////////////
    ///// INTERNAL FUNCTIONS
    ///////////////////////////

    /// @notice Reduces `_onBehalfOf`'s debt by `_amount` (USD value). Pure effects — the caller is
    /// responsible for pulling `_amount` of the borrow token from `_payer` afterwards (CEI).
    /// @dev Rounds the normalized-debt reduction down, so the protocol never records a larger debt
    /// reduction than the tokens actually received.
    function _repay(address _onBehalfOf, address _payer, uint256 _amount) internal {
        uint256 userDebtValueUsd = (s_userNormalizedDebt[_onBehalfOf] * s_borrowIndex) / PRECISION;
        if (_amount > userDebtValueUsd) {
            revert SolventEngine__RepayExceedsDebt();
        }

        uint256 normalizedAmount = (_amount * PRECISION) / s_borrowIndex;
        s_userNormalizedDebt[_onBehalfOf] -= normalizedAmount;
        s_totalNormalizedDebt -= normalizedAmount;

        emit Repaid(_onBehalfOf, _payer, _amount);
    }

    /// @notice Reverts if `_user`'s health factor is below the minimum (1e18).
    function _revertIfHealthFactorIsBroken(address _user) internal view {
        uint256 healthFactor = _healthFactor(_user);
        if (healthFactor < HEALTH_FACTOR) {
            revert SolventEngine__BreaksHealthFactor(healthFactor);
        }
    }

    /// @notice Advances the global borrow index to reflect interest accrued since the last update.
    /// @dev No-op if called more than once in the same block (elapsed time of zero). Compounds on
    /// top of the existing index rather than a fixed starting value, matching the Aave/Compound pattern.
    function _accrueInterest() internal {
        if (block.timestamp == s_lastAccrualTimestamp) {
            return;
        }

        uint256 newIndex = _currentBorrowIndex();

        s_borrowIndex = newIndex.toUint216();
        s_lastAccrualTimestamp = block.timestamp.toUint40();

        emit InterestAccrued(newIndex, block.timestamp);
    }

    /// @notice Computes what the global borrow index would be if accrued right now, without writing state.
    function _currentBorrowIndex() internal view returns (uint256) {
        uint256 timePassed = block.timestamp - s_lastAccrualTimestamp;

        if (timePassed == 0) {
            return s_borrowIndex;
        }

        uint256 growthFactor = PRECISION + (INTEREST_RATE * timePassed * PRECISION) / (DENOMINATOR * SECONDS_PER_YEAR);

        return (s_borrowIndex * growthFactor) / PRECISION;
    }

    /// @notice Computes a user's current health factor, including interest accrued since the last on-chain update.
    /// @dev Uses LIQUIDATION_THRESHOLD (not LOAN_TO_VALUE) — this check gates withdrawals and
    /// liquidations, and is distinct from the LTV check used to gate new borrows.
    /// @param _user Address of the user to evaluate.
    /// @return The user's health factor, scaled to PRECISION (1e18 = 1.0). Returns type(uint256).max
    /// if the user has no debt.
    function _healthFactor(address _user) internal view returns (uint256) {
        uint256 debtValueUsd = _ceilDiv(s_userNormalizedDebt[_user] * _currentBorrowIndex(), PRECISION);

        if (debtValueUsd == 0) {
            return type(uint256).max;
        }

        uint256 collateralValueInUsd = _getUsdValueOfCollateral(s_collateralDeposited[_user]);

        return (collateralValueInUsd * LIQUIDATION_THRESHOLD * PRECISION) / (DENOMINATOR * debtValueUsd);
    }

    /// @notice Reads the collateral price feed and normalizes it to PRECISION (18 decimals).
    /// @dev Reverts if the price feed reports a non-positive price (SolventEngine__InvalidPrice) or
    /// a stale update older than STALENESS_THRESHOLD (SolventEngine__StalePrice).
    function _getCollateralPrice() internal view returns (uint256) {
        (, int256 price,, uint256 updatedAt,) = i_priceFeed.latestRoundData();

        if (price <= 0) {
            revert SolventEngine__InvalidPrice();
        }
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD) {
            revert SolventEngine__StalePrice();
        }

        return uint256(price) * (10 ** (18 - i_decimals));
    }

    /// @notice Converts a raw collateral token amount into its USD value.
    /// @param _collateralAmount Raw amount of the collateral token (assumed 18 decimals).
    /// @return The USD value of `_collateralAmount`, scaled to PRECISION.
    function _getUsdValueOfCollateral(uint256 _collateralAmount) internal view returns (uint256) {
        return (_collateralAmount * _getCollateralPrice()) / PRECISION;
    }

    /// @notice Converts a USD value into the equivalent raw amount of the collateral token.
    /// @dev Rounds down, so a liquidator is never handed more collateral than the price supports.
    /// @param _usdAmount USD value, scaled to PRECISION.
    function _getCollateralAmountFromUsdValue(uint256 _usdAmount) internal view returns (uint256) {
        return (_usdAmount * PRECISION) / _getCollateralPrice();
    }

    /// @notice Integer division rounded up.
    function _ceilDiv(uint256 _numerator, uint256 _denominator) internal pure returns (uint256) {
        return (_numerator + _denominator - 1) / _denominator;
    }
}
