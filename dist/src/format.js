"use strict";
exports.__esModule = true;
exports.cost = exports.amt = exports.ttl = exports.val = exports.tag = exports.address = exports.bn2b32 = exports.str2b32 = void 0;
var debug = require('debug')('feedbase:format');
var ethers = require('hardhat').ethers;
var BigNumber = ethers.BigNumber;
function pad(s, n) {
    return s.padEnd(n, '\0');
}
function str2b32(s) {
    return ethers.utils.zeroPad(Buffer.from(s), 32);
}
exports.str2b32 = str2b32;
// BigNumber to `bytes32`-compatible Bytes
function bn2b32(bn) {
    if (!bn._isBigNumber) {
        throw new Error("bn2b32 takes a BigNumber, got " + bn + ", a " + typeof (bn));
    }
    var hex = bn.toHexString();
    var buff = Buffer.from(hex.slice(2), 'hex');
    var b32 = ethers.utils.zeroPad(buff, 32);
    debug(b32);
    return b32;
}
exports.bn2b32 = bn2b32;
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
