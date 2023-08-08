"use strict";

const os = require("os");
const L  = require('list'); 

function getIpAddr(type = 0) {
    // 获取本机网络信息
    let iaddr = L.empty();
    const nfs = os.networkInterfaces();
    // console.log(nfs);
    // 查找 IPv4 地址
    for (const networkname in nfs) {
        // 网络名称
        // console.log(networkname);
        for (const v4v6 of nfs[networkname]) {
            // 打印IPv4 IPv6网络信息
            // console.log(v4v6);
            if (type == 1) {
                if (v4v6.family === 'IPv4') {
                    iaddr = L.append(v4v6.address, iaddr);
                    break
                }
            }
            else if (type == 2) {
                if (v4v6.family === 'IPv6') {
                    iaddr = L.append(v4v6.address, iaddr);
                    break
                }
            } else {
                iaddr = L.append(v4v6.address, iaddr);
            }
        }
    }
    // prlst(L.toArray(iaddr));
    return L.toArray(iaddr);
}

console.log(os.networkInterfaces());

module.exports = {
    getIpAddr,
}