// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.18;

import '../Feedbase.sol';

interface Block {
    function read(bytes32 tag) external virtual view returns (bytes32 val, uint256 ttl);
}
