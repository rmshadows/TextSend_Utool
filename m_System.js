/**
 * 系统模块， 需要Arrays模块
 */
var m_Arrays = require("./m_Arrays");


function getIPs(){
    const os = require('os');
    // 设定一个局域网的默认值
    // let localWlanHost = 'localhost';
    let localWlanHost = new m_Arrays.JsList();
    try {
        // networkInterfaces这个方法详见：http://nodejs.cn/api/os.html#os_os_networkinterfaces
        const ifaces = os.networkInterfaces();
        for (let dev in ifaces) {
            ifaces[dev].forEach((details, alias) => {
            // 寻找IPv4协议族，并且地址不是本地地址或者回环地址的地址即可。
            if (details.family === 'IPv4' && details.address !== '127.0.0.1' && !details.internal) {
                // console.log(details.address);
                localWlanHost.append(details.address);
                // localWlanHost = details.address;
                // localWlanHost.join(details.address);
            }
        });
    }
    } catch (e) {
        console.log(e);
        localWlanHost = 'localhost';
    }
    console.log(localWlanHost);
    return localWlanHost.getList();
}

module.exports = {
    getIPs
}
