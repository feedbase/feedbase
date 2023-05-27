// SPDX-License-Identifier: AGPL-v3.0
pragma solidity 0.8.19;

import { Ward } from '../mixin/ward.sol';
import { Feedbase } from '../Feedbase.sol';

interface ITellor {
    function getNewValueCountbyRequestId(uint requestId) external view returns (uint);
    function getTimestampbyRequestIDandIndex(uint requestId, uint idx) external view returns (uint);
    function retrieveData(uint requestId, uint timestamp) external view returns (uint);
}

contract TellorAdapter is Ward {
    ITellor public immutable tellor;
    Feedbase public immutable fb;
    struct Config {
        uint reqid;
        uint ttl;
    }
    mapping(bytes32 tag=>Config config) public configs;
    error ErrNoData();

    constructor (Feedbase _fb, address _tellor) {
        tellor = ITellor(_tellor);
        fb = _fb;
    }

    function setConfig(bytes32 tag, Config calldata _config) _ward_ public {
        configs[tag] = _config;
    }

    function look(bytes32 tag) public {
        Config storage config = configs[tag];
        uint reqid = config.reqid;
        uint256 count = tellor.getNewValueCountbyRequestId(reqid);
        uint256 time = tellor.getTimestampbyRequestIDandIndex(reqid, count - 1);
        uint256 value = tellor.retrieveData(reqid, time);
        if (value > 0) fb.push(tag, bytes32(value), time + config.ttl);
        else revert ErrNoData();
    }
}
