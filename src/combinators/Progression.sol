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
    }

    struct Cache {
        uint a;
        uint b;
        uint endbase;
        bool end;
        bool valid;
    }

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

        (bytes32 pricea, uint ttla) = fb.pull(config.srca, config.taga);
        (bytes32 priceb, uint ttlb) = fb.pull(config.srcb, config.tagb);
        uint ttl = ttlb < ttla ? ttlb : ttla;
        uint point = block.timestamp - config.start;
        if (point >= stretch) {
            cache.end = true;
            point = stretch;
            ttl = ttlb;
        }

        uint last;
        if (!cache.valid) {
            require(
                pricea > 0 && priceb > 0,
                "can't initialize when either source is 0"
            );
            cache.a = uint(pricea);
            cache.b = uint(priceb);
            cache.valid = true;
            uint lasta = uint(pricea) * (stretch - point);
            uint lastb = uint(priceb) * point;
            last = (lasta + lastb) / stretch;
        } else {
            (bytes32 _last,) = fb.pull(address(this), tag);
            last = uint(_last);
        }

        // rebalancing
        // calculate the amount of each base in this basket
        // say the quotea is last * (stretch - point) / stretch
        // that's the amount of rico basea would yield if price of a stayed 
        // the same
        // divide quotea by the last price to get the base amount
        // basea = quotea / last_price(a) = quotea / cache.a
        // quotea / (quote / base) == basea
        uint basea = last * (stretch - point) / stretch * RAY / cache.a;
        uint baseb = last * point / stretch * RAY / cache.b;
        // total quote == price, because it's per 1 ref
        uint price = (uint(pricea) * basea + uint(priceb) * baseb) / RAY; 
        fb.push(tag, bytes32(price), ttl);

        if (point == stretch) {
            cache.endbase = baseb;
        }

        // keep previous cache value if new one is 0 so there's still 
        // some way to rebalance
        if (uint(pricea) > 0) {
            cache.a = uint(pricea);
        }
        if (uint(priceb) > 0) {
            cache.b = uint(priceb);
        }
    }
}

