/// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2024 Free Software Foundation, in loving memory of Nikolai

pragma solidity ^0.8.19;

import { Feedbase } from "../Feedbase.sol";

contract MockVat {
    uint256 internal _par = 10 ** 27;

    function setPar(uint p) external {
        _par = p;
    }

    // copied sig from Vat manual getter
    function par() external view returns (uint) {
        return _par;
    }
}
