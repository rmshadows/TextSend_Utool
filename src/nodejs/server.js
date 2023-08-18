"use strict";
const { log } = require('console');
const net = require('net');
const Hashcode = require('./hashcode');
const { Message } = require('./message');
const profile = require("./profile");

/**
参考：
http://zhenhua-lee.github.io/node/socket.html
https://github.com/qufei1993/Nodejs-Roadmap/blob/master/docs/nodejs/net.md
 */
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
let connected = {};

/**
 * 启动socket服务 只允许一个
 * @param {*} overwrite 是否覆盖原有
 */
function createTsServer(port, overwrite = false) {
    if (serverLaunched.length == 0) {
        const server = net.createServer();
    } else {
        if (overwrite) {
            closeAllServers();
            const server = net.createServer();
        } else {
            console.log("createServer: 已有服务，不再启动");
        }
    }
    // 创建好开始配置
    // 客户端链接
    server.on('connection', (socket) => {
        // 设置编码
        socket.setEncoding("utf-8");
        // socket.pipe(process.stdout);
        let remoteIP = socket.address().address;
        // hash即客户端ID
        let clientId = Hashcode.value(socket);
        console.log("<- client-connected   :" + remoteIP + "(" + clientId + ")");
        // 将id发给客户端(服务端发送ID到客户端，客户端发送传输模式到服务端)
        // node端使用JSON传输，Java直接传输类
        let sendIdData = new Message(undefined, profile.MSG_LEN, profile.SERVER_ID, clientId).getJSON();
        console.log("服务端分配ID：" + sendIdData);
        socket.write(sendIdData);

        // 客户端信息 data写在connection中
        socket.on('data', (data) => {
            let getClientMode = true;
            if (getClientMode) {
                // 先识别客户端头部
                if (true) {
                    // 客户端模式：0: java class 1:JSON
                    let clientMode = undefined;
                    // 如果成功设置模式
                    getClientMode = false;
                    // 添加连接
                    connected[clientId] = [socket, clientMode];
                }
            } else {
                // socket.write(`你好:${name}`)
                console.log(data);
                // 接受到0退出
                if (String(data) == "0") {
                    // socket.end();
                    connected.forEach(x => x.end());
                    server.close();
                }
            }
        });

        socket.on('end', () => {
            console.log('-> client-disconnected');
        });
        // 超时：1小时
        socket.setTimeout(3600000);
        socket.on('timeout', () => {
            console.log(remoteIP + ' timeout');
            socket.end();
        });

        socket.on('error', (err) => {
            console.log("Socket error: " + err);
        });

    });

    server.on('error', (err) => {
        console.log("Server error: " + err);
    });

    // 会在所有连接断开后执行
    server.on('close', () => {
        console.log('服务器已关闭: SERVER SHUTDOWN');
    })

    // 超出连接数量限制
    server.on('drop', (data) => {
        console.log('服务器拒绝连接: ' + JSON.stringify(data));
    })

    // 添加到服务器列表
    serverLaunched.push(server);

    // 启动监听
    server.listen(port, () => {
        console.log(`server is on ${JSON.stringify(server.address())}`);
        console.log(`服务已开启在 ${port}`);
    });
}

/**
 * 服务器数量、连接数
 */
function serverStatus() {
    console.log("Server: " + serverLaunched.length + "  Sockets: " + connected.length);
    // 打印Hash
    // connected.forEach((ss) => {
    //    console.log(hashCode(ss.toString())); 
    // });
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
    if (s) {
        serverLaunched = [];
    }
}

/**
 * 关闭所有socket
 */
function closeAllSockets() {
    let s = true;
    for (let key in connected) {
        // console.log("key: " + key + " ,value: " + dic[key]);
        try {
            const el = connected[key];
            console.log("Closing socket: " + key);
            el.end();
        } catch (error) {
            console.log("关闭Socket出错: " + error);
            s = false;
        }
    }
    if (s) {
        connected = [];
    }
}


module.exports = {
    createTsServer,
    closeAllServers,
    closeAllSockets,
    serverStatus,
}

