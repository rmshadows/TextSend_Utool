"use strict";

const profile = require("./profile");
const net = require('net');
const crypto = require("./crypto");
const { Message } = require("./message");

function createTsClient(ip, port) {
    profile.startStatus = 0;
    const client = net.connect(port, ip);
    client.setEncoding("utf-8");
    let getClientId = true;
    let getMode = true;
    let ID = "-1";
    // 客户端模式由服务端决定
    let clientModeset = "";
    let SUPPORT_MODE = {};
    SUPPORT_MODE["supportMode"] = [1];
    SUPPORT_MODE = JSON.stringify(SUPPORT_MODE);
    // 设置超时 10s 后面连接成功会修改
    client.setTimeout(10000);

    client.on('connect', () => {
        console.log('client hello.');
    });

    client.on('timeout', () => {
        console.log('Server timeout.');
        client.end();
        client.destroy();
    });

    client.on('data', (chunk) => {
        // 收到就解密
        let data = crypto.decryptJSON(chunk);
        // 获取服务器发送的ID
        if (getClientId) {
            // 解密成功且id是服务器ID 确认消息由服务器发出
            if (data != undefined && Number(data[0]) == profile.SERVER_ID) {
                // 从notes获取ID
                ID = data[2];
                // 发送支持的模式，由服务端决定
                console.log("Client get ID: " + ID);
                client.write(new Message(undefined, profile.MSG_LEN, ID, "SUPPORT-" + SUPPORT_MODE).getJSON());
                getClientId = false;
            }
        } else if (getMode) {
            // 服务器会返回一个模式CONFIRM
            if (data != undefined && Number(data[0]) == profile.SERVER_ID) {
                // 收到服务器的模式答复
                if (data[2] != undefined && data[2].split("-")[0] == "CONFIRM") {
                    clientModeset = Number(data[2].split("-")[1])
                }
                // 设置超时一小时
                client.setTimeout(3599999);
                console.log("Client mode set at: " + clientModeset);
                // 添加Socket到字典
                profile.SOCKET_POOL[ID] = [client, clientModeset];
                profile.startStatus = 1;
                getMode = false;
                client.write(new Message("test", profile.MSG_LEN, ID, undefined).getJSON());
            }
        } else {
            // 如果ID来源服务器
            if (data != undefined && Number(data[0]) == profile.SERVER_ID) {
                console.log("解密后：" + data);
                // 直接粘贴
                // utools.hideMainWindowPasteText(data);
                // 使用utools API CTRL + V
                utools.hideMainWindowTypeString(data[1])
                // 收到消息 放入剪贴板 
                utools.copyText(data[1]);
            } else {
                console.log("Client drop: " + data);
            }
        }
    });

    client.on('close', () => {
        // 服务端断开
        console.log('-> disconnected by server: ' + ip);
        disconnectServer();
    });

    client.on('error', function (ex) {
        console.log("Client error: " + ex);
        profile.startStatus = 2;
    });
}



// 断开所有连接
function disconnectServer() {
    let s = true;
    for (let key in profile.SOCKET_POOL) {
        try {
            const el = profile.SOCKET_POOL[key][0];
            console.log("Closing client socket: " + key);
            el.end();
            el.destroy();
        } catch (error) {
            console.log("关闭Client Socket出错: " + error);
            s = false;
        }
    }
    if (s) {
        profile.SOCKET_POOL = [];
    }
}


module.exports = {
    createTsClient,
    disconnectServer,
}