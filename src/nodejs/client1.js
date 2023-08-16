"use strict";

const net = require('net');
const client = net.connect(54300, '127.0.0.1');
client.on('connect', () => {
    client.write('client hello.');
});
client.on('data', (chunk) => {
    console.log(chunk.toString());
    // client.end();
});
client.on('close', () => {
    console.log('-> disconnected by server')
})

// const socket = net.connect(54300, '127.0.0.1')
// const name = process.argv[2] || 'Terrence'
// https://juejin.cn/post/7066637630900797471
// socket.write(name)
// socket.on('data', (data) => {
//     console.log(data.toString())
// })
// socket.on('close', () => {
//     console.log('-> disconnected by server')
// })
