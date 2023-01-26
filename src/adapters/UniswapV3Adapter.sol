// SPDX-License-Identifier: AGPL-v3.0

pragma solidity 0.8.15;

import "../Feedbase.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos) external view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        );
}


contract UniswapV3Adapter {
    mapping(address => uint32) ranges;
    Feedbase immutable fb;
    mapping(address=>bool) wards;
    mapping(bytes32=>address) pools;
    mapping(bytes32=>uint) ttls;

    constructor(Feedbase _fb) {
        wards[msg.sender] = true;
        fb = _fb;
    }

    modifier _ward_ {
        require(wards[msg.sender], "unwarded sender");
        _;
    }

    function ward(address _owner, bool ok) public _ward_ {
        wards[_owner] = ok;
    }

    function setPool(bytes32 tag, address pool) public _ward_ {
        pools[tag] = pool;
    }

    function setTTL(bytes32 tag, uint ttl) public _ward_ {
        ttls[tag] = ttl;
    }

    function look(bytes32 tag) public {
        address apool = pools[tag];
        require(address(0) != apool, "no pool for tag");

        uint32[] memory times = new uint32[](2);
        uint32 range  = ranges[apool];
        times[0] = 0;
        times[1] = range;
        (int56[] memory cumulatives,) = IUniswapV3Pool(apool).observe(times);

        int   delt = int(cumulatives[0]) - int(cumulatives[1]);
        int56 mean = int56(delt / int(uint(range)));
        fb.push(tag, bytes32(uint(int(mean))), ttls[tag]);
    }

}

