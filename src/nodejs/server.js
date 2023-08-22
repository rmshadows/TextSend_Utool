"use strict";
const net = require('net');
const { Message } = require('./message');
const profile = require("./profile");
const crypto = require("./crypto");
const Hashcode = require("./hashcode");

/**
参考：
http://zhenhua-lee.github.io/node/socket.html
https://github.com/qufei1993/Nodejs-Roadmap/blob/master/docs/nodejs/net.md
 */
// 服务
let serverLaunched = [];
// 储存已链接的sockets
let connected = {};

/**
 * 启动socket服务 只允许一个
 * @param {*} overwrite 是否覆盖原有
 */
function createTsServer(port, overwrite = false) {
    // TODO：IPC通信
    // const ubWindow = utools.createBrowserWindow('ui/index.html', {
    //     show: false,
    //     title: '测试窗口',
    //     webPreferences: {

    //     }
    // }, () => {
    //     // 向子窗口传递数据
    //     const { ipcRenderer } = require('electron');
    //     console.log(ipcRenderer);
    //     console.log(ubWindow.webContents);
    //     let a = ubWindow.webContents.send("ping", 1);
    //     console.log("IPC Main: 发送Ping");
    // })
    // https://yuanliao.info/d/531-utools-api/8
    // const { remote } = require('electron') ; new remote. BrowserWindow()
    const ubWindow = utools.createBrowserWindow('ui/index.html', {
        show: false,
        title: '测试窗口',
        webPreferences: {
            preload: 'tspreload.js'
        }
      }, () => {
        // 显示
        ubWindow.show()
        // 向子窗口传递数据 这里的ping只能在打开的窗口才能收到
        ubWindow.webContents.send('ping', 1)
        ubWindow.webContents.openDevTools();
        // 执行脚本
        ubWindow.executeJavaScript('fetch("https://jsonplaceholder.typicode.com/users/1").then(resp => resp.json())')
          .then((result) => {
            console.log(result) // Will be the JSON object from the fetch call
          })
      })
      console.log(ubWindow)



    let server = undefined;
    let clientId = undefined;
    if (serverLaunched.length == 0) {
        server = net.createServer();
    } else {
        if (overwrite) {
            closeAllServers();
            server = net.createServer();
        } else {
            console.log("createServer: 已有服务，不再启动");
        }
    }
    // 最大连接数
    server.maxConnections = 1;
    // 创建好开始配置
    // 客户端链接
    server.on('connection', (socket) => {
        // 设置编码
        socket.setEncoding("utf-8");
        // socket.pipe(process.stdout);
        let remoteIP = socket.address().address;
        // hash即客户端ID
        clientId = Hashcode.hashCodeObject(socket);
        // let clientId = system.hashCode(String(new Date().getTime()));
        // console.log(clientId);
        console.log("<- client-connected   :" + remoteIP + "(" + clientId + ")");
        // 将id发给客户端(服务端发送ID到客户端，客户端发送支持的传输模式到服务端，由服务端决定使用什么模式)
        // node端使用JSON传输，Java直接传输类
        // [ '-200', '', '3566633025' ]
        let sendIdData = new Message(undefined, profile.MSG_LEN, profile.SERVER_ID, clientId).getJSON();
        console.log("服务端分配ID：" + sendIdData);
        socket.write(sendIdData);
        // 是否成功设置客户端模式
        let setClientMode = true;
        // 客户端确认ID 及返回支持的模式 确认格式：id(id:{random}):data(空):notes(SUPPORT-{$客户端模式☯☯{random})
        // 注意，随机数在加密解密时已经去除
        let clientConfirmId = false;

        // 设置客户端超时10秒（除非连接成功）
        socket.setTimeout(10000);

        // 客户端信息 data写在connection中
        socket.on('data', (data) => {
            // 首先使用JSON
            // 分配ID -> 客户端返回接收到ID的确认(包含模式) -> 没有确认就断开连接 -> 确认就告知客户端模式后继续
            if (setClientMode) {
                // id data notes
                data = crypto.decryptJSON(data);
                // 先识别客户端头部
                if (data != undefined && Number(data[0]) == clientId) {
                    try {
                        let tsp = data[2].split("-"); // 分隔成 CONFIRM:{$客户端支持的模式}
                        if (tsp[0] == "SUPPORT") {
                            // 客户端模式：0: java class 1:JSON
                            let clientMode = selectClientMode(tsp[1]);
                            if (clientMode != undefined) {
                                // 添加连接
                                connected[clientId] = [socket, clientMode];
                                console.log("客户端模式：" + clientMode);
                                // 打印当前状态
                                serverStatus();
                                // 告知客户端模式选择
                                socket.write(new Message(undefined, profile.MSG_LEN, profile.SERVER_ID, "CONFIRM-" + clientMode).getJSON());
                                clientConfirmId = true;
                                // 如果成功设置模式
                                setClientMode = false;
                            } else {
                                console.log("客户端似乎不支持JSON传输模式，断开...");
                            }
                        }
                    } catch (error) {
                        console.log("客户端ID确认失败或者客户端模式获取失败： " + error);
                    }
                    // 配置不成功就断开
                    if (!clientConfirmId) {
                        socket.end();
                        socket.destroy();
                    } else {
                        // 超时：1小时
                        socket.setTimeout(3600000);
                    }
                } else {
                    console.log("未收到正确的客户端模式和确认请求，等待超时后将断开。");
                }
            } else {
                // 正常读取JSON
                console.log("解密前：" + data);
                data = crypto.decryptJSON(data);
                if (data[0] == clientId) {
                    console.log("解密后：" + data);
                    // 直接粘贴
                    // utools.hideMainWindowPasteText(data);
                    // 使用utools API CTRL + V
                    utools.hideMainWindowTypeString(data)
                    // 收到消息 放入剪贴板 
                    utools.copyText(data);
                } else {
                    console.log("Drop:" + data);
                }
            }
        });

        socket.on('end', () => {
            // 过滤断开的
            delete connected[clientId];
            console.log('-> client-disconnected');
        });

        socket.on('timeout', () => {
            console.log(remoteIP + ' timeout');
            socket.end();
            socket.destroy();
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
        // DEBUG
        // mainWindow.webContents.send('update-counter', 1);
        console.log(`server is on ${JSON.stringify(server.address())}`);
        console.log(`服务已开启在 ${port}`);
    });
}


/**
 * 服务器数量、连接数
 */
function serverStatus() {
    console.log("Server: " + serverLaunched.length + "  Sockets: " + Object.keys(connected).length);
    // 打印Hash
    for (let key in connected) {
        console.log("当前已连接：" + key + " / " + String(connected[key]));
    }
    return [serverLaunched.length, Object.keys(connected).length]
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
            const el = connected[key][0];
            console.log("Closing socket: " + key);
            el.end();
            el.destroy();
        } catch (error) {
            console.log("关闭Socket出错: " + error);
            s = false;
        }
    }
    if (s) {
        connected = [];
    }
}


/**
 * 返回首选的传输方式
 * @param {*} supportMode {supportMode: [1]} 客户端提供的支持的模式
 */
function selectClientMode(supportMode) {
    // 查看客户端是否支持JSON模式
    let json = JSON.parse(supportMode);
    let sm = json['supportMode']
    for (const i in sm) {
        sm[i] = Number(sm[i]);
    }
    if (sm.indexOf(1) == -1) {
        // 不支持JSON模式的返回undefined
        return undefined
    } else {
        // 因为Node端仅支持JSON传输，所以直接返回1
        return 1;
    }
}


module.exports = {
    createTsServer,
    closeAllServers,
    closeAllSockets,
    serverStatus,
    serverLaunched,
    connected,
}

