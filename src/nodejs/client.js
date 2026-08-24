"use strict";

const profile = require("./profile");
const protoClient = require("./protocol/client");
const fileQueue = require("./fileQueue");

function pasteIncoming(text) {
    try {
        if (typeof utools !== "undefined") {
            utools.copyText(text);
            utools.hideMainWindowTypeString(text);
        }
    } catch (e) {
        console.log("pasteIncoming: " + e);
    }
}

function createTsClient(raw) {
    disconnectServer();
    profile.startStatus = 0;
    protoClient.connect(raw, pasteIncoming, fileQueue.fileIo()).then((peer) => {
        profile.currentClient = peer;
        fileQueue.attachPeer(peer);
        profile.startStatus = 1;
        console.log("Log: client session ready");
    }).catch((e) => {
        console.log("Client error: " + e);
        profile.currentClient = null;
        profile.startStatus = 2;
    });
}

function disconnectServer() {
    if (profile.currentClient) {
        try {
            profile.currentClient.close();
        } catch (e) {
            console.log("disconnectServer: " + e);
        }
        profile.currentClient = null;
    }
    profile.startStatus = -1;
    profile.clearText = false;
}

async function csend(msgString) {
    const p = profile.currentClient;
    if (!p || !p.isAlive()) {
        return;
    }
    await p.sendText(msgString);
    profile.clearText = true;
}

module.exports = {
    createTsClient,
    disconnectServer,
    csend,
};
