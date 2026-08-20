"use strict";

const profile = {
    startStatus: -1,
    clearText: false,
    currentServer: null,
    currentClient: null,
    readyCount() {
        let n = 0;
        if (this.currentServer) {
            n += this.currentServer.readyCount();
        }
        if (this.currentClient && this.currentClient.isAlive()) {
            n += 1;
        }
        return n;
    },
    serverCount() {
        return this.currentServer && this.currentServer.running ? 1 : 0;
    },
};

module.exports = profile;
