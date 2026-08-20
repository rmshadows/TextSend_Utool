"use strict";

const C = require("./constants");

class AuthLimiter {
    constructor() {
        this.map = new Map();
    }

    allow(ip) {
        if (!ip) {
            return true;
        }
        const w = this.map.get(ip);
        if (!w) {
            return true;
        }
        return w.lockUntil <= Date.now();
    }

    fail(ip) {
        if (!ip) {
            return;
        }
        let w = this.map.get(ip);
        if (!w) {
            w = { fails: 0, lockUntil: 0 };
            this.map.set(ip, w);
        }
        if (w.lockUntil > Date.now()) {
            return;
        }
        w.fails++;
        if (w.fails >= C.PIN_FAIL_MAX) {
            w.lockUntil = Date.now() + C.PIN_LOCK_MS;
            w.fails = 0;
            console.log("Log: auth lock " + ip + " for " + (C.PIN_LOCK_MS / 1000) + "s");
        }
    }

    ok(ip) {
        if (ip) {
            this.map.delete(ip);
        }
    }
}

module.exports = { AuthLimiter };
