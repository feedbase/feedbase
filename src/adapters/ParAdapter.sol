// SPDX-License-Identifier: GPL-v3.0
// Copyright (C) 2021-2024 halys

pragma solidity ^0.8.19;

import { Read } from "../mixin/Read.sol";

interface Vat {
    function par() external view returns (uint256);
}

contract ParAdapter is Read {
    Vat immutable vat;

    constructor(address _vat) {
        vat = Vat(_vat);
    }

    function read(bytes32)
      external view override returns (bytes32 val, uint256 ttl) {
        val = bytes32(vat.par());
        ttl = block.timestamp;
    }
}
