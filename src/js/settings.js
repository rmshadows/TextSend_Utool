import { getDefaultIpAddr } from "./tsc.js";

/** uTools dbStorage 设置（经 preload 暴露的 window API） */

export function getAutoStartServer() {
    if (typeof window.getAutoStartServer === "function") {
        return !!window.getAutoStartServer();
    }
    return false;
}

export function setAutoStartServer(v) {
    if (typeof window.setAutoStartServer === "function") {
        window.setAutoStartServer(!!v);
    }
}

export function getSavedListenIp() {
    if (typeof window.getListenIp === "function") {
        return String(window.getListenIp() || "").trim();
    }
    return "";
}

export function setSavedListenIp(ip) {
    const s = String(ip || "").trim();
    if (s && typeof window.setListenIp === "function") {
        window.setListenIp(s);
    }
}

export function getSavedListenPort() {
    if (typeof window.getListenPort === "function") {
        const n = Number(window.getListenPort());
        if (Number.isFinite(n) && n >= 1 && n <= 65535) {
            return n;
        }
    }
    return 54300;
}

export function setSavedListenPort(port) {
    const n = Number(port);
    if (Number.isFinite(n) && n >= 1 && n <= 65535 && typeof window.setListenPort === "function") {
        window.setListenPort(n);
    }
}

/** 优先用保存的 IP；不在当前网卡列表则回退启发式默认 */
export function resolveListenIp(ipList) {
    const list = Array.isArray(ipList) ? ipList : [];
    const vals = list.map((x) => String(x.value || x));
    const saved = getSavedListenIp();
    if (saved && vals.includes(saved)) {
        return saved;
    }
    return getDefaultIpAddr(list);
}

export function isValidPin(pin) {
    return /^\d{8}$/.test(String(pin || "").trim());
}

export function getCustomPinEnabled() {
    if (typeof window.getCustomPinEnabled === "function") {
        return !!window.getCustomPinEnabled();
    }
    return false;
}

export function setCustomPinEnabled(v) {
    if (typeof window.setCustomPinEnabled === "function") {
        window.setCustomPinEnabled(!!v);
    }
}

export function getCustomPin() {
    if (typeof window.getCustomPin === "function") {
        const pin = String(window.getCustomPin() || "").trim();
        return isValidPin(pin) ? pin : "";
    }
    return "";
}

export function setCustomPin(pin) {
    const s = String(pin || "").trim();
    if (s && !isValidPin(s)) {
        return false;
    }
    if (typeof window.setCustomPin === "function") {
        return window.setCustomPin(s) !== false;
    }
    return false;
}

export function getLanDiscover() {
    if (typeof window.getLanDiscover === "function") {
        return !!window.getLanDiscover();
    }
    return false;
}

export function setLanDiscover(v) {
    if (typeof window.setLanDiscover === "function") {
        window.setLanDiscover(!!v);
    }
}

export function getLanDiscoverPause() {
    if (typeof window.getLanDiscoverPause === "function") {
        return !!window.getLanDiscoverPause();
    }
    return false;
}

export function setLanDiscoverPause(v) {
    if (typeof window.setLanDiscoverPause === "function") {
        window.setLanDiscoverPause(!!v);
    }
}

export function getLanDiscoverPort() {
    if (typeof window.getLanDiscoverPort === "function") {
        const n = Number(window.getLanDiscoverPort());
        if (Number.isFinite(n) && n >= 1 && n <= 65535) {
            return n;
        }
    }
    return 54300;
}

export function setLanDiscoverPort(port) {
    const n = Number(port);
    if (!Number.isFinite(n) || n < 1 || n > 65535) {
        return false;
    }
    if (typeof window.setLanDiscoverPort === "function") {
        return window.setLanDiscoverPort(n) !== false;
    }
    return false;
}

export function getMaxClients() {
    if (typeof window.getMaxClients === "function") {
        const n = Number(window.getMaxClients());
        if (Number.isFinite(n) && n >= 1 && n <= 64) {
            return n;
        }
    }
    return 7;
}

export function setMaxClients(n) {
    if (typeof window.setMaxClients === "function") {
        return window.setMaxClients(n) !== false;
    }
    return false;
}

export function getAuthRatePerMin() {
    if (typeof window.getAuthRatePerMin === "function") {
        const n = Number(window.getAuthRatePerMin());
        if (Number.isFinite(n) && n >= 1 && n <= 60) {
            return n;
        }
    }
    return 3;
}

export function setAuthRatePerMin(n) {
    if (typeof window.setAuthRatePerMin === "function") {
        return window.setAuthRatePerMin(n) !== false;
    }
    return false;
}

export function getAuthCooldownSec() {
    if (typeof window.getAuthCooldownSec === "function") {
        const n = Number(window.getAuthCooldownSec());
        if (Number.isFinite(n) && n >= 0 && n <= 86400) {
            return n;
        }
    }
    return 120;
}

export function setAuthCooldownSec(n) {
    if (typeof window.setAuthCooldownSec === "function") {
        return window.setAuthCooldownSec(n) !== false;
    }
    return false;
}

export function getAuthBlacklistText() {
    if (typeof window.getAuthBlacklistText === "function") {
        return String(window.getAuthBlacklistText() || "");
    }
    return "";
}

export function setAuthBlacklistText(text) {
    if (typeof window.setAuthBlacklistText === "function") {
        window.setAuthBlacklistText(text);
    }
}

export function getRememberClientConnection() {
    if (typeof window.getRememberClientConnection === "function") {
        return !!window.getRememberClientConnection();
    }
    return false;
}

export function setRememberClientConnection(v) {
    if (typeof window.setRememberClientConnection === "function") {
        window.setRememberClientConnection(!!v);
    }
}

export function formatSavedClientRaw() {
    if (typeof window.formatSavedClientRaw === "function") {
        return String(window.formatSavedClientRaw() || "").trim();
    }
    return "";
}

export function saveClientConnectionFromRaw(raw) {
    if (typeof window.trySaveClientConnection === "function") {
        window.trySaveClientConnection(raw);
    }
}

export function prefillClientConnectionIfNeeded(setInput) {
    if (typeof setInput !== "function" || !getRememberClientConnection()) {
        return;
    }
    const raw = formatSavedClientRaw();
    if (raw) {
        setInput(raw);
    }
}
