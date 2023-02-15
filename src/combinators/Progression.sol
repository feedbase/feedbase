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
        if (cache.end) {
            uint baseb = cache.endbase;
            (bytes32 priceend, uint ttlend) = fb.pull(config.srcb, config.tagb);
            fb.push(tag, bytes32(uint(priceend) * baseb / RAY), ttlend);
            return;
        }

        (bytes32 _pricea, uint ttla) = fb.pull(config.srca, config.taga);
        (bytes32 _priceb, uint ttlb) = fb.pull(config.srcb, config.tagb);
        uint pricea = uint(_pricea);
        uint priceb = uint(_priceb);
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
            if (pricea == 0 || priceb == 0) revert ErrPrice;
            cache.basea = (stretch - point) * RAY / stretch;
            cache.baseb = point * RAY / stretch;
            last = (pricea * cache.basea +
                    priceb * cache.baseb) / RAY;
            cache.a = pricea;
            cache.b = priceb;
            cache.point = point;
            cache.valid = true;
        } else {
            (bytes32 _last,) = fb.pull(address(this), tag);
            last = uint(_last);
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
}

