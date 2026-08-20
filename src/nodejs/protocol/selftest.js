"use strict";

const { TsServer } = require("./server");
const protoClient = require("./client");
const TsUri = require("./tsUri");

async function main() {
    const received = [];
    const server = new TsServer(0, 2, (t) => received.push("S:" + t));
    await server.listen();
    const port = server.port;
    const pinUri = TsUri.format("127.0.0.1", port, server.material.pin);
    const pskUri = TsUri.format("127.0.0.1", port, server.material.pskB64);

    const got = [];
    const peer = await protoClient.connect(pinUri, (t) => got.push(t));
    await peer.sendText("hello-pin");
    await new Promise((r) => setTimeout(r, 80));
    if (received[0] !== "S:hello-pin") {
        throw new Error("PIN path server did not get text: " + JSON.stringify(received));
    }
    const n = await server.sendToAll("from-server");
    if (n !== 1) {
        throw new Error("sendToAll " + n);
    }
    await new Promise((r) => setTimeout(r, 80));
    if (got[0] !== "from-server") {
        throw new Error("client did not get text: " + JSON.stringify(got));
    }
    peer.close();
    await new Promise((r) => setTimeout(r, 50));

    const peer2 = await protoClient.connect(pskUri, () => {});
    await peer2.sendText("hello-psk");
    await new Promise((r) => setTimeout(r, 80));
    if (!received.includes("S:hello-psk")) {
        throw new Error("PSK path failed: " + JSON.stringify(received));
    }
    peer2.close();
    server.stop();
    console.log("selftest ok  port=" + port);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
