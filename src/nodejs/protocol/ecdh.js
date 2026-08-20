"use strict";

const crypto = require("crypto");

function generate() {
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    return ecdh;
}

function encodePublic(ecdh) {
    return ecdh.getPublicKey(null, "uncompressed");
}

function sharedSecret(local, remoteUncompressed) {
    return local.computeSecret(remoteUncompressed);
}

module.exports = { generate, encodePublic, sharedSecret };
