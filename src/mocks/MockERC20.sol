// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20.
/// @notice this is a mock ERC20 for testing, with open minting.
contract MockERC20 is ERC20 {
    /// @notice constructor that takes in name and symbol for the erc20 and passes it to the parent.
    /// @param _name  the name of the erc20 token.
    /// @param _symbol  the symbol of the erc20 token.
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    /// @notice a mint function where anyone can mint any amount of tokens to any address here
    /// @param _to  the address to mint tokens to
    /// @param _amount  the amount of tokens to mint
    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}
