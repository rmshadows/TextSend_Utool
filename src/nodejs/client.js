"use strict";

const profile = require("./profile");
const net = require('net');
const crypto = require("./crypto");
const { Message } = require("./message");

let Clients = [];

function createTsClient(ip, port) {
    const client = net.connect(port, ip);
    client.setEncoding("utf-8");
    let getClientId = true;
    let ID = "-1";
    
    client.on('connect', () => {
        // client.write('client hello.');
    });

    client.on('data', (chunk) => {
        let data = crypto.decryptJSON(chunk);
        // 获取服务器发送的ID
        if (getClientId) {
            // 解密成功且id是服务器ID 确认消息由服务器发出
            if (data != undefined && Number(data[0]) == profile.SERVER_ID) {
                // 从notes获取ID
                ID = data[2];
                // 发送模式
                client.write(new Message(undefined, profile.MSG_LEN, ID, "CONFIRM-1").getJSON());
                getClientId = false;
            }
        } else {
            console.log(data);
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