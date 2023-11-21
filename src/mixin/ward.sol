// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.19;

// tools for ward (root user) management
contract Ward {
    event SetWard(address indexed caller, address indexed trusts, bool bit);
    error ErrWard(address caller, address object, bytes4 sig);

    mapping (address usr => bool) public wards;

    constructor() {
        wards[msg.sender] = true;
        emit SetWard(address(this), msg.sender, true);
    }

    function ward(address usr, bool bit)
      _ward_ external
    {
        emit SetWard(msg.sender, usr, bit);
        wards[usr] = bit;
    }

    function give(address usr)
      _ward_ external
    {
        wards[usr] = true;
        emit SetWard(msg.sender, usr, true);
        wards[msg.sender] = false;
        emit SetWard(msg.sender, msg.sender, false);
    }

    modifier _ward_ {
        if (!wards[msg.sender]) {
            revert ErrWard(msg.sender, address(this), msg.sig);
        }
        _;
    }
}
