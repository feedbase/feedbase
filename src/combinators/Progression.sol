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


    mapping(bytes32=>uint) cachea;
    mapping(bytes32=>uint) cacheb;
    mapping(bytes32=>bool) valid;

    mapping(bytes32=>Config) public configs;
    Feedbase public immutable fb;
    uint RAY = 10 ** 27;

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

        // later need to multiply the result by last / prog
        if (valid[tag]) {
            uint prog = (cachea[tag] * (stretch - point) + cacheb[tag] * point) / stretch;
            require(cachea[tag] > 0 && cacheb[tag] > 0, 'not initialized');

            (bytes32 _last,) = fb.pull(address(this), tag);
            uint last = uint(_last);
            if (last > 0) {
                price = price * last / prog;
            }
        } else {
            valid[tag] = true;
        }
        cachea[tag] = uint(pricea);
        cacheb[tag] = uint(priceb);
        fb.push(tag, bytes32(price), ttla < ttlb ? ttla : ttlb);
    }
}

