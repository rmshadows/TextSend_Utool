// 进入插件调用的
utools.onPluginEnter(({ code, type, payload, option }) => {
  console.log('用户进入插件应用', code, type, payload)
});

const msystem = require("./src/nodejs/system");
const crypto = require("./src/nodejs/crypto");
const message = require("./src/nodejs/message");
const qrcode = require("./src/nodejs/qrimg");

/**
 * 返回本机IP地址
 * @returns 
 */
window.getIpAddr = function () {
  return msystem.getIpAddr();
}

window.Message = MSG;

window.encrypt = function () {
  return msystem.getIpAddr();
}

window.getQrImgPath = function (ip, port) {
  return qrcode.generateQR(ip, port);
}
