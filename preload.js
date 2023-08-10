// 进入插件调用的
utools.onPluginEnter(({ code, type, payload, option }) => {
  console.log('用户进入插件应用', code, type, payload)
});

const msystem = require("./src/nodejs/system");

/**
 * 返回本机IP地址
 * @returns 
 */
window.getIpAddr = function () {
  return msystem.getIpAddr();
}


