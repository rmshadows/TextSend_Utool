"use strict";

const C = require("./constants");

function frameBytes(type, payload) {
    const body = payload && payload.length ? Buffer.from(payload) : Buffer.alloc(0);
    if (body.length > C.MAX_FRAME) {
        throw new Error("payload too large: " + body.length);
    }
    const header = Buffer.alloc(C.HEADER_LEN);
    C.MAGIC.copy(header, 0);
    header[2] = C.VERSION;
    header[3] = type;
    header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
}

function writeFrame(socket, type, payload) {
    socket.write(frameBytes(type, payload));
}

/** 等 socket 可写再继续，避免分片堆在内核缓冲里进度虚高、FILE_DONE 过早 */
function writeFrameWait(socket, type, payload, cancelled) {
    const packet = frameBytes(type, payload);
    return new Promise((resolve, reject) => {
        if (!socket || socket.destroyed || !socket.writable) {
            reject(new Error("disconnected"));
            return;
        }
        const cleanup = () => {
            socket.removeListener("drain", onDrain);
            socket.removeListener("error", onErr);
            socket.removeListener("close", onClose);
        };
        const onDrain = () => {
            cleanup();
            resolve();
        };
        const onErr = (e) => {
            cleanup();
            reject(e);
        };
        const onClose = () => {
            cleanup();
            reject(new Error("disconnected"));
        };
        const tryWrite = () => {
            if (cancelled && cancelled()) {
                cleanup();
                reject(new Error("cancelled"));
                return;
            }
            if (!socket.writable) {
                cleanup();
                reject(new Error("disconnected"));
                return;
            }
            const ok = socket.write(packet);
            if (ok) {
                cleanup();
                resolve();
            } else {
                socket.once("drain", onDrain);
                socket.once("error", onErr);
                socket.once("close", onClose);
            }
        };
        tryWrite();
    });
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

module.exports = { writeFrame, writeFrameWait, FrameReader };
