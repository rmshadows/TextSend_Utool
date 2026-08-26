"use strict";

const profile = require("./profile");
const { TsServer } = require("./protocol/server");
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

function createTsServer(port, maxConnections = 1, customEnabled = false, customPin = "") {
    closeAllServers();
    profile.startStatus = 0;
    const server = new TsServer(Number(port), maxConnections, pasteIncoming, fileQueue.fileIo(), {
        customEnabled: !!customEnabled,
        customPin: String(customPin || ""),
    });
    profile.currentServer = server;
    server.listen().then(() => {
        profile.startStatus = 1;
    }).catch((e) => {
        console.log("createTsServer: " + e);
        profile.startStatus = 2;
        closeAllServers();
    });
}

function closeAllServers() {
    if (profile.currentServer) {
        try {
            profile.currentServer.stop();
        } catch (e) {
            console.log("closeAllServers: " + e);
        }
        profile.currentServer = null;
    }
    profile.clearText = false;
}

async function ssend(msgString) {
    const s = profile.currentServer;
    if (!s) {
        return 0;
    }
    const n = await s.sendToAll(msgString);
    if (n > 0) {
        profile.clearText = true;
    }
    return n;
}

module.exports = {
    createTsServer,
    closeAllServers,
    ssend,
};
