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

function listenFailMessage(err, port) {
    const code = err && err.code ? String(err.code) : "";
    const msg = err && err.message ? String(err.message) : String(err || "");
    if (code === "EADDRINUSE" || /EADDRINUSE/i.test(msg)) {
        return "端口 " + port + " 已被占用（本机可能已开着电脑版 TextSend）";
    }
    if (code === "EACCES" || /EACCES/i.test(msg)) {
        return "没有权限监听端口 " + port;
    }
    return msg ? ("服务启动失败：" + msg) : "服务启动失败。";
}

function createTsServer(port, maxConnections = 1, customEnabled = false, customPin = "") {
    closeAllServers();
    profile.startStatus = 0;
    profile.startError = "";
    const listenPort = Number(port);
    const server = new TsServer(listenPort, maxConnections, pasteIncoming, fileQueue.fileIo(), {
        customEnabled: !!customEnabled,
        customPin: String(customPin || ""),
    });
    profile.currentServer = server;
    server.listen().then(() => {
        profile.startStatus = 1;
        profile.startError = "";
    }).catch((e) => {
        console.log("createTsServer: " + e);
        profile.startError = listenFailMessage(e, listenPort);
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
