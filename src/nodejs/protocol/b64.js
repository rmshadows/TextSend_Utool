"use strict";

function enc(buf) {
    return Buffer.from(buf).toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function dec(s) {
    let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) {
        t += "=";
    }
    return Buffer.from(t, "base64");
}

module.exports = { enc, dec };
