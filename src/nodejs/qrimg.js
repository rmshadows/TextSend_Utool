"use strict";
const QR = require("./mqrcode/mqrcode.cjs");

function generateQR(ip, port) {
    // let p = "../../ui/assets/qrcode.png";
    let p = "qrcode.png";
    console.log(process.cwd());
    try {
        let content = String(ip) + ":" + String(port);
        console.log("qrimg.js:generateQR: " + content + " => " + p);
        QR.createQRSync(content, p, 512, "png");
        // return p;
        return "../assets/qrcode.png";
    } catch (error) {
        console.log(error);
        return "../assets/favicon.png";
    }
}


module.exports = {
    generateQR,
}

generateQR("192.168.1.1", "54300");
