// SPDX-License-Identifier: GPL-v3.0
pragma solidity ^0.8.19;

import '../Feedbase.sol';
import { Ward } from '../mixin/ward.sol';

contract TWAP is Ward {
    struct Config {
        address source;
        bytes32 tag;
        uint256 range;
        uint256 ttl;
    }

    struct Window {
        uint head;
        uint time;
    }

    error ErrRange();
    error ErrDone();

    mapping(bytes32 dtag => Config)        configs;
    mapping(bytes32 dtag => Window) public windows;

    Feedbase public immutable feedbase;

    constructor(address _fb) Ward() {
        feedbase = Feedbase(_fb);
    }
    
    function setConfig(bytes32 dtag, Config calldata _config) public _ward_ {
        Window storage window = windows[dtag];
        if (_config.range > block.timestamp) revert ErrRange();
        window.time = block.timestamp;
        if (configs[dtag].range > 0) {
            // new number of slots in window
            // do this so next poke result doesn't change
            window.head = window.head * _config.range / configs[dtag].range;
        }
        configs[dtag] = _config;
    }

    function getConfig(bytes32 tag) public view returns (Config memory) {
        return configs[tag];
    }

    // modified from reflexer ChainlinkTWAP
    // https://github.com/reflexer-labs/geb-chainlink-median/blob/master/src/ChainlinkTWAP.sol
    // GPL3
    function poke(bytes32 dtag) external {
        Config storage config = configs[dtag];
        (bytes32 spot, uint ttl) = feedbase.pull(config.source, config.tag);
        Window storage window = windows[dtag];
        uint head = window.head;

        uint256 elapsed = block.timestamp - window.time;
        uint256 capped  = elapsed > config.range ? config.range : elapsed;
        if (elapsed == 0) revert ErrDone();
        uint nexttally = head + capped * uint(spot);

        // advance twap window by elapsed time
        uint pseudospot  = head / config.range;
        uint pseudotally = pseudospot * capped;
        window.head = nexttally - pseudotally;
        window.time = block.timestamp;

        // push twap, advance ttl from *source feed's* ttl
        if (type(uint).max - ttl < config.ttl) {
            ttl = type(uint).max;
        } else {
            ttl += config.ttl;
        }

        feedbase.push(dtag, bytes32((nexttally - pseudotally) / config.range), ttl);
    }
}
