"use strict";

const profile = require("./profile");
const net = require('net');
const crypto = require("./crypto");
const { Message } = require("./message");
const { unstableDynamicInputRtl } = require("naive-ui");
const { log } = require("console");

let Clients = [];

function createTsClient(ip, port) {
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
        // client.write('client hello.');
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
                getMode = false;
                client.write(new Message("test", profile.MSG_LEN, ID, undefined).getJSON());
            }
        } else {
            if (data != undefined && Number(data[0]) == profile.SERVER_ID) {
                console.log(data);
            }
        }
    });

    client.on('close', () => {
        console.log('-> disconnected by server: ' + ip)
    })

    // 添加到列表
    Clients.push(client);
}



// 断开所有连接
function disconnectServer() {
    for (let i = 0; i < Clients.length; i++) {
        const el = Clients[i];
        try {
            el.end();
            el.destroy();
        } catch (error) {
            console.log(error);
        }
    }
}


module.exports = {
    createTsClient,
    disconnectServer,
}