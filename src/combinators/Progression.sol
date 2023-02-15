// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.18;
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
        uint period;
    }

    struct Cache {
        uint a;
        uint b;
        uint endbase;
        bool end;
        bool valid;
        uint point;
        uint basea;
        uint baseb;
    }

    error ErrEarly();
    error ErrPrice();

    mapping(bytes32=>Cache) public caches;
    mapping(bytes32=>Config) public configs;
    Feedbase public immutable fb;
    uint constant RAY = 10 ** 27;

    constructor(Feedbase _fb) Ward() {
        fb = _fb;
    }

    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        configs[tag] = _config;
    }

    // smooth progression with rebalancing
    function poke(bytes32 tag) public {
        Config storage config = configs[tag];
        Cache storage cache = caches[tag];
        uint stretch = config.end - config.start;
        (uint priceb, uint ttlb) = pullUint(config.srcb, config.tagb);
        if (cache.end) {
            uint baseb = cache.endbase;
            fb.push(tag, bytes32(priceb * baseb / RAY), ttlb);
            return;
        }
        (uint pricea, uint ttla) = pullUint(config.srca, config.taga);
        uint ttl = ttlb < ttla ? ttlb : ttla;
        uint point = cache.point;
        if (block.timestamp < config.start) revert ErrEarly();
        uint rebals = (block.timestamp - config.start - point) / config.period;
        if (rebals > 0) {
            point      += config.period * rebals;
            cache.point = point;
        }
        if (point >= stretch) {
            cache.end = true;
            point = stretch;
            ttl = ttlb;
            cache.point = point;
        }

        uint last;
        if (!cache.valid) {
            if (pricea == 0 || priceb == 0) revert ErrPrice();
            cache.basea = (stretch - point) * RAY / stretch;
            cache.baseb = point * RAY / stretch;
            last = (pricea * cache.basea +
                    priceb * cache.baseb) / RAY;
            cache.a = pricea;
            cache.b = priceb;
            cache.point = point;
            cache.valid = true;
        } else {
            (last,) = pullUint(address(this), tag);
        }

        // do the rebalance first, then update prices
        if (rebals > 0) {
            // rebalancing
            // calculate the amount of each base in this basket
            // say the quotea is last * (stretch - point) / stretch
            // that's the amount of rico basea would yield if price of a stayed same
            // divide quotea by the last price to get the base amount
            // basea = quotea / last_price(a) = quotea / cache.a
            // quotea / (quote / base) == basea
            cache.basea = last * (stretch - point) / stretch * RAY / cache.a;
            cache.baseb = last * point / stretch * RAY / cache.b;
        }
 
        // total quote == price, because it's per 1 ref
        uint price = (pricea * cache.basea + priceb * cache.baseb) / RAY;
        fb.push(tag, bytes32(price), ttl);

        if (point == stretch) {
            cache.endbase = cache.baseb;
        }

        // keep previous cache value if new one is 0 so there's still 
        // some way to rebalance
        if (pricea > 0) {
            cache.a = pricea;
        }
        if (priceb > 0) {
            cache.b = priceb;
        }
    }

    function pullUint(address src, bytes32 tag) internal view returns (uint val, uint ttl) {
        bytes32 bval;
        (bval, ttl) = fb.pull(src, tag);
        val = uint(bval);
    }
}
