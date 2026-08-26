// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SolventEngine} from "../../src/SolventEngine.sol";

/// @title MaliciousReentrantToken
/// @notice Test-only ERC20 whose transfer hooks call back into a SolventEngine, used to prove the
/// engine's `nonReentrant` guards hold even against a malicious token implementation.
contract MaliciousReentrantToken is ERC20 {
    SolventEngine public engine;
    bool public attackViaWithdraw;
    bool public attackViaDeposit;
    bool public attacking;

    constructor() ERC20("Malicious", "EVIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setEngine(address _engine) external {
        engine = SolventEngine(_engine);
    }

    function setAttackMode(bool _viaWithdraw, bool _viaDeposit) external {
        attackViaWithdraw = _viaWithdraw;
        attackViaDeposit = _viaDeposit;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _tryReenter();
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _tryReenter();
        return super.transferFrom(from, to, amount);
    }

    function _tryReenter() internal {
        if (attacking || address(engine) == address(0)) {
            return;
        }
        attacking = true;
        if (attackViaWithdraw) {
            engine.withdrawCollateral(1);
        } else if (attackViaDeposit) {
            engine.depositCollateral(1);
        }
        attacking = false;
    }
}
