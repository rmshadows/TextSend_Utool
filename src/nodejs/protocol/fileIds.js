"use strict";

const crypto = require("crypto");
const C = require("./constants");

function random() {
    return crypto.randomBytes(C.FILE_ID_LEN).toString("hex");
}

function toBytes(hex) {
    if (!hex || hex.length !== C.FILE_ID_LEN * 2) {
        throw new Error("bad fileId");
    }
    return Buffer.from(hex, "hex");
}

function toHex(raw) {
    if (!raw || raw.length !== C.FILE_ID_LEN) {
        throw new Error("bad fileId bytes");
    }
    return Buffer.from(raw).toString("hex");
}

function shaHex(digest) {
    return Buffer.from(digest).toString("hex");
}

module.exports = { random, toBytes, toHex, shaHex };
