"use strict";

const C = require("./constants");

function writeFrame(socket, type, payload) {
    const body = payload && payload.length ? Buffer.from(payload) : Buffer.alloc(0);
    if (body.length > C.MAX_FRAME) {
        throw new Error("payload too large: " + body.length);
    }
    const header = Buffer.alloc(C.HEADER_LEN);
    C.MAGIC.copy(header, 0);
    header[2] = C.VERSION;
    header[3] = type;
    header.writeUInt32BE(body.length, 4);
    socket.write(Buffer.concat([header, body]));
}

class FrameReader {
    constructor() {
        this.buf = Buffer.alloc(0);
    }

    push(chunk) {
        this.buf = Buffer.concat([this.buf, chunk]);
    }

    next() {
        if (this.buf.length < C.HEADER_LEN) {
            return null;
        }
        if (this.buf[0] !== C.MAGIC[0] || this.buf[1] !== C.MAGIC[1]) {
            throw new Error("bad magic");
        }
        const len = this.buf.readUInt32BE(4);
        if (len < 0 || len > C.MAX_FRAME) {
            throw new Error("bad length: " + len);
        }
        if (this.buf.length < C.HEADER_LEN + len) {
            return null;
        }
        const frame = {
            version: this.buf[2],
            type: this.buf[3],
            payload: Buffer.from(this.buf.subarray(C.HEADER_LEN, C.HEADER_LEN + len)),
        };
        this.buf = this.buf.subarray(C.HEADER_LEN + len);
        return frame;
    }
}

module.exports = { writeFrame, FrameReader };
