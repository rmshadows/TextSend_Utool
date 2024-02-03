const msystem = require("./src/nodejs/system");
const qrcode = require("./src/nodejs/qrimg");
const server = require("./src/nodejs/server");
const client = require("./src/nodejs/client");
const profile = require("./src/nodejs/profile");
const { Message } = require("./src/nodejs/message");
const net = require('net');

// 进入插件调用的 刷新插件不会调用
// utools.onPluginEnter(({ code, type, payload, option }) => {
//   console.log('用户进入插件应用', code, type, payload);
// });

// IPC通信，未使用
// const { ipcRenderer } = require('electron');
// // https://yuanliao.info/d/5873
// window.ping = function (callback) {
//   console.log("Preload.js 设置Ping");
//   ipcRenderer.on('ping', callback);
// }


/**
 * 返回本机IP地址
 * @returns 
 */
window.getIpAddr = function () {
  return msystem.getIpAddr();
}


/**
 * 启动服务端
 * @param {String} port 端口号
 * @param {Number} maxConnections 最大连接数
 */
window.startServer = function (port, maxConnections = 1) {
  server.createTsServer(port, maxConnections);
}

/**
 * 停止服务
 */
window.stopServer = function () {
  server.closeAllServers();
}


/**
 * 客户端连接
 * @param {String} ip 
 * @param {String} port 
 */
window.startClient = function (ip, port) {
  client.createTsClient(ip, port);
}

/**
 * 客户端断开
 */
window.stopClient = function () {
  client.disconnectServer();
}

/**
 * 服务端发送 禁止连续调用(中间要有间隔，否则发送 A B 会收到 AB)
 * @param {String} msgString 
 */
window.serverSend = function (msgString) {
  server.ssend(msgString);
}

/**
 * 客户端发送 禁止连续调用(中间要有间隔，否则发送 A B 会收到 AB)
 * @param {String} msgString 
 */
window.clientSend = function (msgString) {
  client.csend(msgString);
}


/**
 * 生成二维码图片地址
 * @param {String} ip 
 * @param {String} port 
 * @returns 
 */
window.getQrImgPath = function (ip, port) {
  // ipv6加中括号
  if (isIPv6(ip)) {
    ip = '[' + ip + ']'
    return qrcode.generateQR(ip, port, utools.getPath("temp"));
  }
  return qrcode.generateQR(ip, port, utools.getPath("temp"));
}

/**
 * 判断是否ipv6
 * @param {string} ip 
 * @returns 
 */
window.isIPv6 = function (ip) {
  if (ip.indexOf("]:") != -1) {
    return true;
  }
  return net.isIPv6(ip);
}

/**
 * 获取临时目录
 * @returns 
 */
window.getTempDir = function () {
  return utools.getPath("temp");
}

/**
 * 返回服务器状态 服务器数量、连接数
 * @returns 服务器数量、连接数
 */
window.getConnectionStat = function () {
  console.log("Server: " + profile.SERVER_POOL.length + "  Sockets(server+client): "
    + Object.keys(profile.SOCKET_POOL).length);
  // 打印Hash
  for (let key in profile.SOCKET_POOL) {
    console.log("当前已连接：" + key + " / " + String(profile.SOCKET_POOL[key]));
  }
  // 服务器数量、连接数
  return [profile.SERVER_POOL.length, Object.keys(profile.SOCKET_POOL).length]
}

/**
 * 调用检查是否要清空文字
 * @returns 
 */
window.getMsgFeedbackStat = function () {
  return profile.clearText;
}

/**
 * 设置清空文字的状态
 * @param {boolean} value 
 */
window.setClearStat = function (value) {
  if (profile.clearText != value) {
    profile.clearText = value;
  }
}

/**
 * 返回服务启动是否报错(True为成功)
 * @returns 
 */
window.startSuccessful = function () {
  if (profile.startStatus == 1) {
    console.log("Start successful.");
  } else if (profile.startStatus == 0) {
    console.log("Starting...");
  } else if (profile.startStatus == 2) {
    console.log("Start failed.");
  }
  return profile.startStatus;
}

/**
 * 设置profile.startStatus参数
 * @param {Number} value 
 */
window.setStartStatus = function (value) {
  profile.startStatus = value;
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