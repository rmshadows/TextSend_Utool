"use strict";

const fs = require("fs");
const path = require("path");
const C = require("./protocol/constants");
const FileNames = require("./protocol/fileNames");
const profile = require("./profile");

const state = {
    items: [],
    busy: false,
    cancelFlag: false,
    progress: null,
    message: "",
    eventSeq: 0,
    event: null,
    lastBytes: 0,
    lastAt: 0,
    speed: 0,
};

function alivePeers() {
    const out = [];
    if (profile.currentClient && profile.currentClient.isAlive()) {
        out.push(profile.currentClient);
    }
    if (profile.currentServer) {
        for (const p of profile.currentServer.peers || []) {
            if (p.isAlive()) {
                out.push(p);
            }
        }
    }
    return out;
}

function fileIo() {
    return {
        onProgress(incoming, name, done, total, seq, of) {
            const now = Date.now();
            if (!state.progress || state.progress.name !== name || state.progress.incoming !== incoming) {
                state.lastBytes = done;
                state.lastAt = now;
                state.speed = 0;
            } else if (now - state.lastAt >= 200) {
                const dt = (now - state.lastAt) / 1000;
                if (dt > 0) {
                    state.speed = Math.max(0, (done - state.lastBytes) / dt);
                }
                state.lastBytes = done;
                state.lastAt = now;
            }
            state.progress = {
                incoming: !!incoming,
                name: name || "",
                done: Number(done) || 0,
                total: Number(total) || 0,
                seq: Number(seq) || 0,
                of: Number(of) || 0,
                speed: state.speed,
                phase: "",
            };
        },
        onAwaiting(incoming, name, total, seq, of) {
            const now = Date.now();
            state.progress = {
                incoming: !!incoming,
                name: name || "",
                done: Number(total) || 0,
                total: Number(total) || 0,
                seq: Number(seq) || 0,
                of: Number(of) || 0,
                speed: state.speed,
                phase: "awaiting",
            };
            state.lastAt = now;
        },
        onReceived(name, where) {
            const last = state.progress;
            state.progress = null;
            state.speed = 0;
            if (!last || last.of <= 1 || last.seq === last.of) {
                pushEvent("ok", name + " → " + where);
            }
        },
        onReceiveFailed(name, err) {
            if (!state.busy) {
                state.progress = null;
            }
            pushEvent("err", (name ? name + "：" : "") + (err || "失败"));
        },
    };
}

function attachPeer(peer) {
    if (peer && peer.setFileIo) {
        peer.setFileIo(fileIo());
    }
}

function pushEvent(type, text) {
    state.eventSeq++;
    state.event = { seq: state.eventSeq, type, text: String(text || "") };
    state.message = String(text || "");
}

function snapshot() {
    return {
        items: state.items.map((it) => ({
            id: it.id,
            name: it.name,
            path: it.path,
            tree: it.tree || "",
            rel: it.rel || "",
            size: it.size,
        })),
        busy: state.busy,
        progress: state.progress,
        message: state.message,
        event: state.event,
        inboxDir: FileNames.inboxDir(),
    };
}

function fileKey(p) {
    return path.resolve(p);
}

let nextId = 1;

function addFiles(paths) {
    const flat = state.items.filter((it) => !it.tree).length;
    let added = 0;
    let skip = 0;
    const have = new Set(state.items.map((it) => fileKey(it.path)));
    for (const raw of paths || []) {
        const p = String(raw);
        if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
            continue;
        }
        if (have.has(fileKey(p))) {
            skip++;
            continue;
        }
        if (flat + added >= C.FILE_BATCH_MAX) {
            pushEvent("err", "扁文件最多 " + C.FILE_BATCH_MAX + " 个");
            break;
        }
        const st = fs.statSync(p);
        state.items.push({
            id: nextId++,
            path: p,
            name: path.basename(p),
            size: st.size,
            tree: null,
            rel: null,
        });
        have.add(fileKey(p));
        added++;
    }
    if (added > 0) {
        pushEvent("ok", "已加入 " + added + " 个文件" + (skip ? "，跳过重复 " + skip : ""));
        if (state.busy) {
            /* 发送中追加：当前循环会读最新 items，见 sendLoop */
        }
    }
    return added;
}

function walkFolder(root) {
    const files = [];
    const rels = [];
    const rootPath = path.resolve(root);
    const walk = (dir, relBase) => {
        let ents;
        try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            return;
        }
        for (const ent of ents) {
            const name = ent.name;
            if (FileNames.skipJunk(name)) {
                continue;
            }
            const full = path.join(dir, name);
            let isLink = false;
            try {
                isLink = fs.lstatSync(full).isSymbolicLink();
            } catch (e) {
                continue;
            }
            if (isLink) {
                continue;
            }
            if (ent.isDirectory()) {
                walk(full, relBase ? relBase + "/" + name : name);
                continue;
            }
            if (!ent.isFile()) {
                continue;
            }
            const rel = FileNames.sanitizeRelPath(relBase ? relBase + "/" + name : name);
            if (!rel) {
                continue;
            }
            files.push(full);
            rels.push(rel);
        }
    };
    walk(rootPath, "");
    return { files, rels };
}

function addFolders(paths) {
    let files = 0;
    let trees = 0;
    for (const raw of paths || []) {
        const p = String(raw);
        if (!p || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
            continue;
        }
        const treeName = FileNames.sanitize(path.basename(p));
        const walked = walkFolder(p);
        if (walked.files.length === 0) {
            pushEvent("err", treeName + " 是空的或无法读取");
            continue;
        }
        const have = new Set(state.items.map((it) => fileKey(it.path)));
        let added = 0;
        for (let i = 0; i < walked.files.length; i++) {
            const fp = walked.files[i];
            if (have.has(fileKey(fp))) {
                continue;
            }
            const st = fs.statSync(fp);
            state.items.push({
                id: nextId++,
                path: fp,
                name: path.basename(fp),
                size: st.size,
                tree: treeName,
                rel: walked.rels[i],
            });
            have.add(fileKey(fp));
            added++;
        }
        if (added > 0) {
            files += added;
            trees++;
        }
    }
    if (files > 0) {
        pushEvent("ok", trees === 1
            ? "已加入文件夹（" + files + " 个文件）"
            : "已加入 " + trees + " 个文件夹（" + files + " 个文件）");
    }
    return files;
}

function addDropped(paths) {
    const files = [];
    const folders = [];
    for (const raw of paths || []) {
        const p = String(raw);
        if (!p || !fs.existsSync(p)) {
            continue;
        }
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            folders.push(p);
        } else if (st.isFile()) {
            files.push(p);
        }
    }
    let n = 0;
    if (files.length) {
        n += addFiles(files);
    }
    if (folders.length) {
        n += addFolders(folders);
    }
    return n;
}

function removeIds(ids) {
    const set = new Set((ids || []).map((x) => Number(x)));
    const before = state.items.length;
    state.items = state.items.filter((it) => !set.has(it.id));
    return before - state.items.length;
}

function clearQueue() {
    if (state.busy) {
        return 0;
    }
    const n = state.items.length;
    state.items = [];
    return n;
}

function cancelCurrent() {
    state.cancelFlag = true;
    for (const p of alivePeers()) {
        try {
            p.cancelFile();
        } catch (e) {
            /* ignore */
        }
    }
}

async function sendOne(item, seq, of) {
    const peers = alivePeers();
    if (peers.length === 0) {
        throw new Error("未连接");
    }
    const targets = peers.filter((p) => p.supportsFile && p.supportsFile());
    if (targets.length === 0) {
        throw new Error("对端不支持文件传输");
    }
    for (const p of targets) {
        p.prepareOutgoingSend();
    }
    const cancelled = () => state.cancelFlag;
    if (targets.length === 1) {
        await targets[0].sendFile(item.path, cancelled, item.tree, item.rel, seq, of);
        return 1;
    }
    const size = item.size;
    const peerBytes = targets.map(() => 0);
    const orig = targets.map((p) => p.onFileIo);
    const io = fileIo();
    targets.forEach((p, i) => {
        p.setFileIo({
            onProgress(incoming, name, done, total, s, o) {
                if (incoming) {
                    if (orig[i]) {
                        orig[i].onProgress(true, name, done, total, s, o);
                    }
                    return;
                }
                peerBytes[i] = done;
                const sum = peerBytes.reduce((a, b) => a + b, 0);
                io.onProgress(false, name, sum, size * targets.length, s, o);
            },
            onAwaiting(incoming, name, total, s, o) {
                if (!incoming) {
                    io.onAwaiting(false, name, size * targets.length, s, o);
                } else if (orig[i] && orig[i].onAwaiting) {
                    orig[i].onAwaiting(true, name, total, s, o);
                }
            },
            onReceived(name, where) {
                if (orig[i]) {
                    orig[i].onReceived(name, where);
                }
            },
            onReceiveFailed(name, err) {
                if (orig[i]) {
                    orig[i].onReceiveFailed(name, err);
                }
            },
        });
    });
    try {
        const results = await Promise.allSettled(
            targets.map((p) => p.sendFile(item.path, cancelled, item.tree, item.rel, seq, of))
        );
        let sent = 0;
        let lastErr = null;
        for (const r of results) {
            if (r.status === "fulfilled") {
                sent++;
            } else {
                lastErr = r.reason;
                const msg = r.reason && r.reason.message ? r.reason.message : "";
                if (msg === "cancelled") {
                    throw r.reason;
                }
            }
        }
        if (sent === 0 && lastErr) {
            throw lastErr;
        }
        return sent;
    } finally {
        targets.forEach((p, i) => {
            if (orig[i]) {
                p.setFileIo(orig[i]);
            }
        });
    }
}

async function sendOnePath(filePath) {
    const p = String(filePath || "");
    if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
        throw new Error("图片已失效");
    }
    if (state.busy) {
        throw new Error("正在发送");
    }
    const st = fs.statSync(p);
    const item = {
        id: nextId++,
        path: p,
        name: path.basename(p),
        size: st.size,
        tree: null,
        rel: null,
    };
    state.busy = true;
    state.cancelFlag = false;
    try {
        const n = await sendOne(item, 0, 0);
        if (n > 1) {
            pushEvent("ok", item.name + " 已发给 " + n + " 端");
        } else {
            pushEvent("ok", item.name + " 已发送");
        }
        return n;
    } finally {
        state.busy = false;
        state.progress = null;
        state.cancelFlag = false;
        state.speed = 0;
    }
}

async function sendLoop() {
    if (state.busy) {
        return;
    }
    if (state.items.length === 0) {
        pushEvent("err", "待发列表是空的");
        return;
    }
    state.busy = true;
    state.cancelFlag = false;
    let sentCount = 0;
    let lastName = "";
    let lastPeers = 1;
    let failed = false;
    try {
        while (state.items.length > 0) {
            if (state.cancelFlag) {
                pushEvent("err", "已取消");
                failed = true;
                break;
            }
            const item = state.items[0];
            const ofNow = sentCount + state.items.length;
            const seq = ofNow > 1 ? sentCount + 1 : 0;
            const of = ofNow > 1 ? ofNow : 0;
            try {
                const n = await sendOne(item, seq, of);
                state.items.shift();
                sentCount++;
                lastName = item.name;
                lastPeers = n;
            } catch (e) {
                const msg = e && e.message ? e.message : String(e);
                failed = true;
                if (msg === "cancelled") {
                    pushEvent("err", "已取消");
                    break;
                }
                pushEvent("err", item.name + "：" + msg);
                break;
            }
        }
        if (!failed && sentCount > 0) {
            if (lastPeers > 1) {
                pushEvent("ok", lastName + " 已发给 " + lastPeers + " 端");
            } else if (sentCount === 1) {
                pushEvent("ok", lastName + " 已发送");
            } else {
                pushEvent("ok", "已发送 " + sentCount + " 个文件");
            }
        }
    } finally {
        state.busy = false;
        state.progress = null;
        state.cancelFlag = false;
        state.speed = 0;
    }
}

async function dialogPaths(opts) {
    if (typeof utools === "undefined" || typeof utools.showOpenDialog !== "function") {
        throw new Error("当前 uTools 不支持文件选择框");
    }
    const r = utools.showOpenDialog(opts);
    const list = r && typeof r.then === "function" ? await r : r;
    return list || [];
}

function pickFiles() {
    return dialogPaths({
        title: "选择要发送的文件",
        properties: ["openFile", "multiSelections"],
    });
}

function pickFolders() {
    return dialogPaths({
        title: "选择要发送的文件夹",
        properties: ["openDirectory", "multiSelections"],
    });
}

function openInbox() {
    const dir = FileNames.inboxDir();
    try {
        if (typeof utools !== "undefined" && typeof utools.shellOpenPath === "function") {
            utools.shellOpenPath(dir);
        }
    } catch (e) {
        /* ignore */
    }
    return dir;
}

module.exports = {
    snapshot,
    addFiles,
    addFolders,
    addDropped,
    removeIds,
    clearQueue,
    cancelCurrent,
    sendLoop,
    sendOnePath,
    pickFiles,
    pickFolders,
    openInbox,
    attachPeer,
    fileIo,
};
