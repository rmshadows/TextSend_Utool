"use strict";

const crypto = require("crypto");
const C = require("./constants");
const B64 = require("./b64");
const TsUri = require("./tsUri");

function generate() {
    const psk = crypto.randomBytes(C.PSK_LEN);
    let pin = "";
    for (let i = 0; i < C.PIN_LEN; i++) {
        pin += String(crypto.randomInt(10));
    }
    const pskB64 = B64.enc(psk);
    return {
        psk,
        pskB64,
        pin,
        toPskUri(host, port) {
            return TsUri.format(host, port, pskB64);
        },
        toPinUri(host, port) {
            return TsUri.format(host, port, pin);
        },
    };
}

module.exports = { generate };
