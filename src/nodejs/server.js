"use strict";
const { log } = require('console');
const net = require('net');

// 服务器消息自带的ID
const SERVER_ID = -200;
// 服务器成功接收的反馈信息
const FB_MSG = "cn.rmshadows.TextSend.ServerStatusFeedback";
// 单个Msg拆分的长度
const MSG_LEN = 1000;
// 加密用的Token
const AES_TOKEN = "cn.rmshadows.TS_TOKEN";
// 服务运行的端口号
let PORT = undefined;
// 猜测的IP地址
let Prefer_Addr = undefined;
// Socket Server服务是否正在运行
let is_running = false;
// 作为客户端使用时，生成的Socket
let client = null;
// 客户端是否连接
let client_connected = false;
// 网卡IP地址
let net_ip = [];

// 创建server
let server = net.createServer();
// 最大连接数
server.maxConnections = 3;
// 服务
let serverLaunched = [];
// 储存已链接的sockets
let connected = [];

/**
 * 启动socket服务 只允许一个
 * @param {*} overwrite 是否覆盖原有
 */
function createServer(overwrite = false) {
    if (serverLaunched.length == 0) {
        const s = net.createServer();
        serverLaunched.push(s);
    } else {
        if (overwrite) {
            closeAllServers();
            const s = net.createServer();
            serverLaunched.push(s);
        } else {
            console.log("createServer: 已有服务，不再启动");
        }
    }
}


/**
 * 关闭所有服务
 */
function closeAllServers() {
    let s = true;
    // 首先得关闭所有socket
    closeAllSockets();
    // 再关闭server
    for (let i = 0; i < serverLaunched.length; i++) {
        try {
            const el = serverLaunched[i];
            el.close();
        } catch (error) {
            console.log("关闭Server出错: " + error);
            s = false;
        }
    }
    // 没出错再清零
    if(s){
        serverLaunched = [];
    }
}

/**
 * 关闭所有socket
 */
function closeAllSockets() {
    let s = true;
    for (let i = 0; i < connected.length; i++) {
        try {
            const el = connected[i];
            el.end();
        } catch (error) {
            console.log("关闭Socket出错: " + error);
            s = false;
        }
    }
    if(s){
        connected = [];
    }
}


module.exports = {
    SERVER_ID,
    FB_MSG,
    MSG_LEN,
    AES_TOKEN,
    createServer,
    closeAllServers,
    closeAllSockets,
}

