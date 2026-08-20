"use strict";

const net = require("net");
const { TsPeer } = require("./peer");
const TsUri = require("./tsUri");
const C = require("./constants");

function connect(raw, onText) {
    return new Promise((resolve, reject) => {
        let uri;
        try {
            uri = TsUri.parse(raw);
        } catch (e) {
            reject(e);
            return;
        }
        let settled = false;
        const done = (err, peer) => {
            if (settled) {
                return;
            }
            settled = true;
            if (err) {
                reject(err);
            } else {
                resolve(peer);
            }
        };
        const sock = net.connect({ host: uri.host, port: uri.port });
        sock.setTimeout(C.HANDSHAKE_TIMEOUT_MS);
        sock.once("error", (e) => done(e));
        sock.once("timeout", () => {
            sock.destroy();
            done(new Error("connect timeout"));
        });
        sock.once("connect", () => {
            sock.setTimeout(0);
            let peer = null;
            peer = new TsPeer(sock, {
                asServer: false,
                uri,
                onText,
                onReady: () => done(null, peer),
                onClosed: () => {
                    if (peer && !peer.handshakeOk) {
                        done(new Error("handshake failed"));
                    }
                },
            });
            peer.start();
        });
    });
}

module.exports = { connect };
