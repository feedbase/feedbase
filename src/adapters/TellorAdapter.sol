// SPDX-License-Identifier: AGPL-v3.0
pragma solidity 0.8.19;

import { Ward } from '../mixin/ward.sol';
import { Feedbase } from '../Feedbase.sol';

interface ITellor {
    function getNewValueCountbyQueryId(bytes32 queryId) external view returns (uint);
    function getTimestampbyQueryIdandIndex(bytes32 queryId, uint idx) external view returns (uint);
    function retrieveData(bytes32 queryId, uint timestamp) external view returns (bytes memory);
}

contract TellorAdapter is Ward {
    ITellor public immutable tellor;
    Feedbase public immutable fb;
    struct Config {
        bytes32 qid;
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
        bytes32 qid = config.qid;
        uint256 count = tellor.getNewValueCountbyQueryId(qid);
        uint256 time = tellor.getTimestampbyQueryIdandIndex(qid, count - 1);
        bytes memory value = tellor.retrieveData(qid, time);
        if (value.length == 32) fb.push(tag, bytes32(value), time + config.ttl);
        else revert ErrNoData();
    }
}
