"use strict";

const crypto = require("crypto");
const C = require("./constants");
const B64 = require("./b64");
const TsUri = require("./tsUri");

function isValidPin(pin) {
    return typeof pin === "string" && /^\d{8}$/.test(pin);
}

function buildMaterial(psk, pin) {
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

function generate() {
    const psk = crypto.randomBytes(C.PSK_LEN);
    let pin = "";
    for (let i = 0; i < C.PIN_LEN; i++) {
        pin += String(crypto.randomInt(10));
    }
    return buildMaterial(psk, pin);
}

function forSession(customEnabled, customPin) {
    if (customEnabled && isValidPin(customPin)) {
        return buildMaterial(crypto.randomBytes(C.PSK_LEN), customPin);
    }
    return generate();
}

module.exports = { generate, forSession, isValidPin };
