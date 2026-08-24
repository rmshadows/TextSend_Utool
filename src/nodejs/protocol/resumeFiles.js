"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const C = require("./constants");
const FileIds = require("./fileIds");

const PART_SUFFIX = ".textsend.part";
const META_SUFFIX = ".textsend.json";

function partPath(dir, name) {
    return path.join(dir, name + PART_SUFFIX);
}

function metaPath(dir, name) {
    return path.join(dir, name + META_SUFFIX);
}

function align(written) {
    if (written <= 0) {
        return 0;
    }
    return Math.floor(written / C.FILE_CHUNK) * C.FILE_CHUNK;
}

function hasIncomplete(dir) {
    if (!dir || !fs.existsSync(dir)) {
        return false;
    }
    try {
        const walk = (d) => {
            for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
                const n = ent.name;
                if (n.endsWith(PART_SUFFIX) || n.endsWith(META_SUFFIX)) {
                    return true;
                }
                if (ent.isDirectory()) {
                    if (walk(path.join(d, n))) {
                        return true;
                    }
                }
            }
            return false;
        };
        return walk(dir);
    } catch (e) {
        return false;
    }
}

function headLen(size) {
    if (size <= 0) {
        return 0;
    }
    return Math.min(C.FILE_CHUNK, size);
}

function isSha256Hex(s) {
    return typeof s === "string" && /^[0-9a-fA-F]{64}$/.test(s);
}

function sha256Range(filePath, offset, length) {
    const d = crypto.createHash("sha256");
    if (length <= 0) {
        return FileIds.shaHex(d.digest());
    }
    const fd = fs.openSync(filePath, "r");
    try {
        const buf = Buffer.alloc(8192);
        let pos = offset;
        let left = length;
        while (left > 0) {
            const n = fs.readSync(fd, buf, 0, Math.min(buf.length, left), pos);
            if (n <= 0) {
                throw new Error("读取不足");
            }
            d.update(buf.subarray(0, n));
            pos += n;
            left -= n;
        }
    } finally {
        fs.closeSync(fd);
    }
    return FileIds.shaHex(d.digest());
}

function sha256Head(filePath, size) {
    return sha256Range(filePath, 0, headLen(size));
}

function sha256Tail(filePath, size) {
    const n = headLen(size);
    return sha256Range(filePath, Math.max(0, size - n), n);
}

function sha256Prefix(filePath, length) {
    const d = crypto.createHash("sha256");
    if (length <= 0) {
        return FileIds.shaHex(d.digest());
    }
    const fd = fs.openSync(filePath, "r");
    try {
        const buf = Buffer.alloc(64 * 1024);
        let pos = 0;
        let left = length;
        while (left > 0) {
            const n = fs.readSync(fd, buf, 0, Math.min(buf.length, left), pos);
            if (n <= 0) {
                throw new Error("前缀不足");
            }
            d.update(buf.subarray(0, n));
            pos += n;
            left -= n;
        }
    } finally {
        fs.closeSync(fd);
    }
    return FileIds.shaHex(d.digest());
}

function save(dir, name, size, written, nextIndex, headSha, tailSha) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        const o = { name, size, written, nextIndex };
        if (isSha256Hex(headSha)) {
            o.headSha256 = headSha.toLowerCase();
        }
        if (isSha256Hex(tailSha)) {
            o.tailSha256 = tailSha.toLowerCase();
        }
        fs.writeFileSync(metaPath(dir, name), JSON.stringify(o), "utf8");
    } catch (e) {
        console.log("Log: resume save failed: " + (e && e.message ? e.message : e));
    }
}

function load(dir, name, size) {
    const meta = metaPath(dir, name);
    const part = partPath(dir, name);
    if (!fs.existsSync(meta) || !fs.existsSync(part)) {
        return null;
    }
    try {
        const o = JSON.parse(fs.readFileSync(meta, "utf8"));
        if (Number(o.size) !== Number(size)) {
            return null;
        }
        return o;
    } catch (e) {
        return null;
    }
}

function identityMatches(saved, part, size, headSha, tailSha) {
    if (!isSha256Hex(headSha) || !isSha256Hex(tailSha)) {
        return false;
    }
    const storedHead = saved && saved.headSha256 ? String(saved.headSha256) : null;
    if (isSha256Hex(storedHead)) {
        if (storedHead.toLowerCase() !== headSha.toLowerCase()) {
            return false;
        }
    } else {
        const n = headLen(size);
        if (n > 0) {
            try {
                if (!fs.existsSync(part) || fs.statSync(part).size < n) {
                    return false;
                }
                if (headSha.toLowerCase() !== sha256Head(part, n).toLowerCase()) {
                    return false;
                }
            } catch (e) {
                return false;
            }
        }
    }
    const storedTail = saved && saved.tailSha256 ? String(saved.tailSha256) : null;
    return isSha256Hex(storedTail) && storedTail.toLowerCase() === tailSha.toLowerCase();
}

function del(dir, name) {
    try {
        fs.rmSync(partPath(dir, name), { force: true });
        fs.rmSync(metaPath(dir, name), { force: true });
    } catch (e) {
        /* ignore */
    }
}

module.exports = {
    PART_SUFFIX,
    META_SUFFIX,
    partPath,
    metaPath,
    align,
    hasIncomplete,
    headLen,
    isSha256Hex,
    sha256Head,
    sha256Tail,
    sha256Prefix,
    save,
    load,
    identityMatches,
    delete: del,
};
