"use strict";

const C = require("./constants");
const B64 = require("./b64");

const URI = /^(?:ts:\/\/)?(?:\[([^\]]+)\]|([^:/\s]+))(?::(\d{1,5}))?\/k(.+)$/i;

function parsePort(s) {
    if (s == null || s === "") {
        return C.DEFAULT_PORT;
    }
    const port = parseInt(s, 10);
    if (!(port >= 1 && port <= 65535)) {
        throw new Error("bad port");
    }
    return port;
}

function parse(raw) {
    if (!raw) {
        throw new Error("empty uri");
    }
    const s = String(raw).trim().split(/\r?\n/)[0].trim();
    const m = URI.exec(s);
    if (!m) {
        throw new Error("bad connection string");
    }
    const host = m[1] != null ? m[1] : m[2];
    const port = parsePort(m[3]);
    const k = m[4];
    if (new RegExp("^\\d{" + C.PIN_LEN + "}$").test(k)) {
        return { host, port, k, pinMode: true, psk: null };
    }
    let psk;
    try {
        psk = B64.dec(k);
    } catch (e) {
        throw new Error("k is neither PIN nor Base64URL PSK");
    }
    if (psk.length !== C.PSK_LEN) {
        throw new Error("PSK must be 32 bytes");
    }
    return { host, port, k, pinMode: false, psk };
}

function format(host, port, kMaterial) {
    const v6 = String(host).includes(":");
    const h = v6 ? "[" + host + "]" : host;
    return "ts://" + h + ":" + port + "/k" + kMaterial;
}

function pinOf(uri) {
    return uri.pinMode ? uri.k : null;
}

module.exports = { parse, format, pinOf };
