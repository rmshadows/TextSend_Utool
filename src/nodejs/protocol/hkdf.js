"use strict";

const crypto = require("crypto");

/** HKDF-SHA256，与 Java 端一致 */
function derive(ikm, salt, info, length) {
    const s = !salt || salt.length === 0 ? Buffer.alloc(32) : salt;
    const prk = crypto.createHmac("sha256", s).update(ikm).digest();
    const infoBuf = Buffer.from(info, "utf8");
    const out = Buffer.alloc(length);
    let t = Buffer.alloc(0);
    let pos = 0;
    let counter = 1;
    while (pos < length) {
        const h = crypto.createHmac("sha256", prk);
        h.update(t);
        h.update(infoBuf);
        h.update(Buffer.from([counter]));
        t = h.digest();
        const copy = Math.min(t.length, length - pos);
        t.copy(out, pos, 0, copy);
        pos += copy;
        counter++;
    }
    prk.fill(0);
    return out;
}

module.exports = { derive };
