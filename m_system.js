
/**
 * 测试函数
 */
function helloWorld(){
    console.log("Hello World.");
}


function getIPs(){
    const os = require('os');
    // 设定一个局域网的默认值
    // let localWlanHost = 'localhost';
    let localWlanHost = [];
    try {
        // networkInterfaces这个方法详见：http://nodejs.cn/api/os.html#os_os_networkinterfaces
        const ifaces = os.networkInterfaces();
        for (let dev in ifaces) {
            ifaces[dev].forEach((details, alias) => {
            // 寻找IPv4协议族，并且地址不是本地地址或者回环地址的地址即可。
            if (details.family === 'IPv4' && details.address !== '127.0.0.1' && !details.internal) {
                console.log(details.address);
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
}


/**
 * 复制到剪辑版
 * @returns 
 */
function copyText (text) {
    try {
        utools.copyText(text)
    } catch (e) {
        return false
    }
    return true
}

/**
 * 粘贴文字
 * @returns 结果 
 */
function pasteText () {
    try {
        if(isMacOS()){
            utools.simulateKeyboardTap('v', 'command')
        }else{
            utools.simulateKeyboardTap('v', 'ctrl')
        }
    } catch (e) {
        return false
    }
    return true
}

module.exports = {
    helloWorld,
    copyText,
    pasteText,
    getIPs
}
