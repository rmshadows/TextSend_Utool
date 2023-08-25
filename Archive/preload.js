// 进入插件调用的 刷新插件不会调用
utools.onPluginEnter(({ code, type, payload, option }) => {
  console.log('用户进入插件应用', code, type, payload);
});

// ui/index.html
const ubWindow = utools.createBrowserWindow('ui/index.html', {
  show: false,
  title: '测试窗口',
  webPreferences: {
    preload: 'tspreload.js',
    devTools: true,
  }
}, () => {
  // 显示
  ubWindow.show();
  ubWindow.webContents.openDevTools();
  // 向子窗口传递数据
  ubWindow.webContents.send('ping')
  require('electron').ipcRenderer.sendTo(ubWindow.webContents.id, 'ping')
  // 执行脚本
  ubWindow.executeJavaScript('fetch("https://jsonplaceholder.typicode.com/users/1").then(resp => resp.json())')
    .then((result) => {
      console.log(result) // Will be the JSON object from the fetch call
    })
})
console.log(ubWindow);

/**
 * 测试utools api输出
 */
window.showPath = function () {
  console.log("用户的 home 文件夹（主目录）: " + utools.getPath("home"));
  console.log("当前用户的应用数据文件夹，默认对应: " + utools.getPath("appData"));
  console.log("储存你应用程序设置文件的文件夹，默认是 appData 文件夹附加应用的名称: " + utools.getPath("userData"));
  console.log("临时文件夹: " + utools.getPath("temp"));
  console.log("当前的可执行文件: " + utools.getPath("exe"));
  console.log("当前用户的桌面文件夹: " + utools.getPath("desktop"));
  console.log("用户文档目录的路径: " + utools.getPath("documents"));
  console.log("用户下载目录的路径: " + utools.getPath("downloads"));
  console.log("用户音乐目录的路径: " + utools.getPath("music"));
  console.log("用户图片目录的路径: " + utools.getPath("pictures"));
  console.log("用户视频目录的路径: " + utools.getPath("videos"));
  console.log("应用程序的日志文件夹: " + utools.getPath("logs"));
}