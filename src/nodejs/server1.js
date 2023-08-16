"use strict";
// http://zhenhua-lee.github.io/node/socket.html
// https://github.com/qufei1993/Nodejs-Roadmap/blob/master/docs/nodejs/net.md
const net = require('net');

let PORT = 54300;
// 创建server
let server = net.createServer();
// 最大连接数
server.maxConnections = 3;
// 服务
let serverLaunched = [];
// 储存已链接的sockets
let connected = [];

// 客户端链接
server.on('connection', (socket) => {
    // 设置编码
    socket.setEncoding("utf-8");
    console.log('<- client-connected');
    // socket.pipe(process.stdout);
    ss.push(socket);

    // 客户端信息 data写在connection中
    socket.on('data', (data) => {
        // socket.write(`你好:${name}`)
        console.log(data);
        if(String(data) == "0"){
            // socket.end();
            ss.forEach(x=>x.end());
            server.close();
        }
    });
    // socket.write('server hello.');

    socket.on('end', () => {
        console.log('-> client-disconnected');
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

// 启动监听
server.listen(PORT, () => {
    console.log(`server is on ${JSON.stringify(server.address())}`);
    console.log(`服务已开启在 ${PORT}`);
});


