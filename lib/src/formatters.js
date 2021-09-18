"use strict";
exports.__esModule = true;
exports.cost = exports.amt = exports.ttl = exports.val = exports.tag = exports.address = exports.bytes32 = void 0;
function pad(s, n) {
    return s.padEnd(n, '\0');
}
function bytes32(v) {
    if (typeof (v) === 'string') {
        if (!v.startsWith('0x')) {
            v = '0x' + v.padStart(64, '0');
        }
        return v;
    }
    else {
        throw new Error("fmt: unsupported cast to bytes32 from " + v);
    }
}
exports.bytes32 = bytes32;
function address(v) {
    if (typeof (v) === 'string') {
        if (!v.startsWith('0x')) {
            v = '0x' + v.padStart(40, '0');
        }
        return v;
    }
    else {
        throw new Error("fmt: unsupported cast to bytes32 from " + v);
    }
}
exports.address = address;
function tag(tag) {
    return Buffer.from(tag.padEnd(32, '\0'));
}
exports.tag = tag;
function val(val) {
    var BN = require('bn.js');
    var _val = parseInt(val);
    var num = new BN(_val);
    var hex = num.toString(16);
    if (hex.length % 2)
        hex = '0' + hex;
    return Buffer.from(hex, 'hex');
}
exports.val = val;
function ttl(ttl) {
    return Math.floor(Date.now() / 1000) + parseInt(ttl);
}
exports.ttl = ttl;
function amt(amt) {
    return parseInt(amt);
}
exports.amt = amt;
function cost(cost) {
    return parseInt(cost);
}
exports.cost = cost;
