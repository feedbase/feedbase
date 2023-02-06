// SPDX-License-Identifier: AGPL-v3.0

pragma solidity 0.8.17;
import "../Feedbase.sol";
import { Ward } from '../mixin/ward.sol';

contract Progression is Ward {
    struct Config {
        address srca;
        bytes32 taga;
        address srcb;
        bytes32 tagb;
        uint start;
        uint end;
        bool paused;
    }

    struct Cache {
        uint a;
        uint b;
        bool valid;
    }

    mapping(bytes32=>Cache) public caches;
    mapping(bytes32=>Config) public configs;
    Feedbase public immutable fb;

    constructor(Feedbase _fb) Ward() {
        fb = _fb;
    }

    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        configs[tag] = _config;
    }

    // smooth progression
    function poke(bytes32 tag) public {
        Config storage config = configs[tag];
        uint stretch = config.end - config.start;
        uint point = block.timestamp - config.start;
        if (point > stretch) {
            point = stretch;
        }
        (bytes32 pricea, uint ttla) = fb.pull(config.srca, config.taga);
        (bytes32 priceb, uint ttlb) = fb.pull(config.srcb, config.tagb);
        uint price = (uint(pricea) * (stretch - point) + uint(priceb) * point) / stretch;
        uint ttl = ttla < ttlb ? ttla : ttlb;

        Cache storage cache = caches[tag];
        if (cache.valid) {
            (bytes32 _last,) = fb.pull(address(this), tag);
            uint last = uint(_last);
            if (last > 0) {
                // last and prog are both calculated from last poke data
                // price should only change if the prices of underlying 
                // assets change
                uint prog = (cache.a * (stretch - point) + cache.b * point) / stretch;
                price = price * last / prog;
            }
        } else {
            cache.valid = true;
        }
        cache.a = uint(pricea);
        cache.b = uint(priceb);
        fb.push(tag, bytes32(price), ttl);
    }
}

