"use strict";

const QRCode = require("qrcode");

/** 生成二维码 PNG 并保存到 savepath */
function createQRSync(text, savepath, width = 500, type = "png") {
    QRCode.toFile(savepath, text, { type, width });
}

module.exports = { createQRSync };
