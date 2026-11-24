"use strict";

/**
 * 本机根证书和网页桥 C 档服务器证书。纯 Node crypto，不引入额外依赖。
 * 根可选。装进系统信任后浏览器不再提示不受信任。
 * 文件在 ~/.textsend-utools/textsend-ca/。PKCS#12 口令 textsend-lan。
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");

const STORE_PASS = "textsend-lan";
const PBE_ITER = 2048;

const OID_RSA = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
const OID_SHA256_RSA = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]);
const OID_CN = Buffer.from([0x55, 0x04, 0x03]);
const OID_BC = Buffer.from([0x55, 0x1d, 0x13]);
const OID_KU = Buffer.from([0x55, 0x1d, 0x0f]);
const OID_SKI = Buffer.from([0x55, 0x1d, 0x0e]);
const OID_AKI = Buffer.from([0x55, 0x1d, 0x23]);
const OID_EKU = Buffer.from([0x55, 0x1d, 0x25]);
const OID_SAN = Buffer.from([0x55, 0x1d, 0x11]);
const OID_SERVER_AUTH = Buffer.from([0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x01]);
const OID_DATA = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);
const OID_PBE_3DES = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x0c, 0x01, 0x03]);
const OID_CERT_BAG = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x0c, 0x0a, 0x01, 0x03]);
const OID_SHROUDED = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x0c, 0x0a, 0x01, 0x02]);
const OID_X509_BAG = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x16, 0x01]);
const OID_FRIENDLY = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x14]);
const OID_LOCAL_KEY = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x15]);
const OID_SHA1 = Buffer.from([0x2b, 0x0e, 0x03, 0x02, 0x1a]);

function certDir() {
    const dir = path.join(os.homedir() || ".", ".textsend-utools", "textsend-ca");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function material() {
    const dir = certDir();
    const caKeyFile = path.join(dir, "ca.key");
    const caCertFile = path.join(dir, "ca.crt");
    const keyFile = path.join(dir, "server.key");
    const certFile = path.join(dir, "server.crt");
    const p12File = path.join(dir, "server.p12");
    const sansFile = path.join(dir, "server.sans");
    const ca = loadOrCreateCa(caKeyFile, caCertFile);
    const caCert = new crypto.X509Certificate(fs.readFileSync(caCertFile));
    const sans = hostNames().join(",");
    let leafKey = null;
    let leafPem = null;
    let reuse = fs.existsSync(keyFile) && fs.existsSync(certFile) && fs.existsSync(sansFile)
        && sans === fs.readFileSync(sansFile, "utf8").trim();
    if (reuse) {
        try {
            leafKey = crypto.createPrivateKey(fs.readFileSync(keyFile));
            leafPem = fs.readFileSync(certFile);
            const leaf = new crypto.X509Certificate(leafPem);
            const pub = crypto.createPublicKey(leafKey).export({ type: "spki", format: "der" });
            const certPub = leaf.publicKey.export({ type: "spki", format: "der" });
            const renewAt = Date.now() + 7 * 24 * 3600 * 1000;
            reuse = pub.equals(certPub)
                && leaf.verify(ca.publicKey)
                && new Date(leaf.validTo).getTime() > renewAt;
        } catch (e) {
            reuse = false;
        }
    }
    if (!reuse) {
        const server = rsa();
        leafKey = server.privateKey;
        const der = sign(ca.privateKey, caCert, server.publicKey, "TextSend", false, hostNames());
        const leaf = new crypto.X509Certificate(der);
        if (!leaf.verify(ca.publicKey)) {
            throw new Error("服务器证书校验失败");
        }
        leafPem = pem("CERTIFICATE", der);
        fs.writeFileSync(keyFile, server.privateKey.export({ type: "pkcs8", format: "pem" }));
        fs.writeFileSync(certFile, leafPem);
        fs.writeFileSync(sansFile, sans + "\n");
        tighten(keyFile);
        const p12 = buildP12(server.privateKey.export({ type: "pkcs8", format: "der" }), [der, caCert.raw]);
        fs.writeFileSync(p12File, p12);
        tighten(p12File);
    }
    const keyPem = fs.readFileSync(keyFile);
    const certPem = fs.readFileSync(certFile);
    const caPem = fs.readFileSync(caCertFile);
    return {
        key: keyPem,
        cert: Buffer.concat([certPem, Buffer.from("\n"), caPem]),
        ca: caPem,
        caPath: caCertFile,
        p12Path: p12File,
        passphrase: STORE_PASS,
        fingerprint: fingerprint(new crypto.X509Certificate(caPem)),
    };
}

function caCertificatePath() {
    return material().caPath;
}

function loadOrCreateCa(keyFile, certFile) {
    if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
        try {
            const key = crypto.createPrivateKey(fs.readFileSync(keyFile));
            const cert = new crypto.X509Certificate(fs.readFileSync(certFile));
            const pub = crypto.createPublicKey(key).export({ type: "spki", format: "der" });
            const certPub = cert.publicKey.export({ type: "spki", format: "der" });
            if (pub.equals(certPub) && cert.verify(cert.publicKey)) {
                return { privateKey: key, publicKey: cert.publicKey };
            }
        } catch (e) {
            /* 重新签发 */
        }
    }
    const ca = rsa();
    const der = sign(ca.privateKey, null, ca.publicKey, "TextSend LAN CA", true, []);
    const cert = new crypto.X509Certificate(der);
    if (!cert.verify(ca.publicKey)) {
        throw new Error("根证书校验失败");
    }
    fs.writeFileSync(keyFile, ca.privateKey.export({ type: "pkcs8", format: "pem" }));
    fs.writeFileSync(certFile, pem("CERTIFICATE", der));
    tighten(keyFile);
    return { privateKey: ca.privateKey, publicKey: ca.publicKey };
}

function sign(issuerKey, issuerCert, subjectKey, cn, ca, hosts) {
    const serial = crypto.randomBytes(16);
    serial[0] &= 0x7f;
    const now = new Date(Date.now() - 300 * 1000);
    const until = new Date(now.getTime() + (ca ? 3650 : 825) * 24 * 3600 * 1000);
    const spki = subjectKey.export({ type: "spki", format: "der" });
    const ski = crypto.createHash("sha1").update(bitStringContent(spki)).digest();
    let aki = null;
    if (!ca) {
        const issuerSpki = issuerCert.publicKey.export({ type: "spki", format: "der" });
        aki = crypto.createHash("sha1").update(bitStringContent(issuerSpki)).digest();
    }
    const issuerCn = ca ? cn : "TextSend LAN CA";
    const tbs = tbsCertificate(serial, issuerCn, cn, utc(now), utc(until), spki, ca, hosts, ski, aki);
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(tbs);
    const signature = signer.sign(issuerKey);
    return seq(concat([tbs, algId(), bitString(signature)]));
}

function tbsCertificate(serial, issuerCn, subjectCn, notBefore, notAfter, spki, ca, hosts, ski, aki) {
    const exts = [];
    exts.push(extension(OID_BC, true, basicConstraints(ca)));
    exts.push(extension(OID_KU, true, keyUsage(ca)));
    exts.push(extension(OID_SKI, false, octet(ski)));
    if (aki) {
        exts.push(extension(OID_AKI, false, akiSeq(aki)));
    }
    if (!ca) {
        exts.push(extension(OID_EKU, false, ekuServer()));
        exts.push(extension(OID_SAN, false, san(hosts)));
    }
    const validity = seq(concat([utcTime(notBefore), utcTime(notAfter)]));
    const extBytes = explicit(3, seq(concat(exts)));
    return seq(concat([
        explicit(0, integer(Buffer.from([2]))),
        integer(serial),
        algId(),
        name(issuerCn),
        validity,
        name(subjectCn),
        spki,
        extBytes,
    ]));
}

function hostNames() {
    const out = [];
    const seen = new Set();
    function add(host) {
        if (!host || seen.has(host)) {
            return;
        }
        seen.add(host);
        out.push(host);
    }
    add("localhost");
    add("127.0.0.1");
    const nics = os.networkInterfaces();
    for (const name of Object.keys(nics)) {
        for (const info of nics[name] || []) {
            let host = String(info.address || "").split("%")[0];
            if (!host || isMulticast(host, info) || isLinkLocal(host)) {
                continue;
            }
            const fam = info.family;
            if (fam === "IPv4" || fam === 4 || fam === "IPv6" || fam === 6) {
                add(host);
            }
        }
    }
    return out;
}

function isLinkLocal(host) {
    const h = host.toLowerCase();
    return h.startsWith("fe80") || host.startsWith("169.254.");
}

function isMulticast(host, info) {
    const fam = info.family;
    if (fam === "IPv4" || fam === 4) {
        const a = parseInt(host.split(".")[0], 10);
        return a >= 224 && a <= 239;
    }
    return host.toLowerCase().startsWith("ff");
}

function looksIp(host) {
    for (let i = 0; i < host.length; i++) {
        const c = host.charCodeAt(i);
        if (!((c >= 48 && c <= 57) || c === 46)) {
            return false;
        }
    }
    return host.length > 0;
}

function ipBytes(host) {
    if (net.isIPv4(host)) {
        return Buffer.from(host.split(".").map((n) => Number(n) & 255));
    }
    if (net.isIPv6(host) && host.indexOf(":") >= 0) {
        return ipv6Bytes(host);
    }
    return null;
}

function ipv6Bytes(host) {
    let h = host;
    const zone = h.indexOf("%");
    if (zone >= 0) {
        h = h.slice(0, zone);
    }
    const halves = h.split("::");
    if (halves.length > 2) {
        return null;
    }
    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    if (halves.length === 1 && head.length !== 8) {
        return null;
    }
    const missing = 8 - head.length - tail.length;
    if (halves.length === 2 && missing < 0) {
        return null;
    }
    const groups = halves.length === 2
        ? head.concat(Array(missing).fill("0")).concat(tail)
        : head;
    if (groups.length !== 8) {
        return null;
    }
    const out = Buffer.alloc(16);
    for (let i = 0; i < 8; i++) {
        const v = parseInt(groups[i] || "0", 16);
        if (!Number.isFinite(v) || v < 0 || v > 0xffff) {
            return null;
        }
        out[i * 2] = (v >> 8) & 255;
        out[i * 2 + 1] = v & 255;
    }
    return out;
}

function san(hosts) {
    const names = [];
    for (const host of hosts) {
        if (host.indexOf(":") >= 0 || looksIp(host)) {
            const raw = ipBytes(host);
            if (raw) {
                names.push(context(7, raw));
                continue;
            }
        }
        names.push(context(2, Buffer.from(host, "ascii")));
    }
    return seq(concat(names));
}

function basicConstraints(ca) {
    if (!ca) {
        return seq(Buffer.alloc(0));
    }
    return seq(Buffer.from([0x01, 0x01, 0xff]));
}

function keyUsage(ca) {
    if (ca) {
        return bitStringRaw(7, Buffer.from([0x06, 0x00]));
    }
    return bitStringRaw(7, Buffer.from([0xa0, 0x00]));
}

function ekuServer() {
    return seq(oid(OID_SERVER_AUTH));
}

function akiSeq(ski) {
    return seq(context(0, ski));
}

function extension(oidBody, critical, value) {
    const id = oid(oidBody);
    const wrapped = octet(value);
    if (critical) {
        return seq(concat([id, Buffer.from([0x01, 0x01, 0xff]), wrapped]));
    }
    return seq(concat([id, wrapped]));
}

function name(cn) {
    const atv = seq(concat([oid(OID_CN), printable(cn)]));
    return seq(set(atv));
}

function algId() {
    return seq(concat([oid(OID_SHA256_RSA), Buffer.from([0x05, 0x00])]));
}

function rsa() {
    return crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicExponent: 65537,
    });
}

function fingerprint(cert) {
    const dig = crypto.createHash("sha256").update(cert.raw).digest();
    return dig.toString("hex").toUpperCase().match(/.{2}/g).join(":");
}

function pem(kind, der) {
    const b64 = Buffer.from(der).toString("base64");
    const lines = b64.match(/.{1,64}/g) || [];
    return "-----BEGIN " + kind + "-----\n" + lines.join("\n") + "\n-----END " + kind + "-----\n";
}

function utc(date) {
    const p = (n) => String(n).padStart(2, "0");
    return p(date.getUTCFullYear() % 100)
        + p(date.getUTCMonth() + 1)
        + p(date.getUTCDate())
        + p(date.getUTCHours())
        + p(date.getUTCMinutes())
        + p(date.getUTCSeconds())
        + "Z";
}

function tighten(file) {
    try {
        fs.chmodSync(file, 0o600);
    } catch (e) {
        /* Windows 没有 POSIX 权限 */
    }
}

function bitStringContent(spki) {
    let p = valueAt(spki, 0);
    p = skip(spki, p);
    const bitLen = lengthAt(spki, p);
    const bitStart = valueAt(spki, p);
    return spki.subarray(bitStart + 1, bitStart + bitLen);
}

/** PKCS#12，口令 textsend-lan。证书袋 + 3DES 裹住的 PKCS#8，带 SHA-1 MAC。 */
function buildP12(pkcs8, certsDer) {
    const password = bmpPassword(STORE_PASS);
    const salt = crypto.randomBytes(8);
    const key = p12kdf(1, password, salt, PBE_ITER, 24);
    const iv = p12kdf(2, password, salt, PBE_ITER, 8);
    const cipher = crypto.createCipheriv("des-ede3-cbc", key, iv);
    const enc = Buffer.concat([cipher.update(pkcs8), cipher.final()]);
    const pbe = seq(concat([
        oid(OID_PBE_3DES),
        seq(concat([octet(salt), integer(Buffer.from([0x08, 0x00]))])),
    ]));
    const encInfo = seq(concat([pbe, octet(enc)]));
    const leafId = crypto.createHash("sha1").update(certsDer[0]).digest();
    const attrs = bagAttrs("textsend", leafId);
    const bags = [certBag(certsDer[0], attrs)];
    for (let i = 1; i < certsDer.length; i++) {
        bags.push(certBag(certsDer[i], null));
    }
    bags.push(safeBag(OID_SHROUDED, encInfo, attrs));
    const safeContents = seq(concat(bags));
    const authSafe = seq(contentInfoData(safeContents));
    const macSalt = crypto.randomBytes(8);
    const macKey = p12kdf(3, password, macSalt, PBE_ITER, 20);
    const mac = crypto.createHmac("sha1", macKey).update(authSafe).digest();
    const macInfo = seq(concat([
        seq(concat([
            seq(concat([oid(OID_SHA1), Buffer.from([0x05, 0x00])])),
            octet(mac),
        ])),
        octet(macSalt),
        integer(Buffer.from([0x08, 0x00])),
    ]));
    return seq(concat([
        integer(Buffer.from([3])),
        contentInfoData(authSafe),
        macInfo,
    ]));
}

function certBag(der, attrs) {
    const value = seq(concat([oid(OID_X509_BAG), explicit(0, octet(der))]));
    return safeBag(OID_CERT_BAG, value, attrs);
}

function safeBag(bagOid, bagValue, attrs) {
    const parts = [oid(bagOid), explicit(0, bagValue)];
    if (attrs) {
        parts.push(attrs);
    }
    return seq(concat(parts));
}

function bagAttrs(name, keyId) {
    return set(concat([
        seq(concat([oid(OID_FRIENDLY), set(bmpString(name))])),
        seq(concat([oid(OID_LOCAL_KEY), set(octet(keyId))])),
    ]));
}

function contentInfoData(inner) {
    return seq(concat([oid(OID_DATA), explicit(0, octet(inner))]));
}

function bmpPassword(password) {
    const s = String(password || "");
    if (!s) {
        return Buffer.alloc(0);
    }
    const buf = Buffer.alloc((s.length + 1) * 2);
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        buf[i * 2] = (c >> 8) & 255;
        buf[i * 2 + 1] = c & 255;
    }
    return buf;
}

function bmpString(s) {
    const buf = Buffer.alloc(s.length * 2);
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        buf[i * 2] = (c >> 8) & 255;
        buf[i * 2 + 1] = c & 255;
    }
    return tlv(0x1e, buf);
}

/** RFC 7292 附录 B，SHA-1，v = 64。 */
function p12kdf(id, password, salt, iterations, size) {
    const u = 20;
    const v = 64;
    const D = Buffer.alloc(v, id);
    const S = diversify(salt, v);
    const P = diversify(password, v);
    let I = Buffer.concat([S, P]);
    const c = Math.ceil(size / u);
    const result = Buffer.alloc(c * u);
    for (let i = 1; i <= c; i++) {
        let A = crypto.createHash("sha1").update(D).update(I).digest();
        for (let j = 1; j < iterations; j++) {
            A = crypto.createHash("sha1").update(A).digest();
        }
        A.copy(result, (i - 1) * u);
        if (I.length === 0) {
            continue;
        }
        const B = Buffer.alloc(v);
        for (let k = 0; k < v; k++) {
            B[k] = A[k % A.length];
        }
        for (let k = I.length; k > 0; k -= v) {
            let carry = 1;
            for (let m = v - 1; m >= 0; m--) {
                const idx = k - v + m;
                const sum = I[idx] + B[m] + carry;
                I[idx] = sum & 255;
                carry = sum >> 8;
            }
        }
    }
    return result.subarray(0, size);
}

function diversify(src, v) {
    if (!src || src.length === 0) {
        return Buffer.alloc(0);
    }
    const sLen = v * Math.ceil(src.length / v);
    const out = Buffer.alloc(sLen);
    for (let i = 0; i < sLen; i++) {
        out[i] = src[i % src.length];
    }
    return out;
}

function seq(body) {
    return tlv(0x30, body);
}

function set(body) {
    return tlv(0x31, body);
}

function integer(be) {
    const buf = Buffer.isBuffer(be) ? be : Buffer.from(be);
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) {
        i++;
    }
    if ((buf[i] & 0x80) !== 0) {
        const padded = Buffer.alloc(buf.length - i + 1);
        buf.copy(padded, 1, i);
        return tlv(0x02, padded);
    }
    return tlv(0x02, buf.subarray(i));
}

function oid(body) {
    return tlv(0x06, body);
}

function octet(body) {
    return tlv(0x04, body);
}

function printable(s) {
    return tlv(0x13, Buffer.from(s, "ascii"));
}

function utcTime(s) {
    return tlv(0x17, Buffer.from(s, "ascii"));
}

function bitString(body) {
    const withUnused = Buffer.alloc(body.length + 1);
    body.copy(withUnused, 1);
    return tlv(0x03, withUnused);
}

function bitStringRaw(unused, content) {
    const withUnused = Buffer.alloc(content.length + 1);
    withUnused[0] = unused;
    Buffer.from(content).copy(withUnused, 1);
    return tlv(0x03, withUnused);
}

function explicit(n, inner) {
    return tlv(0xa0 | n, inner);
}

function context(n, body) {
    return tlv(0x80 | n, body);
}

function tlv(tag, body) {
    const len = lengthBytes(body.length);
    const out = Buffer.alloc(1 + len.length + body.length);
    out[0] = tag;
    len.copy(out, 1);
    body.copy(out, 1 + len.length);
    return out;
}

function lengthBytes(n) {
    if (n < 128) {
        return Buffer.from([n]);
    }
    if (n < 256) {
        return Buffer.from([0x81, n]);
    }
    if (n < 65536) {
        return Buffer.from([0x82, (n >> 8) & 255, n & 255]);
    }
    return Buffer.from([0x83, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
}

function concat(parts) {
    return Buffer.concat(parts);
}

function skip(der, at) {
    return valueAt(der, at) + lengthAt(der, at);
}

function lengthAt(der, at) {
    const b = der[at + 1];
    if (b < 128) {
        return b;
    }
    const nbytes = b & 0x7f;
    let n = 0;
    for (let i = 0; i < nbytes; i++) {
        n = (n << 8) | der[at + 2 + i];
    }
    return n;
}

function valueAt(der, at) {
    const b = der[at + 1];
    if (b < 128) {
        return at + 2;
    }
    return at + 2 + (b & 0x7f);
}

module.exports = {
    STORE_PASS,
    certDir,
    material,
    caCertificatePath,
    hostNames,
};
