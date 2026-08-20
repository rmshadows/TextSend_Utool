"use strict";

const crypto = require("crypto");
const C = require("./constants");

/** nonce(12) || ciphertext || tag(16) */
function seal(key32, plaintext) {
    const nonce = crypto.randomBytes(C.GCM_NONCE_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", key32, nonce);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ct, tag]);
}

function open(key32, sealed) {
    if (!sealed || sealed.length < C.GCM_NONCE_LEN + C.GCM_TAG_LEN) {
        throw new Error("sealed too short");
    }
    const nonce = sealed.subarray(0, C.GCM_NONCE_LEN);
    const tag = sealed.subarray(sealed.length - C.GCM_TAG_LEN);
    const ct = sealed.subarray(C.GCM_NONCE_LEN, sealed.length - C.GCM_TAG_LEN);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key32, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
}

module.exports = { seal, open };
