// import Clipboard from 'clipboard';

/**
 * 测试函数
 */
function helloWorld(){
    console.log("Hello World.");
}

/**
 * 复制到剪辑版
 * @returns 
 */
function copyText (text) {
    try {
        const btnCopy = new Clipboard('btn');
        this.copyValue = 'hello world';
    } catch (e) {
        return false
    }finally{
        btn.destroy()
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
    pasteText
}
