const msystem = require("./src/nodejs/system");
const crypto = require("./src/nodejs/crypto");
const message = require("./src/nodejs/message");
const qrcode = require("./src/nodejs/qrimg");
const server = require("./src/nodejs/server");
const client = require("./src/nodejs/client");

// 进入插件调用的 刷新插件不会调用
// utools.onPluginEnter(({ code, type, payload, option }) => {
//   console.log('用户进入插件应用', code, type, payload);
// });


const { ipcRenderer } = require('electron');

// 暴露API给randerer
window.handleCounter = function (callback) {
  ipcRenderer.on('update-counter', callback);
}

// https://yuanliao.info/d/5873
window.addEventListener('DOMContentLoaded', () => {
  const counter = document.getElementById('counter')
  ipcRenderer.on('update-counter', (_event, value) => {
    const oldValue = Number(counter.innerText)
    const newValue = oldValue + value
    counter.innerText = newValue
  })
})


/**
 * 返回本机IP地址
 * @returns 
 */
window.getIpAddr = function () {
  return msystem.getIpAddr();
}

// window.Message = MSG;

// 加密
window.encrypt = function () {
  return msystem.getIpAddr();
}


// 启动服务端
window.startServer = function (port) {
  server.createTsServer(port);
}

// 停止服务
window.stopServer = function () {
  server.closeAllServers();
}

// 生成二维码图片地址
window.getQrImgPath = function (ip, port) {
  return qrcode.generateQR(ip, port, utools.getPath("temp"));
}

// 获取临时目录
window.getTempDir = function () {
  return utools.getPath("temp");
}

// 返回服务器状态
window.getServerStat = function () {
  // console.log(server.serverStatus());
  // TODO DEBUG
  return server.serverStatus()[0];
}


/**
 * 测试utools api输出
 */
window.showPath = function () {
  console.log("用户的 home 文件夹（主目录）: " + utools.getPath("home"));
  console.log("当前用户的应用数据文件夹，默认对应: " + utools.getPath("appData"));
  console.log("储存你应用程序设置文件的文件夹，默认是 appData 文件夹附加应用的名称: " + utools.getPath("userData"));
  console.log("临时文件夹: " + utools.getPath("temp"));
  console.log("当前的可执行文件: " + utools.getPath("exe"));
  console.log("当前用户的桌面文件夹: " + utools.getPath("desktop"));
  console.log("用户文档目录的路径: " + utools.getPath("documents"));
  console.log("用户下载目录的路径: " + utools.getPath("downloads"));
  console.log("用户音乐目录的路径: " + utools.getPath("music"));
  console.log("用户图片目录的路径: " + utools.getPath("pictures"));
  console.log("用户视频目录的路径: " + utools.getPath("videos"));
  console.log("应用程序的日志文件夹: " + utools.getPath("logs"));
}