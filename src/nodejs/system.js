"use strict";

const os = require("os");

function hostOf(info) {
    return String(info.address || "").split("%")[0];
}

function isDropped(info) {
    const raw = hostOf(info);
    if (!raw || raw === "0.0.0.0" || raw === "::") {
        return true;
    }
    const fam = info.family;
    if (fam === "IPv4" || fam === 4) {
        const a = parseInt(raw.split(".")[0], 10);
        if (a >= 224) {
            return true;
        }
    }
    return false;
}

/** 回环 / 链路本地：列表末尾，不当默认 */
function isJunk(info) {
    const raw = hostOf(info);
    if (info.internal) {
        return true;
    }
    if (raw === "127.0.0.1" || raw === "::1") {
        return true;
    }
    return raw.toLowerCase().startsWith("fe80") || raw.startsWith("169.254");
}

function familyOk(info, type) {
    const fam = info.family;
    const v4 = fam === "IPv4" || fam === 4;
    const v6 = fam === "IPv6" || fam === 6;
    if (type === 1) {
        return v4;
    }
    if (type === 2) {
        return v6;
    }
    return true;
}

/**
 * 获取IP。局域网在前，127 / fe80 / 169.254 在后。
 * @param {Number} type 类型0:全部 1:ip4 2:ip6
 */
function getIpAddr(type = 0) {
    const lan = [];
    const junk = [];
    const nfs = os.networkInterfaces();
    for (const networkname in nfs) {
        for (const info of nfs[networkname]) {
            if (!familyOk(info, type) || isDropped(info)) {
                continue;
            }
            const host = hostOf(info);
            const bucket = isJunk(info) ? junk : lan;
            if (bucket.indexOf(host) === -1) {
                bucket.push(host);
            }
        }
    }
    return lan.concat(junk);
}

/**
 * 生成从minNum到maxNum的随机数
 * @param {Number} minNum 
 * @param {Number} maxNum 
 * @returns 
 */
function randomNum(minNum, maxNum) {
    switch (arguments.length) {
        case 1:
            return parseInt(Math.random() * minNum + 1, 10);
            break;
        case 2:
            return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
            break;
        default:
            return 0;
            break;
    }
}


/**
 * 定时器 + Promise 实现 sleep
 * https://cloud.tencent.com/developer/article/1802782
// async await 的方式
async function test() {
  console.log(1);
  await promiseSleep(3000);
  console.log(2);
}

// Promise 的链式调用方式
async function test() {
  console.log(1);
  promiseSleep(3000).then(() => {
    console.log(2);
  });
}
 * @param {*} ms 
 * @returns 
 */
const promiseSleep = (ms) => {
    new Promise(resolve => setTimeout(resolve, ms));
}



/**
 * 真正的阻塞事件循环，阻塞线程直到超时，不要在主线程上使用 
 * https://cloud.tencent.com/developer/article/1802782
 * @param {Number} ms delay
 * @returns {String} ok|not-equal|timed-out
 */
function realSleep(ms) {
    const valid = ms > 0 && ms < Infinity;
    if (valid === false) {
        if (typeof ms !== 'number' && typeof ms !== 'bigint') {
            throw TypeError('ms must be a number');
        }
        throw RangeError('ms must be a number that is greater than 0 but less than Infinity');
    }
    return Atomics.wait(int32, 0, 0, Number(ms))
}

/**
 * 时间戳
 * @returns 
 */
function getTimestamp() {
    return Number(new Date().getTime());
}


module.exports = {
    getIpAddr,
    randomNum,
    getTimestamp,
}