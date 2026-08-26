// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title Mock Chainlink Price Feed
/// @notice A mock standing in for a real AggregatorV3Interface feed in tests, with fully controllable price.
/// @dev getRoundData ignores the requested round and always returns current state; this mock keeps no history.
contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public immutable override decimals;
    int256 private s_price;
    uint256 public s_timestamp;
    uint80 public s_round;

    /// @notice Deploys the mock with a starting price and decimal precision.
    /// @param _decimals the fixed decimal precision this feed reports prices in.
    /// @param _initialPrice the price this feed starts at.
    constructor(uint8 _decimals, int256 _initialPrice) {
        decimals = _decimals;
        s_price = _initialPrice;
        s_timestamp = block.timestamp;
        s_round = 1;
    }

    /// @notice Test-control lever: moves the price and bumps the round, simulating a new feed update.
    /// @param _newPrice the new price to set.
    function updatePrice(int256 _newPrice) external {
        s_price = _newPrice;
        s_timestamp = block.timestamp;
        s_round++;
    }

    /// @notice Returns the current price and round data, mirroring the real Chainlink feed's return shape.
    function latestRoundData() external view override returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        roundId = s_round;
        price = s_price;
        startedAt = s_timestamp;
        updatedAt = s_timestamp;
        answeredInRound = s_round;
    }

    /// @notice Returns the current price and round data. _roundId is accepted but ignored - this mock has no
    /// history, it always returns the current state regardless of which round was requested.
    /// @param _roundId the requested round (unused).
    function getRoundData(uint80 _roundId) external view override returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        roundId = _roundId;
        price = s_price;
        startedAt = s_timestamp;
        updatedAt = s_timestamp;
        answeredInRound = _roundId;
    }

    /// @notice Returns a fixed description string.
    function description() external pure override returns (string memory) {
        return "this is verison 1";
    }

    /// @notice Returns a fixed version number.
    function version() external pure override returns (uint256) {
        return 1;
    }
}
