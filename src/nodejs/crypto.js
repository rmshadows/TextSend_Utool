"use strict";
const maes = require("./maes/maes.cjs");
const profile = require("./profile");

const IV = "";
const KEY = profile.AES_TOKEN;

// 导出加密器
const Cipher = new maes.cfbCipher(KEY, IV, 32);

// 消息加密
function encrypt(msg) {
    let emsg = Cipher.encrypt(msg);
    // console.log("加密：" + emsg);
    return emsg;
}

// 消息解密
function decrypt(msg) {
    let dmsg = Cipher.decrypt(msg);
    // console.log("解密：" + dmsg);
    return dmsg;
}


module.exports = {
    Cipher,
    encrypt,
    decrypt,
}
